# CodeQuest DevTalles API 🚀

A robust, scalable, observable, and secure backend foundation built with **NestJS**, adhering to enterprise design patterns, PostgreSQL (Prisma ORM), Redis, and modern TypeScript standards.

---

## 📋 Prerequisites & Requirements

Before setting up the project locally, ensure you have the following installed on your machine:

- **Node.js**: `v22.x` or higher (Recommended via `nvm`)
- **npm**: `v10.x` or `v12.x`
- **Docker Desktop** or **Docker Engine** & **Docker Compose**
- **Git**

---

## 🚀 Step-by-Step Local Setup Guide

Follow these steps to get your local development environment up and running from scratch:

### 1. Clone the Repository
```bash
git clone <repository-url>
cd roadmap-challenge-backend
```

### 2. Configure Environment Variables
Copy the template `.env.example` file to create your local `.env` configuration:
```bash
cp .env.example .env
```
*(Optionally adjust `DATABASE_URL`, `REDIS_URL` or ports in `.env` if needed).*

### 3. Generate the JWT (RS256) Signing Keys
Access tokens are signed with an asymmetric RS256 key pair. Keys are **not** committed to the repo and are **not** read from disk at runtime — they live directly in `.env` as base64-encoded PEM content (`JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY`), so the same setup works unchanged on macOS, Linux, Windows, and containers, with no `openssl` binary or shared filesystem required.

Generate a fresh pair with the project's own Node script (uses the native `crypto` module):
```bash
npm run generate:jwt-keys
```
This prints two ready-to-paste lines:
```
JWT_PRIVATE_KEY=<base64...>
JWT_PUBLIC_KEY=<base64...>
```
Copy both into your `.env` (replacing any placeholder values already there). Each developer/environment should generate its **own** pair — do not share or reuse the same keys across environments.

> **Note:** you need at least a placeholder value for `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` in `.env` before the app can boot — env validation (Zod) will fail-fast otherwise.

### 4. Install Dependencies & Generate Prisma Client
Install all required node packages. The `postinstall` hook will automatically execute `npx prisma generate` to build your local Prisma Client types:
```bash
npm install
```

> **Note on Prisma Client Error in IDE:** If your editor (VSCode / Cursor) marks `@prisma/client` in red after installing, run `npx prisma generate` manually and execute the command **"TypeScript: Restart TS Server"** in your editor. (`build`, `start`, `start:dev` and the `test*` scripts already run `prisma generate` for you automatically via `pre*` hooks, so this only affects IDE type-checking.)

### 5. Start Infrastructure (PostgreSQL & Redis)
Spin up the PostgreSQL and Redis containers defined in `docker-compose.yml`:
```bash
docker compose up -d
```
To verify that both containers are running and healthy:
```bash
docker compose ps
```

### 6. Run Database Migrations (When schema changes exist)
Apply database migrations to your PostgreSQL instance:
```bash
npx prisma migrate dev
```

### 7. Seed Business Domain (RBAC + Catalog + Questionnaire + Demo Graph)
Populates the base roles (`ADMIN`, `USER`, `SYSTEM`), the base permission set, their role↔permission grants (`USER` gets `catalog:read` + `paths:read/create/update/delete`), a base admin user, a 24-course DevTalles catalog, a 5-question profiling questionnaire (one `isActive:false` for filter testing), and a demo `LearningPath` DAG (6 nodes / 6 edges with an optional branch) assigned to the admin (idempotent - safe to re-run):
```bash
npm run db:seed
```
Admin identity is controlled via `SEED_ADMIN_EMAIL` / `SEED_ADMIN_USERNAME` in `.env`.

### 8. Start the Server in Development Mode
Run the NestJS application with hot-reload enabled:
```bash
npm run start:dev
```

Once started:
- 🌐 **API Base URL**: `http://localhost:3000/api/v1`
- 📚 **Swagger OpenAPI Docs**: `http://localhost:3000/api/docs`

---

## 🛠️ Common Utility Commands

```bash
# Compile TypeScript project for production
npm run build

# Start production server
npm run start:prod

# Open Prisma Studio (Database GUI Viewer)
npx prisma studio
# Physical removal bypassing soft-delete (singular `delete` is logical)
# Usage from code: prisma.$hardDelete('course', { slug })

# Run unit tests
npm run test

# Run End-to-End (E2E) tests
npm run test:e2e

# Generate a fresh RS256 JWT key pair (prints base64 lines to paste into .env)
npm run generate:jwt-keys

# Seed RBAC + catalog + questionnaire + demo learning path (idempotent)
npm run db:seed
```

---

## 🏗️ Architecture Overview

The application follows a **Modular Monolith** structure:

