import { TRPCError } from "@trpc/server";
import type {
  AnyRouter,
  TRPCQueryProcedure,
  TRPCMutationProcedure,
} from "@trpc/server";
import type { SchemaDef, GetModels } from "@zenstackhq/orm/schema";
import type { SimplifiedPlainResult } from "@zenstackhq/orm";
import { z } from "zod";
import { createModelSchemas } from "./zod-schemas.js";
import type { Uncapitalize } from "./typed-client.js";
import type {
  OperationArgs,
  CountResultOps,
  NumberResultOps,
  AnyResultOps,
  MutationOps,
} from "./operations.js";

/**
 * Type for a single model's procedures - provides FULL dynamic input AND output typing
 *
 * When you pass `include` or `select`, the return type automatically includes those fields!
 */
type DefaultResult<
  Schema extends SchemaDef,
  Model extends GetModels<Schema>
> = SimplifiedPlainResult<Schema, Model, {}>;

type CallerResultForOp<
  Schema extends SchemaDef,
  Model extends GetModels<Schema>,
  Op extends keyof OperationArgs<Schema, Model>,
  Args
> =
  Op extends "findMany"
    ? SimplifiedPlainResult<Schema, Model, Args>[]
    : Op extends "findUnique" | "findFirst"
      ? SimplifiedPlainResult<Schema, Model, Args> | null
      : Op extends CountResultOps
        ? { count: number }
        : Op extends NumberResultOps
          ? number
          : Op extends AnyResultOps
            ? any
            : Op extends "groupBy"
              ? any[]
              : SimplifiedPlainResult<Schema, Model, Args>;

type ModelProcedure<
  Schema extends SchemaDef,
  Model extends GetModels<Schema>,
  Op extends keyof OperationArgs<Schema, Model>
> =
  Op extends "findMany"
    ? {
        <T extends OperationArgs<Schema, Model>[Op]>(
          input?: T
        ): Promise<CallerResultForOp<Schema, Model, Op, T>>;
        (
          input?: OperationArgs<Schema, Model>[Op] | undefined
        ): Promise<
          CallerResultForOp<Schema, Model, Op, {}>
        >;
      }
    : Op extends "findFirst"
      ? {
          <T extends OperationArgs<Schema, Model>[Op]>(
            input?: T
          ): Promise<CallerResultForOp<Schema, Model, Op, T>>;
          (
            input?: OperationArgs<Schema, Model>[Op] | undefined
          ): Promise<
            CallerResultForOp<Schema, Model, Op, {}>
          >;
        }
      : Op extends "count"
        ? (input?: OperationArgs<Schema, Model>[Op]) => Promise<number>
        : Op extends CountResultOps
          ? (input: OperationArgs<Schema, Model>[Op]) => Promise<{ count: number }>
          : Op extends AnyResultOps
            ? (input: OperationArgs<Schema, Model>[Op]) => Promise<any>
            : Op extends "groupBy"
              ? (input: OperationArgs<Schema, Model>[Op]) => Promise<any[]>
              : {
                  <T extends OperationArgs<Schema, Model>[Op]>(
                    input: T
                  ): Promise<CallerResultForOp<Schema, Model, Op, T>>;
                  (
                    input: OperationArgs<Schema, Model>[Op]
                  ): Promise<
                    CallerResultForOp<Schema, Model, Op, {}>
                  >;
                };

/**
 * Type for a single model's procedures - provides FULL dynamic input AND output typing
 *
 * When you pass `include` or `select`, the return type automatically includes those fields!
 */
export type TypedModelProcedures<
  Schema extends SchemaDef,
  Model extends GetModels<Schema>
> = {
  [Op in keyof OperationArgs<Schema, Model>]: ModelProcedure<Schema, Model, Op>;
};

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
      const result = await model[op](input);
      return result;
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

type ProcedureDef<TInput, TOutput> = {
  input: TInput;
  output: TOutput;
  meta: unknown;
};

type TypedQueryProcedure<TInput, TOutput> = TRPCQueryProcedure<
  ProcedureDef<TInput, TOutput>
>;

type TypedMutationProcedure<TInput, TOutput> = TRPCMutationProcedure<
  ProcedureDef<TInput, TOutput>
>;

type TRPCInputForOp<
  Schema extends SchemaDef,
  Model extends GetModels<Schema>,
  Op extends keyof OperationArgs<Schema, Model>
> =
  Op extends "findMany" | "findFirst" | "count"
    ? OperationArgs<Schema, Model>[Op] | undefined
    : OperationArgs<Schema, Model>[Op];

type TRPCOutputForOp<
  Schema extends SchemaDef,
  Model extends GetModels<Schema>,
  Op extends keyof OperationArgs<Schema, Model>
> =
  Op extends "findMany"
    ? DefaultResult<Schema, Model>[]
    : Op extends "findUnique" | "findFirst"
      ? DefaultResult<Schema, Model> | null
      : Op extends CountResultOps
        ? { count: number }
        : Op extends NumberResultOps
          ? number
          : Op extends AnyResultOps
            ? any
            : Op extends "groupBy"
              ? any[]
              : DefaultResult<Schema, Model>;

/**
 * Type for a single model's tRPC procedures (for client inference)
 * This maps each operation to its tRPC procedure type with proper input/output
 * @internal
 */
type TRPCModelProcedures<
  Schema extends SchemaDef,
  Model extends GetModels<Schema>
> = {
  [Op in keyof OperationArgs<Schema, Model>]: Op extends MutationOps
    ? TypedMutationProcedure<
        TRPCInputForOp<Schema, Model, Op>,
        TRPCOutputForOp<Schema, Model, Op>
      >
    : TypedQueryProcedure<
        TRPCInputForOp<Schema, Model, Op>,
        TRPCOutputForOp<Schema, Model, Op>
      >;
};

/**
 * Type for the full router record that tRPC uses for inference.
 * Use this type when nesting the ZenStack router within another router.
 */
export type ZenStackRouterRecord<Schema extends SchemaDef> = {
  [K in GetModels<Schema> as Uncapitalize<K>]: TRPCModelProcedures<Schema, K>;
};

/**
 * The typed router type that clients can use for proper inference.
 * Compatible with tRPC's AnyRouter for use in merged routers.
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
      transformer: any;
      errorFormatter: any;
      allowOutsideOfServer: boolean;
      isServer: boolean;
      isDev: boolean;
    };
    record: ZenStackRouterRecord<Schema>;
    router: true;
    procedures: ZenStackRouterRecord<Schema>;
    lazy: AnyRouter["_def"]["lazy"];
  };
  createCaller: (ctx: TContext) => TypedRouterCaller<Schema>;
} & ZenStackRouterRecord<Schema>;
