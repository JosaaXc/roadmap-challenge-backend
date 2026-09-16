import { AsyncLocalStorage } from 'async_hooks';

export interface TracingContext {
  correlationId: string;
  traceId: string;
}

export const tracingContext = new AsyncLocalStorage<TracingContext>();
