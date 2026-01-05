import { initTRPC, TRPCError } from "@trpc/server";
import type { SchemaDef, GetModels } from "@zenstackhq/orm/schema";
import type {
  FindManyArgs,
  FindUniqueArgs,
  FindFirstArgs,
  CreateArgs,
  CreateManyArgs,
  UpdateArgs,
  UpdateManyArgs,
  UpsertArgs,
  DeleteArgs,
  DeleteManyArgs,
  CountArgs,
  AggregateArgs,
  GroupByArgs,
  SimplifiedPlainResult,
} from "@zenstackhq/orm";
import { z } from "zod";
import { createModelSchemas } from "./zod-schemas.js";

/**
 * Context type for the tRPC router
 * The db property accepts any ZenStack client instance
 */
export interface Context {
  db: any;
}

// Internal type for initTRPC result
const _initTRPCResult = initTRPC.context<Context>().create();

/**
 * Type representing the result of initTRPC.context().create()
 */
export type TRPCInstance = typeof _initTRPCResult;

/**
 * Creates a tRPC instance with the given context
 * @returns A tRPC instance configured with your context type
 */
export function createTRPC<TContext extends Context>(): TRPCInstance {
  return initTRPC.context<TContext>().create() as unknown as TRPCInstance;
}

/**
 * Type helper to convert model names to lowercase
 */
type Uncapitalize<S extends string> = S extends `${infer First}${infer Rest}`
  ? `${Lowercase<First>}${Rest}`
  : S;

/**
 * Type for a single model's procedures - provides FULL dynamic input AND output typing
 *
 * When you pass `include` or `select`, the return type automatically includes those fields!
 */
export interface TypedModelProcedures<
  Schema extends SchemaDef,
  Model extends GetModels<Schema>
> {
  /**
   * Find multiple records
   * @example
   * // Returns User[] with posts included
   * const users = await caller.user.findMany({ include: { posts: true } });
   */
  findMany<T extends FindManyArgs<Schema, Model>>(
    input?: T
  ): Promise<SimplifiedPlainResult<Schema, Model, T>[]>;

  /**
   * Find a unique record by ID or unique field
   */
  findUnique<T extends FindUniqueArgs<Schema, Model>>(
    input: T
  ): Promise<SimplifiedPlainResult<Schema, Model, T> | null>;

  /**
   * Find the first matching record
   */
  findFirst<T extends FindFirstArgs<Schema, Model>>(
    input?: T
  ): Promise<SimplifiedPlainResult<Schema, Model, T> | null>;

  /**
   * Create a new record
   */
  create<T extends CreateArgs<Schema, Model>>(
    input: T
  ): Promise<SimplifiedPlainResult<Schema, Model, T>>;

  /**
   * Create multiple records
   */
  createMany(
    input: CreateManyArgs<Schema, Model>
  ): Promise<{ count: number }>;

  /**
   * Update a record
   */
  update<T extends UpdateArgs<Schema, Model>>(
    input: T
  ): Promise<SimplifiedPlainResult<Schema, Model, T>>;

  /**
   * Update multiple records
   */
  updateMany(
    input: UpdateManyArgs<Schema, Model>
  ): Promise<{ count: number }>;

  /**
   * Create or update a record
   */
  upsert<T extends UpsertArgs<Schema, Model>>(
    input: T
  ): Promise<SimplifiedPlainResult<Schema, Model, T>>;

  /**
   * Delete a record
   */
  delete<T extends DeleteArgs<Schema, Model>>(
    input: T
  ): Promise<SimplifiedPlainResult<Schema, Model, T>>;

  /**
   * Delete multiple records
   */
  deleteMany(
    input: DeleteManyArgs<Schema, Model>
  ): Promise<{ count: number }>;

  /**
   * Count records
   */
  count(input?: CountArgs<Schema, Model>): Promise<number>;

  /**
   * Aggregate records
   */
  aggregate(input: AggregateArgs<Schema, Model>): Promise<any>;

  /**
   * Group records
   */
  groupBy(input: GroupByArgs<Schema, Model>): Promise<any[]>;
}

