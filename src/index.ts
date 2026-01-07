/**
 * zenstack-trpc
 *
 * Auto-generate fully type-safe tRPC routers from ZenStack V3 schemas.
 *
 * @example
 * ```typescript
 * import { initTRPC } from "@trpc/server";
 * import { ZenStackClient } from "@zenstackhq/orm";
 * import { schema, SchemaType } from "./zenstack/schema.js";
 * import { createZenStackRouter, type TypedRouterCaller } from "zenstack-trpc";
 *
 * // Create your tRPC instance with your context
 * const t = initTRPC.context<{ db: any }>().create();
 *
 * // Generate the router
 * const appRouter = createZenStackRouter(schema, t);
 *
 * // Create a typed caller with full type inference
 * const db = new ZenStackClient(schema, { dialect: yourDialect });
 * const caller = appRouter.createCaller({ db }) as TypedRouterCaller<SchemaType>;
 *
 * // All operations are fully typed!
 * const users = await caller.user.findMany({ include: { posts: true } });
 * ```
 *
 * @packageDocumentation
 */

// Router generator and types
export {
  createZenStackRouter,
  type ZenStackRouter,
  type ZenStackRouterRecord,
  type TypedRouterCaller,
  type TRPCInstance,
} from "./router-generator.js";

// Typed client helpers for full include/select inference
export {
  // Composable type system
  type WithZenStack,
  type WithReact,
  type WithClient,
  typedClient,
  // Underlying types (for custom adapters)
  type TypedTRPCClient,
  type TypedTRPCReact,
} from "./typed-client.js";

// Zod schema generators (for advanced usage)
export {
  createModelSchemas,
  createWhereSchema,
  createCreateDataSchema,
  createUpdateDataSchema,
  createUniqueWhereSchema,
  createSelectSchema,
  createIncludeSchema,
  createOrderBySchema,
} from "./zod-schemas.js";
