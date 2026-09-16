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

### 3. Install Dependencies & Generate Prisma Client
Install all required node packages. The `postinstall` hook will automatically execute `npx prisma generate` to build your local Prisma Client types:
```bash
npm install
```

> **Note on Prisma Client Error in IDE:** If your editor (VSCode / Cursor) marks `@prisma/client` in red after installing, run `npx prisma generate` manually and execute the command **"TypeScript: Restart TS Server"** in your editor.

### 4. Start Infrastructure (PostgreSQL & Redis)
Spin up the PostgreSQL and Redis containers defined in `docker-compose.yml`:
```bash
docker compose up -d
```
To verify that both containers are running and healthy:
```bash
docker compose ps
```

### 5. Run Database Migrations (When schema changes exist)
Apply database migrations to your PostgreSQL instance:
```bash
npx prisma migrate dev
```

### 6. Start the Server in Development Mode
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

# Run unit tests
npm run test

# Run End-to-End (E2E) tests
npm run test:e2e
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
 │    ├── exceptions/           # Custom AppException & ErrorCodes enum
 │    └── middlewares/          # Security & Tracing Middlewares
 │         ├── tracing.context.ts          # AsyncLocalStorage for Correlation & Trace IDs
 │         ├── tracing.middleware.ts       # Global request tracing & ID injection
 │         └── required-headers.middleware.ts # Perimeter client header validation
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

## 🤝 Contribution & Git Guidelines

For branch naming rules, Conventional Commits standard, and Pull Request workflow, please refer to our [Contributing & Git Workflow Guide](CONTRIBUTING.md).

For AI Assistants and LLMs working on this codebase, refer to [.github/SYSTEM_PROMPT.md](.github/SYSTEM_PROMPT.md).

---

## 📜 License

This project is [MIT licensed](LICENSE).
