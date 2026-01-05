# zenstack-trpc

Auto-generate fully type-safe tRPC routers from [ZenStack V3](https://zenstack.dev) schemas.

## Features

- **Zero codegen** - Router generated at runtime from schema metadata
- **Full type inference** - Input AND output types from your ZenStack schema
- **Dynamic result typing** - `include`/`select` options reflected in return types
- **Zod validation** - Runtime input validation built-in
- **All CRUD operations** - findMany, findUnique, create, update, delete, and more
- **Standard tRPC** - Works with all tRPC adapters and clients

## Installation

```bash
npm install zenstack-trpc @trpc/server @zenstackhq/orm zod
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
// server/trpc.ts
import { initTRPC } from "@trpc/server";
import { ZenStackClient } from "@zenstackhq/orm";
import { schema } from "./zenstack/schema.js";
import { createZenStackRouter } from "zenstack-trpc";

// Create your database client
const db = new ZenStackClient(schema, {
  dialect: yourDialect, // Kysely dialect (SQLite, PostgreSQL, MySQL, etc.)
});

// Create your tRPC instance
const t = initTRPC.context<{ db: typeof db }>().create();

// Generate the router
export const appRouter = createZenStackRouter(schema, t);
export type AppRouter = typeof appRouter;
```

### 4. Use with tRPC client

```typescript
// client.ts
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "./server/trpc.js";

const client = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: "http://localhost:3000/trpc" })],
});

// All operations are fully typed!
const users = await client.user.findMany.query();

// Include relations
const usersWithPosts = await client.user.findMany.query({
  include: { posts: true },
});

// Create with validation
const user = await client.user.create.mutate({
  data: { email: "alice@example.com", name: "Alice" },
});

// Update
await client.user.update.mutate({
  where: { id: user.id },
  data: { name: "Alice Smith" },
});
```

## Generated Router Structure

For each model in your schema, the following procedures are generated:

| Queries | Mutations |
|---------|-----------|
| findMany | create |
| findUnique | createMany |
| findFirst | update |
| count | updateMany |
| aggregate | upsert |
| groupBy | delete |
| | deleteMany |

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

Type helper for server-side caller with full type inference.

```typescript
import type { TypedRouterCaller } from "zenstack-trpc";
import type { SchemaType } from "./zenstack/schema.js";

const caller = appRouter.createCaller({ db }) as TypedRouterCaller<SchemaType>;
```

### Zod Schema Access

Access the generated Zod schemas for custom validation:

```typescript
import { createModelSchemas, createWhereSchema } from "zenstack-trpc";

const userSchemas = createModelSchemas(schema, "User");
```

## Requirements

- Node.js >= 18
- ZenStack V3 (`@zenstackhq/orm` >= 3.0.0)
- tRPC >= 11.0.0
- Zod >= 3.0.0

## License

MIT
