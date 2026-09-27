import { Injectable } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface.js';
import type { Redis } from 'ioredis';
import { RedisService } from './redis.service.js';

type ThrottleIncrementResult = [totalHits: number, pttlMs: number, isBlocked: number, blockPttlMs: number];

interface RedisWithThrottleCommand extends Redis {
  throttleIncrement(
    key: string,
    ttlMs: number,
    limit: number,
    blockDurationMs: number,
  ): Promise<ThrottleIncrementResult>;
}

/**
 * Atomic increment + window/block bookkeeping, executed as a single Lua
 * script so concurrent requests can never race each other (no separate
 * INCR-then-EXPIRE round trip). Mirrors @nestjs/throttler's own in-memory
 * ThrottlerStorageService algorithm (throttler.service.js) so behavior is
 * identical when swapping storage backends:
 *  - still blocked            -> report the existing block, don't count a hit
 *  - block just elapsed       -> reset to a fresh window (hits=1, unblocked)
 *  - normal path              -> increment hits; block once hits > limit
 *
 * KEYS[1] = redis key ("throttle:<key>")
 * ARGV[1] = ttl in ms (window length)
 * ARGV[2] = limit
 * ARGV[3] = blockDuration in ms
 * Returns [hits, pttlMs, isBlocked (0|1), blockPttlMs]
 */
const THROTTLE_INCREMENT_SCRIPT = `
local key = KEYS[1]
local ttl_ms = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local block_duration_ms = tonumber(ARGV[3])

local time_result = redis.call('TIME')
local now_ms = (tonumber(time_result[1]) * 1000) + math.floor(tonumber(time_result[2]) / 1000)

local blocked_until = tonumber(redis.call('HGET', key, 'blockedUntil') or '0')

if blocked_until > now_ms then
  local pttl = redis.call('PTTL', key)
  local hits = tonumber(redis.call('HGET', key, 'hits') or '0')
  if pttl < 0 then pttl = 0 end
  return {hits, pttl, 1, blocked_until - now_ms}
end

if blocked_until > 0 then
  -- block period just elapsed - fresh window, mirrors resetBlockedRequest()
  redis.call('HSET', key, 'hits', 1, 'blockedUntil', 0)
  redis.call('PEXPIRE', key, ttl_ms)
  return {1, ttl_ms, 0, 0}
end

local hits = redis.call('HINCRBY', key, 'hits', 1)
if hits == 1 then
  redis.call('PEXPIRE', key, ttl_ms)
end

local pttl = redis.call('PTTL', key)
if pttl < 0 then
  redis.call('PEXPIRE', key, ttl_ms)
  pttl = ttl_ms
end

local is_blocked = 0
local time_to_block_expire = 0

if hits > limit then
  is_blocked = 1
  time_to_block_expire = block_duration_ms
  redis.call('HSET', key, 'blockedUntil', now_ms + block_duration_ms)
  if block_duration_ms > pttl then
    redis.call('PEXPIRE', key, block_duration_ms)
    pttl = block_duration_ms
  end
end

return {hits, pttl, is_blocked, time_to_block_expire}
`;

@Injectable()
export class ThrottlerStorageRedisService implements ThrottlerStorage {
  private commandDefined = false;

  constructor(private readonly redisService: RedisService) { }

  /**
   * Registers the Lua script as a named ioredis command on first use, so
   * ioredis sends it once via EVALSHA thereafter (falling back to EVAL only
   * if Redis ever evicts the script cache) instead of re-sending the full
   * script text on every single request. Deferred to first call (rather than
   * a lifecycle hook) so it never races RedisService's own connection setup.
   */
  private getClient(): RedisWithThrottleCommand {
    const client = this.redisService.getClient() as RedisWithThrottleCommand;

    if (!this.commandDefined) {
      client.defineCommand('throttleIncrement', {
        numberOfKeys: 1,
        lua: THROTTLE_INCREMENT_SCRIPT,
      });
      this.commandDefined = true;
    }

    return client;
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    _throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const redisKey = `throttle:${key}`;

    const [totalHits, pttlMs, isBlockedFlag, blockPttlMs] = await this.getClient().throttleIncrement(
      redisKey,
      ttl,
      limit,
      blockDuration,
    );

    return {
      totalHits,
      // @nestjs/throttler's guard writes these straight into Retry-After /
      // X-RateLimit-Reset headers, which are SECONDS per HTTP semantics -
      // matching the library's own in-memory storage (Math.ceil(ms / 1000)).
      timeToExpire: Math.max(Math.ceil(pttlMs / 1000), 0),
      isBlocked: isBlockedFlag === 1,
      timeToBlockExpire: Math.max(Math.ceil(blockPttlMs / 1000), 0),
    };
  }
}
