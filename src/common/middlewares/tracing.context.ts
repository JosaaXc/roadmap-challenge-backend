import { AsyncLocalStorage } from 'async_hooks';

export interface AuthContext {
  userId: string;
  username: string;
  roleId: string;
}

export interface TracingContext {
  correlationId: string;
  traceId: string;
  auth?: AuthContext;
}

export const tracingContext = new AsyncLocalStorage<TracingContext>();

/**
 * Mutates the current request's tracing store with the authenticated
 * principal. Must be called from within a `tracingContext.run()` scope
 * (i.e. after TracingMiddleware has run), otherwise it is a no-op.
 */
export function setAuthContext(auth: AuthContext): void {
  const store = tracingContext.getStore();
  if (store) {
    store.auth = auth;
  }
}

export function getAuthContext(): AuthContext | undefined {
  return tracingContext.getStore()?.auth;
}
