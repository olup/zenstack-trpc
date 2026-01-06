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

Type helper for server-side caller with full type inference, including dynamic `include`/`select` result typing.

```typescript
import type { TypedRouterCaller } from "zenstack-trpc";
import type { SchemaType } from "./zenstack/schema.js";

const caller = appRouter.createCaller({ db }) as TypedRouterCaller<SchemaType>;

// Return type dynamically includes the posts relation!
const usersWithPosts = await caller.user.findMany({ include: { posts: true } });
// Type: (User & { posts: Post[] })[]
```

### `withZenStackTypes<SchemaType>()`

Utility function that adds full `include`/`select` type inference to any tRPC client. This solves tRPC's limitation where generic type information is lost during type inference.

Works with both vanilla tRPC clients and React hooks:

```typescript
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { withZenStackTypes } from "zenstack-trpc";
import type { AppRouter } from "./server/trpc.js";
import type { SchemaType } from "./zenstack/schema.js";

// For vanilla tRPC client:
const client = withZenStackTypes<SchemaType>()(
  createTRPCClient<AppRouter>({
    links: [httpBatchLink({ url: "http://localhost:3000/trpc" })],
  })
);

// Now includes are fully typed!
const usersWithPosts = await client.user.findMany.query({
  include: { posts: true }
});
// Type: (User & { posts: Post[] })[]

// For tRPC React hooks:
const trpc = withZenStackTypes<SchemaType>()(
  createTRPCReact<AppRouter>()
);

// In your component:
const { data } = trpc.user.findMany.useQuery({
  include: { posts: true }
});
// data is typed as (User & { posts: Post[] })[] | undefined
```

You can also use the type helpers directly if you prefer manual casting:

```typescript
import type { TypedTRPCClient, TypedTRPCReact } from "zenstack-trpc";

const client = _client as unknown as TypedTRPCClient<SchemaType>;
const trpc = _trpc as unknown as TypedTRPCReact<SchemaType>;
```

### Nested Namespaces (Merged Routers)

When your ZenStack router is merged under a namespace in your main router, use `WithZenStackTypes` or `withNestedZenStackTypes()`:

```typescript
// If your router structure is:
// appRouter = t.router({
//   db: zenStackRouter,  // ZenStack models under 'db' namespace
//   auth: authRouter,
// })

import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "./server/trpc.js";
import type { SchemaType } from "./zenstack/schema.js";
import type { WithZenStackTypes } from "zenstack-trpc";

const _trpc = createTRPCReact<AppRouter>();

// Option 1: Type helper for manual casting
type TypedTRPC = Omit<typeof _trpc, 'db'> & {
  db: WithZenStackTypes<SchemaType, 'react'>
};
export const trpc = _trpc as unknown as TypedTRPC;

// Option 2: Use the helper functions
import { withNestedZenStackReact, withNestedZenStackClient } from "zenstack-trpc";

// For React hooks:
export const trpc = withNestedZenStackReact<SchemaType, typeof _trpc, 'db'>('db')(_trpc);

// For vanilla tRPC client:
// export const client = withNestedZenStackClient<SchemaType, typeof _client, 'db'>('db')(_client);

// Now you can use:
// trpc.db.user.findMany.useQuery({ include: { posts: true } }) // fully typed
// trpc.auth.login.useMutation() // other routers unaffected
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
