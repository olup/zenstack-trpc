# zenstack-trpc

Auto-generate fully type-safe tRPC routers from [ZenStack V3](https://zenstack.dev) schemas.

## Features

- **Zero codegen** - Router generated at runtime from schema metadata
- **Full type inference** - Input AND output types from your ZenStack schema
- **Dynamic result typing** - `include`/`select` options reflected in return types
- **Zod validation** - Runtime input validation built-in
- **All CRUD operations** - findMany, findUnique, create, update, delete, and more
- **Standard tRPC** - Works with all tRPC adapters (HTTP, WebSocket, Next.js, etc.)

## Installation

```bash
npm install zenstack-trpc @trpc/server @zenstackhq/orm zod
# or
pnpm add zenstack-trpc @trpc/server @zenstackhq/orm zod
# or
yarn add zenstack-trpc @trpc/server @zenstackhq/orm zod
```

## Quick Start

### 1. Define your ZenStack schema

```prisma
// schema.zmodel
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  posts     Post[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Post {
  id        String   @id @default(cuid())
  title     String
  content   String?
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 2. Generate ZenStack artifacts

```bash
npx zenstack generate
```

### 3. Create the tRPC router

```typescript
import { initTRPC } from "@trpc/server";
import { ZenStackClient } from "@zenstackhq/orm";
import { schema, SchemaType } from "./zenstack/schema.js";
import { createZenStackRouter, type TypedRouterCaller } from "zenstack-trpc";

// Create your database client
const db = new ZenStackClient(schema, {
  dialect: yourDialect, // Kysely dialect (SQLite, PostgreSQL, MySQL, etc.)
});

// Create your tRPC instance with your context
const t = initTRPC.context<{ db: typeof db }>().create();

// Generate the router from your schema
const appRouter = createZenStackRouter(schema, t);

// Export for client usage
export type AppRouter = typeof appRouter;
```

### 4. Use the router

```typescript
// Create a typed caller
const caller = appRouter.createCaller({ db }) as TypedRouterCaller<SchemaType>;

// All operations are fully typed!
const users = await caller.user.findMany();
//    ^? { id: string, email: string, name: string | null, ... }[]

// Include relations - return type automatically includes them
const usersWithPosts = await caller.user.findMany({
  include: { posts: true }
});
//    ^? { id: string, ..., posts: Post[] }[]

// Select specific fields
const emails = await caller.user.findMany({
  select: { id: true, email: true }
});
//    ^? { id: string, email: string }[]

// Create with full validation
const user = await caller.user.create({
  data: {
    email: "alice@example.com",
    name: "Alice",
  },
});

// Update with type-safe where clause
await caller.user.update({
  where: { id: user.id },
  data: { name: "Alice Smith" },
});
```

## API Reference

### `createZenStackRouter(schema, t)`

Generates a tRPC router from a ZenStack schema.

```typescript
import { initTRPC } from "@trpc/server";
import { createZenStackRouter } from "zenstack-trpc";

const t = initTRPC.context<{ db: any }>().create();
const appRouter = createZenStackRouter(schema, t);
```

### `TypedRouterCaller<SchemaType>`

Type helper for fully typed caller with dynamic input/output inference.

```typescript
import type { TypedRouterCaller } from "zenstack-trpc";
import type { SchemaType } from "./zenstack/schema.js";

const caller = appRouter.createCaller({ db }) as TypedRouterCaller<SchemaType>;
```

### `TypedModelProcedures<Schema, Model>`

Type helper for a single model's procedures.

```typescript
import type { TypedModelProcedures } from "zenstack-trpc";

type UserProcedures = TypedModelProcedures<SchemaType, "User">;
```

## Generated Router Structure

For each model in your schema, the following procedures are generated:

```
router
├── user
│   ├── findMany    (query)
│   ├── findUnique  (query)
│   ├── findFirst   (query)
│   ├── create      (mutation)
│   ├── createMany  (mutation)
│   ├── update      (mutation)
│   ├── updateMany  (mutation)
│   ├── upsert      (mutation)
│   ├── delete      (mutation)
│   ├── deleteMany  (mutation)
│   ├── count       (query)
│   ├── aggregate   (query)
│   └── groupBy     (query)
├── post
│   └── ... (same operations)
```

## Using with tRPC Adapters

### Standalone HTTP Server

```typescript
import { createHTTPServer } from "@trpc/server/adapters/standalone";

const server = createHTTPServer({
  router: appRouter,
  createContext: () => ({ db }),
});

server.listen(3000);
```

### Next.js App Router

```typescript
// app/api/trpc/[trpc]/route.ts
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => ({ db }),
  });

export { handler as GET, handler as POST };
```

### Express

```typescript
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

const app = express();

app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext: () => ({ db }),
  })
);
```

## Advanced Usage

### Custom Context

Extend the context with authentication or other data:

```typescript
interface MyContext {
  db: any;
  userId?: string;
}

const t = initTRPC.context<MyContext>().create();
const appRouter = createZenStackRouter(schema, t);

// In your adapter
createContext: (opts) => ({
  db: getEnhancedDb(opts.req), // ZenStack enhanced client with access control
  userId: getUserFromRequest(opts.req),
});
```

### Zod Schema Access

Access the generated Zod schemas for custom validation:

```typescript
import {
  createModelSchemas,
  createWhereSchema,
  createCreateDataSchema,
} from "zenstack-trpc";

const userSchemas = createModelSchemas(schema, "User");
const whereSchema = createWhereSchema(schema, "User");
```

## Requirements

- Node.js >= 18
- TypeScript >= 5.0
- ZenStack V3 (`@zenstackhq/orm` >= 3.0.0)
- tRPC >= 11.0.0
- Zod >= 3.0.0

## License

MIT
