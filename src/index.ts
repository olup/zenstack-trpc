/**
 * zenstack-trpc
 *
 * Auto-generate fully type-safe tRPC routers from ZenStack V3 schemas.
 *
 * @example
 * ```typescript
 * import { ZenStackClient } from "@zenstackhq/orm";
 * import { schema, SchemaType } from "./zenstack/schema.js";
 * import {
 *   createTRPC,
 *   createZenStackRouter,
 *   type Context,
 *   type TypedRouterCaller,
 * } from "zenstack-trpc";
 *
 * const db = new ZenStackClient(schema, { dialect: yourDialect });
 * const t = createTRPC<Context>();
 * const appRouter = createZenStackRouter(schema, t);
 *
 * // Create a typed caller with full type inference
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
  createTRPC,
  createZenStackRouter,
  type Context,
  type ZenStackRouter,
  type TypedRouterCaller,
  type TypedModelProcedures,
  type TRPCInstance,
} from "./router-generator.js";

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
