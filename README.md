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

### `createZenStackRouter(schema, t, options?)`

Generates a tRPC router from a ZenStack schema.

```typescript
import { initTRPC } from "@trpc/server";
import { createZenStackRouter } from "zenstack-trpc";

const t = initTRPC.context<{ db: any }>().create();
const appRouter = createZenStackRouter(schema, t);
```

Pass a custom base procedure to apply middleware (e.g., auth) to all generated routes:

```typescript
import { TRPCError } from "@trpc/server";

const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx });
});

const appRouter = createZenStackRouter(schema, t, {
  procedure: protectedProcedure,
});
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

### `ZenStackRouter<Schema>` and `ZenStackRouterRecord<Schema>`

Type helpers for the generated router structure:

- **`ZenStackRouter<Schema>`** - The full router type including `_def` and `createCaller`
- **`ZenStackRouterRecord<Schema>`** - Just the procedure map (useful for type composition)

```typescript
import type { ZenStackRouter, ZenStackRouterRecord } from "zenstack-trpc";
import type { SchemaType } from "./zenstack/schema.js";

// The full router type
type MyRouter = ZenStackRouter<SchemaType>;

// Just the procedures (for advanced type manipulation)
type Procedures = ZenStackRouterRecord<SchemaType>;
// { user: { findMany: ..., create: ..., ... }, post: { ... }, ... }
```

### Composable Type System

The library provides a composable type system for adding full `include`/`select` type inference to tRPC clients. This solves tRPC's limitation where generic type information is lost during type inference.

The system uses three composable parts:
1. **`WithZenStack<Schema, Path?>`** - Base type container with your schema and optional nesting path
2. **`WithReact<...>` / `WithClient<...>`** - Adapter that transforms to React hooks or vanilla client types
3. **`typedClient<Typed>()`** - Applies the composed types to your client

```typescript
import { createTRPCReact } from "@trpc/react-query";
import { typedClient, type WithZenStack, type WithReact } from "zenstack-trpc";
import type { AppRouter } from "./server/trpc.js";
import type { SchemaType } from "./zenstack/schema.js";

// Compose your types
type Typed = WithReact<WithZenStack<SchemaType>>;

// Apply to client
const _trpc = createTRPCReact<AppRouter>();
export const trpc = typedClient<Typed>()(_trpc);

// Now includes are fully typed!
const { data } = trpc.user.findMany.useQuery({
  include: { posts: true }
});
// data is typed as (User & { posts: Post[] })[] | undefined
```

For vanilla tRPC clients, use `WithClient`:

```typescript
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { typedClient, type WithZenStack, type WithClient } from "zenstack-trpc";

type Typed = WithClient<WithZenStack<SchemaType>>;

const _client = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: "http://localhost:3000/trpc" })],
});
export const client = typedClient<Typed>()(_client);

const usersWithPosts = await client.user.findMany.query({
  include: { posts: true }
});
// Type: (User & { posts: Post[] })[]
```

### Nested Namespaces (Merged Routers)

When merging the ZenStack router with other routers, you need to cast it to `AnyRouter` for tRPC compatibility:

```typescript
import { initTRPC } from "@trpc/server";
import type { AnyRouter } from "@trpc/server";
import { createZenStackRouter } from "zenstack-trpc";
import { schema } from "./zenstack/schema.js";

const t = initTRPC.context<{ db: any }>().create();

// Create the ZenStack router and cast for tRPC compatibility
const generatedRouter = createZenStackRouter(schema, t) as unknown as AnyRouter;

// Merge with other routers
export const appRouter = t.router({
  admin: adminRouter,
  auth: authRouter,
  generated: generatedRouter,
});
```

On the client side, include the path in `WithZenStack` to get full type inference:

```typescript
import { createTRPCReact } from "@trpc/react-query";
import { typedClient, type WithZenStack, type WithReact } from "zenstack-trpc";
import type { AppRouter } from "./server/trpc.js";
import type { SchemaType } from "./zenstack/schema.js";

// Single level nesting:
type Typed = WithReact<WithZenStack<SchemaType, "generated">>;
const _trpc = createTRPCReact<AppRouter>();
export const trpc = typedClient<Typed>()(_trpc);

// Multi-level nesting (dot notation):
type Typed = WithReact<WithZenStack<SchemaType, "api.db">>;
export const trpc = typedClient<Typed>()(_trpc);

// Now you can use:
// trpc.generated.user.findMany.useQuery({ include: { posts: true } }) // fully typed
// trpc.auth.login.useMutation() // other routers unaffected
// trpc.useUtils().generated.user.findMany.invalidate() // typed query utils
```

### Custom Adapters

The composable architecture allows third parties to create custom adapters. An adapter transforms `WithZenStack` into framework-specific types:

```typescript
import type { WithZenStack, TypedTRPCReact } from "zenstack-trpc";

// Example: Custom adapter for a hypothetical framework
type WithMyFramework<T extends WithZenStack<any, any>> =
  T extends WithZenStack<infer S, infer P>
    ? { readonly __types: MyFrameworkTypes<S>; readonly __path: P }
    : never;

// Usage:
type Typed = WithMyFramework<WithZenStack<SchemaType, "db">>;
const client = typedClient<Typed>()(myFrameworkClient);
```

### Direct Type Access

For advanced use cases, you can access the underlying types directly:

```typescript
import type { TypedTRPCClient, TypedTRPCReact } from "zenstack-trpc";

// Manual casting
const client = _client as unknown as TypedTRPCClient<SchemaType>;
const trpc = _trpc as unknown as TypedTRPCReact<SchemaType>;
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

### Optional (for React hooks)

- `@trpc/react-query` >= 11.0.0
- `@tanstack/react-query` >= 5.0.0

## License

MIT
