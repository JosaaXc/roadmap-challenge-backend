import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor.js';
import { AppException } from '../exceptions/app.exception.js';
import { tracingContext } from '../middlewares/tracing.context.js';

function makeContext(opts?: { headers?: Record<string, string>; method?: string }) {
  const response = { status: vi.fn().mockReturnThis() };
  const request = { headers: opts?.headers ?? {}, method: opts?.method ?? 'POST' };
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
  return { context, response, request };
}

describe('IdempotencyInterceptor', () => {
  let interceptor: IdempotencyInterceptor;
  let reflector: { get: ReturnType<typeof vi.fn> };
  let redis: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
  };
  let configService: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    reflector = { get: vi.fn() };
    redis = { get: vi.fn(), set: vi.fn(), del: vi.fn() };
    configService = { get: vi.fn((_key: string, fallback: number) => fallback) };
    interceptor = new IdempotencyInterceptor(
      reflector as any,
      redis as any,
      configService as any,
    );
  });

  it('passes through untouched when the route has no @Idempotent() metadata', async () => {
    reflector.get.mockReturnValue(undefined);
    const { context } = makeContext();
    const next: CallHandler = { handle: () => of('untouched') };

    const result$ = await interceptor.intercept(context, next);

    expect(await firstValueFrom(result$)).toBe('untouched');
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('rejects with MISSING_IDEMPOTENCY_KEY when required and the header is absent', async () => {
    reflector.get.mockReturnValueOnce({}); // idempotent options
    const { context } = makeContext({ headers: {} });
    const next: CallHandler = { handle: () => of('x') };

    await expect(interceptor.intercept(context, next)).rejects.toThrow(AppException);
  });

  it('passes through without a header when required: false', async () => {
    reflector.get.mockReturnValueOnce({ required: false });
    const { context } = makeContext({ headers: {} });
    const next: CallHandler = { handle: () => of('ok') };

    const result$ = await interceptor.intercept(context, next);

    expect(await firstValueFrom(result$)).toBe('ok');
  });

  it('replays the cached response and sets its stored status on a COMPLETED hit', async () => {
    reflector.get.mockReturnValueOnce({});
    redis.get.mockResolvedValue({ state: 'COMPLETED', status: 201, body: { id: 'cached' } });
    const { context, response } = makeContext({ headers: { 'idempotency-key': 'key-1' } });
    const next: CallHandler = { handle: vi.fn() };

    const result$ = await interceptor.intercept(context, next);

    expect(await firstValueFrom(result$)).toEqual({ id: 'cached' });
    expect(response.status).toHaveBeenCalledWith(201);
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('rejects with IDEMPOTENT_REQUEST_IN_PROGRESS on a concurrent IN_PROGRESS hit', async () => {
    reflector.get.mockReturnValueOnce({});
    redis.get.mockResolvedValue({ state: 'IN_PROGRESS' });
    const { context } = makeContext({ headers: { 'idempotency-key': 'key-1' } });
    const next: CallHandler = { handle: vi.fn() };

    await expect(interceptor.intercept(context, next)).rejects.toThrow(AppException);
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('locks, runs the handler, and caches the COMPLETED result on success', async () => {
    reflector.get
      .mockReturnValueOnce({}) // @Idempotent() options
      .mockReturnValueOnce(undefined); // HTTP_CODE_METADATA (defaults by method)
    redis.get.mockResolvedValue(null);
    redis.set.mockResolvedValue('OK');
    const { context } = makeContext({ headers: { 'idempotency-key': 'key-1' }, method: 'POST' });
    const next: CallHandler = { handle: () => of({ id: 'fresh' }) };

    const result$ = await interceptor.intercept(context, next);

    expect(await firstValueFrom(result$)).toEqual({ id: 'fresh' });
    expect(redis.set).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('idempotency:'),
      { state: 'IN_PROGRESS' },
      60,
    );
    expect(redis.set).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('idempotency:'),
      { state: 'COMPLETED', status: 201, body: { id: 'fresh' } },
      86_400,
    );
  });

  it('deletes the lock and rethrows when the handler fails', async () => {
    reflector.get.mockReturnValueOnce({});
    redis.get.mockResolvedValue(null);
    redis.set.mockResolvedValue('OK');
    redis.del.mockResolvedValue(1);
    const boom = new Error('boom');
    const { context } = makeContext({ headers: { 'idempotency-key': 'key-1' } });
    const next: CallHandler = { handle: () => throwError(() => boom) };

    const result$ = await interceptor.intercept(context, next);

    await expect(firstValueFrom(result$)).rejects.toThrow('boom');
    expect(redis.del).toHaveBeenCalledWith(expect.stringContaining('idempotency:'));
  });

  it('scopes the cache key per authenticated user from the tracing context', async () => {
    reflector.get.mockReturnValueOnce({});
    redis.get.mockResolvedValue(null);
    redis.set.mockResolvedValue('OK');
    const { context } = makeContext({ headers: { 'idempotency-key': 'key-1' } });
    const next: CallHandler = { handle: () => of('ok') };

    await tracingContext.run(
      { correlationId: 'c1', traceId: 't1', auth: { userId: 'user-42', username: 'u', roleId: 'r' } },
      async () => {
        await interceptor.intercept(context, next);
      },
    );

    expect(redis.get).toHaveBeenCalledWith('idempotency:user-42:key-1');
  });
});