```text
src/
 ├── core/                      # Global infrastructure & cross-cutting concerns
 │    ├── cache/                # Redis Global Module (ioredis)
 │    ├── config/               # Environment schema validation (Zod fail-fast)
 │    ├── database/             # Prisma Service & Global Database Module
 │    ├── filters/              # Global Exception Filters (Unified JSON response)
 │    ├── interceptors/         # Response Envelope Transformer
 │    ├── logger/               # Profile-based logger factory (Pino)
 │    └── swagger/              # OpenAPI documentation configuration
 │
 ├── common/                    # Shared utilities, middlewares, and DTOs
 │    ├── cache/                # Shared Redis key-naming (session & role-permissions cache)
 │    ├── decorators/           # @IsPublic(), @RequirePermissions(...)
 │    ├── exceptions/           # Custom AppException & ErrorCodes enum
 │    ├── guards/                # JwtAuthGuard (Zero Trust) & PermissionsGuard (dynamic RBAC)
 │    └── middlewares/          # Security & Tracing Middlewares
 │         ├── tracing.context.ts          # AsyncLocalStorage for Correlation/Trace IDs + auth principal
 │         ├── tracing.middleware.ts       # Global request tracing & ID injection
 │         └── required-headers.middleware.ts # Perimeter client header validation
 │
 ├── modules/                   # Isolated business modules
 │    ├── auth/                 # RS256 JWT signing/verification, JWKS endpoint, Passport strategy
 │    │    ├── keys/            # JwtKeysService/JwtKeysModule (loads key pair from env)
 │    │    └── strategies/      # JwtStrategy (passport-jwt)
 │    ├── rbac/                 # Dynamic RBAC: Role/Permission CRUD, assignment, cache invalidation
 │    ├── paths/                # Learning paths module (Phase 2 target)
 │    └── catalog/              # Catalog management module (Phase 2 target)
 │
 ├── app.module.ts              # Root application module
 └── main.ts                    # Bootstrap entry point (Helmet, CORS, Pipes, Swagger)
```

### 🔐 Identity, Sessions & RBAC

- **JWT**: access tokens are RS256-signed (`modules/auth`). Public key is also exposed as JWK at `GET /.well-known/jwks.json` for external verifiers.
- **Zero Trust**: every route requires a valid token by default (`JwtAuthGuard`, global). Opt out per-route/controller with `@IsPublic()`.
- **Session cache**: on each request, `JwtAuthGuard` resolves the caller (Cache-Aside against Redis, key `session:{userId}:{jti}`, TTL bounded by the token's own `exp`) and injects `{ userId, username, roleId }` into the request-scoped `AsyncLocalStorage` (`tracingContext`) - no parameter drilling needed downstream.
- **Dynamic RBAC**: annotate a route with `@RequirePermissions('resource:action')`; `PermissionsGuard` checks the caller's role permissions (Cache-Aside against Redis, key `role_permissions:{roleId}`, 1h TTL, invalidated automatically by `modules/rbac` on any role/permission mutation).
- Keys, TTLs and cache windows are all configurable via env vars - see `.env.example` and `src/core/config/env.validation.ts`.

### 🔑 Authentication (local + Discord OAuth2)

- **`POST /auth/register`** / **`POST /auth/login`**: email/password auth, passwords hashed with Argon2. Both issue a `{ accessToken, refreshToken }` pair.
- **`POST /auth/refresh`**: refresh token rotation - each refresh token is single-use; refreshing revokes the old one and issues a new pair. Reusing an already-rotated token is rejected (`INVALID_REFRESH_TOKEN`).
- **`GET /auth/discord`** / **`GET /auth/discord/callback`**: Discord OAuth2 (Federated Identity via `UserAccount`). New Discord logins auto-link to an existing account with the same email, or create a new one. The callback redirects to `${FRONTEND_URL}/auth/callback?token=...&refreshToken=...`.
- **Discord denial**: if the user presses Cancel (or the flow fails), the callback redirects to `${FRONTEND_URL}/auth/callback?error=access_denied&error_description=...` instead of showing a backend error page - the SPA owns the denial UX, parse `error` from the query string.
- **`GET /users/me`**: the authenticated user's own profile (role + linked provider accounts).
- **Refresh tokens are opaque, not JWTs** - stored as `argon2` hashes in `RefreshToken`, referenced by the client as `{recordId}.{secret}` (a selector/verifier pair) for O(1) lookup without ever storing the secret in plaintext.
- **Concurrent session cap**: `MAX_ACTIVE_SESSIONS_PER_USER` (default 5) bounds how many active refresh tokens (devices/browsers) a user can hold at once - logging in beyond the cap evicts the oldest session(s) first.
- Register/login/refresh flows run inside `@Transactional()` (see `core/database/transactional.decorator.ts`) so user/account creation and session issuance always commit or roll back together.

---

## 🤝 Contribution & Git Guidelines

For branch naming rules, Conventional Commits standard, and Pull Request workflow, please refer to our [Contributing & Git Workflow Guide](CONTRIBUTING.md).

For AI Assistants and LLMs working on this codebase, refer to [.github/SYSTEM_PROMPT.md](.github/SYSTEM_PROMPT.md).

---

## 📜 License

This project is [MIT licensed](LICENSE).
