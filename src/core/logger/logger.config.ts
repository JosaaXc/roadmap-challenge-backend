import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type { Params } from 'nestjs-pino';
import { tracingContext } from '../../common/middlewares/tracing.context.js';
import { PINO_LOG_LEVELS, type PinoLogLevel } from '../config/env.validation.js';

/**
 * Determines the minimum (lowest severity) log level from a list.
 * Pino logs everything AT or ABOVE this threshold.
 *
 * Example: ['debug', 'info', 'warn', 'error'] → minimum = 'debug'
 * Example: ['warn', 'error'] → minimum = 'warn' (debug and info are silenced)
 */
function resolveMinLevel(levels: PinoLogLevel[]): PinoLogLevel {
  const sorted = [...PINO_LOG_LEVELS];
  const found = sorted.find((lvl) => levels.includes(lvl));
  return found ?? 'info';
}

export const getLoggerConfig = (configService: ConfigService): Params => {
  const isProd = configService.get<string>('NODE_ENV') === 'production';

  // In production, override LOG_LEVELS to enforce min=info regardless of .env
  const rawLevels = configService.get<PinoLogLevel[]>('LOG_LEVELS', ['debug', 'info', 'warn', 'error']);
  const effectiveLevels: PinoLogLevel[] = isProd
    ? rawLevels.filter((l) => PINO_LOG_LEVELS.indexOf(l) >= PINO_LOG_LEVELS.indexOf('info'))
    : rawLevels;

  const minLevel = resolveMinLevel(effectiveLevels);

  return {
    pinoHttp: {
      level: minLevel,
      genReqId: (req, res) => {
        const correlationId =
          (req.headers['x-correlation-id'] as string) || randomUUID();
        const traceId =
          (req.headers['x-trace-id'] as string) || randomUUID();

        res.setHeader('x-correlation-id', correlationId);
        res.setHeader('x-trace-id', traceId);

        return traceId;
      },
      customProps: () => {
        const store = tracingContext.getStore();
        return {
          correlationId: store?.correlationId ?? 'unknown',
          traceId: store?.traceId ?? 'unknown',
        };
      },
      transport: isProd
        ? undefined
        : {
          target: 'pino-pretty',
          options: {
            singleLine: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
            // Show context tag in dev logs: [REDIS], [POSTGRES], [APP], etc.
            messageFormat: '[{context}] {msg}',
          },
        },
      autoLogging: true,
    },
  };
};
