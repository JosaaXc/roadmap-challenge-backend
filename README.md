# CodeQuest DevTalles API 🚀

A robust, scalable, observable, and secure backend foundation built with **NestJS**, adhering to enterprise design patterns and modern TypeScript standards.

---

## 🏗️ Architecture Overview

The application follows a **Modular Monolith** structure designed to seamlessly scale into microservices or expanded domain modules when business logic is introduced.

```text
src/
 ├── core/                      # Global infrastructure & cross-cutting configs
 │    ├── config/               # Environment schema validation (Zod fail-fast)
 │    ├── filters/              # Global exception filters (Unified JSON response)
 │    ├── logger/               # Profile-based logger factory (Pino)
 │    └── swagger/              # OpenAPI documentation configuration
 │
 ├── common/                    # Shared utilities, middlewares, and DTOs
 │    └── middlewares/          # Security & Tracing Middlewares
 │         ├── tracing.context.ts          # AsyncLocalStorage for Correlation & Trace IDs
 │         ├── tracing.middleware.ts       # Global request tracing & ID injection
 │         └── required-headers.middleware.ts # Strict perimeter client header validation
 │
 ├── modules/                   # Isolated business modules (Phase 2 targets)
 │    ├── auth/                 # Authentication & authorization module
 │    ├── paths/                # Learning paths module
 │    └── catalog/              # Catalog management module
 │
 ├── app.module.ts              # Root application module
 └── main.ts                    # Bootstrap entry point (Helmet, CORS, Pipes, Swagger)
```

---

## 🛡️ Core Features & Enterprise Standards

### 1. Fail-Fast Environment Validation (`Zod` + `@nestjs/config`)
- Aborts server boot immediately if required environment variables (`NODE_ENV`, `PORT`) are missing or malformed.

### 2. Profile-Based Structured Logging (`nestjs-pino`)
- **Development Profile (`NODE_ENV=development`)**: Granular `debug` log level with human-readable `pino-pretty` formatting.
- **Production Profile (`NODE_ENV=production`)**: High-performance JSON logging with `info` minimum log level for structured log aggregation.

### 3. Distributed Tracing & Observability
- **`x-correlation-id`**: Tracks the end-to-end business request flow across microservices.
- **`x-trace-id`**: Tracks individual HTTP request execution spans.
- Maintained via `AsyncLocalStorage` (`tracingContext`) and automatically attached to Pino loggers, response headers, and exception payloads.

### 4. Perimeter Security Middleware (`RequiredHeadersMiddleware`)
Enforces required client metadata for all `/api/v1/*` endpoints:
- `x-device-id`: Unique client device identifier.
- `x-app-version`: Mobile/Client application versioning.
- `x-device-os`: Operating system identifier.
- `x-latitude` & `x-longitude`: Mandatory geolocation metadata.
- `User-Agent` validation & IP extraction.

### 5. Global Exception Handling & Security
- **`GlobalExceptionFilter`**: Standardizes all 4xx/5xx errors into a clean JSON structure:
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
- **Helmet**: Secures HTTP headers against common web vulnerabilities.
- **Strict Validation Pipe**: Rejects un-whitelisted body attributes (`whitelist: true`, `forbidNonWhitelisted: true`).

### 6. OpenAPI / Swagger Documentation
- Auto-generated interactive API documentation available at `/api/docs` with Bearer Auth JWT support pre-configured.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `v22.x` or higher
- **npm**: `v10.x` or higher

### Installation
```bash
npm install
```

### Running the Application
```bash
# Development mode with hot-reload
npm run start:dev

# Production build
npm run build

# Start production server
npm run start:prod
```

### Running Tests
```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

---

## 📜 License

This project is [MIT licensed](LICENSE).
