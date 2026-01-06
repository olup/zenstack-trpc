import { TRPCError } from "@trpc/server";
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
 * Minimal tRPC instance interface required by createZenStackRouter
 */
export interface TRPCInstance {
  procedure: {
    input: (schema: z.ZodType) => {
      query: (handler: (opts: { ctx: any; input: any }) => Promise<any>) => any;
      mutation: (handler: (opts: { ctx: any; input: any }) => Promise<any>) => any;
    };
  };
  router: (procedures: Record<string, any>) => any;
}

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
 * @example
 * ```ts
 * import { createZenStackRouter, ZenStackRouter } from 'zenstack-trpc';
 * import { initTRPC } from '@trpc/server';
 * import { schema, SchemaType } from './zenstack/schema';
 *
 * // Create your own tRPC instance with your context
 * const t = initTRPC.context<{ db: typeof dbClient }>().create();
 *
 * // Generate the router with full type inference
 * const appRouter = createZenStackRouter(schema, t);
 *
 * // Export the typed router for clients
 * export type AppRouter = typeof appRouter;
 *
 * // Client usage (with full type inference):
 * // const client = createTRPCClient<AppRouter>({ ... });
 * // const users = await client.user.findMany.query(); // Fully typed!
 * ```
 */
export function createZenStackRouter<
  Schema extends SchemaDef,
  TContext extends { db: any }
>(
  schema: Schema,
  t: TRPCInstance
): ZenStackRouter<Schema, TContext> {
  const modelRouters: Record<string, ReturnType<typeof createModelProcedures>> = {};

  // Get all model names from the schema
  const modelNames = Object.keys(schema.models);

  for (const modelName of modelNames) {
    const modelNameLower = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    modelRouters[modelNameLower] = createModelProcedures(schema, modelName, t);
  }

  return t.router(modelRouters) as ZenStackRouter<Schema, TContext>;
}

/**
 * Type for a query procedure with proper input/output typing
 * Matches tRPC's internal structure for type inference
 */
type TypedQueryProcedure<TInput, TOutput> = {
  _def: {
    $types: {
      input: TInput;
      output: TOutput;
    };
    procedure: true;
    type: 'query';
    meta: unknown;
    experimental_caller: boolean;
  };
};

/**
 * Type for a mutation procedure with proper input/output typing
 * Matches tRPC's internal structure for type inference
 */
type TypedMutationProcedure<TInput, TOutput> = {
  _def: {
    $types: {
      input: TInput;
      output: TOutput;
    };
    procedure: true;
    type: 'mutation';
    meta: unknown;
    experimental_caller: boolean;
  };
};

/**
 * Type for a single model's tRPC procedures (for client inference)
 * This maps each operation to its tRPC procedure type with proper input/output
 */
export type TRPCModelProcedures<
  Schema extends SchemaDef,
  Model extends GetModels<Schema>,
  TContext
> = {
  findMany: TypedQueryProcedure<
    FindManyArgs<Schema, Model> | undefined,
    SimplifiedPlainResult<Schema, Model, {}>[]
  >;
  findUnique: TypedQueryProcedure<
    FindUniqueArgs<Schema, Model>,
    SimplifiedPlainResult<Schema, Model, {}> | null
  >;
  findFirst: TypedQueryProcedure<
    FindFirstArgs<Schema, Model> | undefined,
    SimplifiedPlainResult<Schema, Model, {}> | null
  >;
  create: TypedMutationProcedure<
    CreateArgs<Schema, Model>,
    SimplifiedPlainResult<Schema, Model, {}>
  >;
  createMany: TypedMutationProcedure<
    CreateManyArgs<Schema, Model>,
    { count: number }
  >;
  update: TypedMutationProcedure<
    UpdateArgs<Schema, Model>,
    SimplifiedPlainResult<Schema, Model, {}>
  >;
  updateMany: TypedMutationProcedure<
    UpdateManyArgs<Schema, Model>,
    { count: number }
  >;
  upsert: TypedMutationProcedure<
    UpsertArgs<Schema, Model>,
    SimplifiedPlainResult<Schema, Model, {}>
  >;
  delete: TypedMutationProcedure<
    DeleteArgs<Schema, Model>,
    SimplifiedPlainResult<Schema, Model, {}>
  >;
  deleteMany: TypedMutationProcedure<
    DeleteManyArgs<Schema, Model>,
    { count: number }
  >;
  count: TypedQueryProcedure<
    CountArgs<Schema, Model> | undefined,
    number
  >;
  aggregate: TypedQueryProcedure<
    AggregateArgs<Schema, Model>,
    any
  >;
  groupBy: TypedQueryProcedure<
    GroupByArgs<Schema, Model>,
    any[]
  >;
};

/**
 * Type for the full router record that tRPC uses for inference
 */
export type ZenStackRouterRecord<Schema extends SchemaDef, TContext> = {
  [K in GetModels<Schema> as Uncapitalize<K>]: TRPCModelProcedures<Schema, K, TContext>;
};

/**
 * The typed router type that clients can use for proper inference
 */
export type ZenStackRouter<Schema extends SchemaDef, TContext = any> = {
  _def: {
    _config: {
      $types: {
        ctx: TContext;
        meta: object;
        errorShape: any;
        transformer: false;
      };
    };
    record: ZenStackRouterRecord<Schema, TContext>;
  };
  createCaller: (ctx: TContext) => TypedRouterCaller<Schema>;
};