/**
 * Type for the generated router caller - maps model names to their typed procedures
 *
 * This provides FULL type inference including:
 * - Input types (where, data, include, select, etc.)
 * - Output types that reflect include/select options
 *
 * @example
 * ```ts
 * const caller = appRouter.createCaller({ db }) as TypedRouterCaller<SchemaType>;
 *
 * // Basic query - returns User[]
 * const users = await caller.user.findMany();
 *
 * // With include - returns (User & { posts: Post[] })[]
 * const usersWithPosts = await caller.user.findMany({ include: { posts: true } });
 *
 * // With select - returns { id: string, email: string }[]
 * const userEmails = await caller.user.findMany({ select: { id: true, email: true } });
 * ```
 */
export type TypedRouterCaller<Schema extends SchemaDef> = {
  [K in GetModels<Schema> as Uncapitalize<K>]: TypedModelProcedures<Schema, K>;
};

/**
 * Creates procedures for a single model
 */
function createModelProcedures<Schema extends SchemaDef>(
  schema: Schema,
  modelName: string,
  t: TRPCInstance
) {
  const schemas = createModelSchemas(schema, modelName as keyof Schema["models"]);
  const modelNameLower = modelName.charAt(0).toLowerCase() + modelName.slice(1);

  const createHandler = (op: string, isQuery: boolean) => {
    const inputSchema = (schemas as any)[op] as z.ZodType;
    const handler = async ({ ctx, input }: { ctx: any; input: any }) => {
      const db = ctx.db as any;
      const model = db[modelNameLower];
      if (!model || typeof model[op] !== "function") {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Operation ${op} not found on model ${modelName}`,
        });
      }
      return model[op](input);
    };

    if (isQuery) {
      return t.procedure.input(inputSchema).query(handler);
    } else {
      return t.procedure.input(inputSchema).mutation(handler);
    }
  };

  const procedures = {
    findMany: createHandler("findMany", true),
    findUnique: createHandler("findUnique", true),
    findFirst: createHandler("findFirst", true),
    count: createHandler("count", true),
    aggregate: createHandler("aggregate", true),
    groupBy: createHandler("groupBy", true),
    create: createHandler("create", false),
    createMany: createHandler("createMany", false),
    update: createHandler("update", false),
    updateMany: createHandler("updateMany", false),
    upsert: createHandler("upsert", false),
    delete: createHandler("delete", false),
    deleteMany: createHandler("deleteMany", false),
  };

  return t.router(procedures);
}

/**
 * Creates a tRPC router from a ZenStack schema.
 *
 * The router follows the pattern: router.modelName.operation
 * Example: router.user.findMany(), router.post.create()
 *
 * For proper typing on the caller, use the TypedRouterCaller type:
 *
 * @example
 * ```ts
 * import { createZenStackRouter, createTRPC, Context, TypedRouterCaller } from './trpc';
 * import { schema, SchemaType } from '../zenstack/schema';
 *
 * const t = createTRPC<Context>();
 * const appRouter = createZenStackRouter(schema, t);
 *
 * // Create a typed caller with FULL type inference
 * const caller = appRouter.createCaller({ db }) as TypedRouterCaller<SchemaType>;
 *
 * // Types are fully inferred based on your query!
 * const users = await caller.user.findMany();
 * // ^? { id: string, email: string, name: string | null, ... }[]
 *
 * const usersWithPosts = await caller.user.findMany({ include: { posts: true } });
 * // ^? { id: string, email: string, ..., posts: Post[] }[]
 *
 * export type AppRouter = typeof appRouter;
 * ```
 */
export function createZenStackRouter<Schema extends SchemaDef>(
  schema: Schema,
  t: TRPCInstance
) {
  const modelRouters: Record<string, ReturnType<typeof createModelProcedures>> = {};

  // Get all model names from the schema
  const modelNames = Object.keys(schema.models);

  for (const modelName of modelNames) {
    const modelNameLower = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    modelRouters[modelNameLower] = createModelProcedures(schema, modelName, t);
  }

  return t.router(modelRouters);
}

/**
 * Type helper to extract the router type for a given schema
 */
export type ZenStackRouter<Schema extends SchemaDef> = ReturnType<
  typeof createZenStackRouter<Schema>
>;
