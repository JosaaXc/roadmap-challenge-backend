import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type { Params } from 'nestjs-pino';
import { tracingContext } from '../../common/middlewares/tracing.context.js';

export const getLoggerConfig = (configService: ConfigService): Params => {
  const isProd = configService.get<string>('NODE_ENV') === 'production';

  return {
    pinoHttp: {
      level: isProd ? 'info' : 'debug',
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
            },
          },
      autoLogging: true,
    },
  };
};
