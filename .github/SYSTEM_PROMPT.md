# CodeQuest DevTalles - System Architecture & Context

This document serves as persistent context and memory for AI Assistants (Cursor, GitHub Copilot, ChatGPT, Claude) working on this codebase.

---

## 🏛️ System Architecture Overview

The system is designed as a **Modular Monolith** in NestJS (v12, ESM, Node v22+). It balances clean module boundaries with zero cross-module coupling to allow straightforward migration into microservices if required in later phases.

```text
src/
 ├── core/                      # Core infrastructure (Cross-cutting concerns)
 │    ├── config/               # Zod-validated environment config (Fail-fast)
 │    ├── filters/              # Global Exception Filter (Unified JSON responses)
 │    ├── logger/               # Dynamic Pino Logger Factory (Profile-aware)
 │    └── swagger/              # OpenAPI setup
 │
 ├── common/                    # Shared utilities, middlewares, and context
 │    └── middlewares/
 │         ├── tracing.context.ts          # AsyncLocalStorage for tracing context
 │         ├── tracing.middleware.ts       # Correlation ID & Trace ID injection
 │         └── required-headers.middleware.ts # Strict perimeter headers guard
 │
 ├── modules/                   # Isolated Business Domains (Phase 2 targets)
 │    ├── auth/                 # Authentication & OAuth domain
 │    ├── paths/                # Learning paths domain
 │    └── catalog/              # Catalog management domain
 │
 ├── app.module.ts              # Root application module
 └── main.ts                    # Application entrypoint & HTTP server bootstrap
```

---

## ⚙️ Environment Profiles & Logging Strategy

Environment configuration is managed via `@nestjs/config` and validated at startup using **Zod** (`src/core/config/env.config.ts`). If mandatory variables are missing, the server aborts immediately (*fail-fast strategy*).

### Profiles (`NODE_ENV`)
1. **`development`**:
   - Log Level: `debug` (Includes verbose debug, info, warn, error logs).
   - Log Format: Pretty-printed via `pino-pretty` for developer console readability.
2. **`production`**:
   - Log Level: `info` (Filters out `debug` logs automatically).
   - Log Format: Raw JSON stream for log collectors (Datadog, CloudWatch, Loki).
3. **`test`**:
   - Execution context for automated tests.

---

## 🔍 Distributed Tracing & Observability

Every request entering the API is decorated with two distinct tracing identifiers via `TracingMiddleware` and stored in Node.js `AsyncLocalStorage`:

- **`x-correlation-id`**: End-to-end workflow identifier spanning multiple calls/services.
- **`x-trace-id`**: Unique request span identifier for the specific HTTP lifecycle.

Both identifiers are automatically injected into:
1. Outgoing HTTP response headers (`x-correlation-id`, `x-trace-id`).
2. Structured Pino logs (`correlationId`, `traceId`).
3. Standardized error responses emitted by `GlobalExceptionFilter`.

---

## 🛡️ Perimeter Security & Mandatory Headers

For all API endpoints under `/api/v1/*`, `RequiredHeadersMiddleware` executes Zod validation on request headers:

- **`x-device-id`**: Unique client device identifier.
- **`x-app-version`**: Client application version.
- **`x-device-os`**: Device OS (`ios`, `android`, `web`).
- **`x-latitude` & `x-longitude`**: Required client geolocation metadata.
- **`User-Agent`**: Required browser/client identification header.

*Note: Non-API routes (such as `/api/docs` for Swagger UI) bypass this guard to preserve developer experience.*

---

## 📋 Standardized Error Response Format

All unhandled or thrown `HttpException` instances are captured by `GlobalExceptionFilter` and formatted consistently:

```json
{
  "statusCode": 400,
  "timestamp": "2026-09-15T18:50:00.000Z",
  "path": "/api/v1/auth/login",
  "message": "Missing or invalid mandatory context headers.",
  "correlationId": "8f1a2b3c-...",
  "traceId": "9d8c7b6a-..."
}
```

---

## 🛠️ Codebase Guidelines for AI Agents

1. **Language & Comments**: All code comments, documentation, and commit messages MUST be written strictly in **English**.
2. **Strict Typing**: Enforce strict TypeScript types. Avoid using `any` unless strictly necessary for middleware extensions.
3. **Immutability**: Avoid mutating state in global singletons. Rely on NestJS Dependency Injection and `AsyncLocalStorage` for request context.
