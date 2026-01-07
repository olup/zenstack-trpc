/**
 * Typed tRPC client helpers for full include/select type inference.
 *
 * tRPC's standard type inference loses generic type information for procedure
 * input/output types. This module provides type utilities that restore full
 * dynamic typing based on include/select options.
 *
 * @example
 * ```typescript
 * import { createTRPCClient } from "@trpc/client";
 * import { createTRPCReact } from "@trpc/react-query";
 * import { withZenStackTypes } from "zenstack-trpc";
 * import type { AppRouter } from "./server/trpc.js";
 * import type { SchemaType } from "./zenstack/schema.js";
 *
 * // Vanilla client
 * const client = withZenStackTypes<SchemaType>()(
 *   createTRPCClient<AppRouter>({ links: [...] })
 * );
 *
 * // React hooks
 * const trpc = withZenStackTypes<SchemaType>()(
 *   createTRPCReact<AppRouter>()
 * );
 * ```
 */

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

/** Convert model names to lowercase */
type Uncapitalize<S extends string> = S extends `${infer F}${infer R}` ? `${Lowercase<F>}${R}` : S;

/** Infer result type with optional array wrapping */
type Result<S extends SchemaDef, M extends GetModels<S>, T, D, Arr extends boolean = false> =
  Arr extends true
    ? (SimplifiedPlainResult<S, M, T> extends never ? D : SimplifiedPlainResult<S, M, T>[])
    : (SimplifiedPlainResult<S, M, T> extends never ? D : SimplifiedPlainResult<S, M, T>);

/** Default result type for a model */
type DefaultResult<S extends SchemaDef, M extends GetModels<S>> = SimplifiedPlainResult<S, M, {}>;

// =============================================================================
// Operation type mappings - single source of truth
// =============================================================================

/** Maps operation names to their ZenStack Args types */
type OperationArgs<S extends SchemaDef, M extends GetModels<S>> = {
  findMany: FindManyArgs<S, M>;
  findUnique: FindUniqueArgs<S, M>;
  findFirst: FindFirstArgs<S, M>;
  create: CreateArgs<S, M>;
  createMany: CreateManyArgs<S, M>;
  update: UpdateArgs<S, M>;
  updateMany: UpdateManyArgs<S, M>;
  upsert: UpsertArgs<S, M>;
  delete: DeleteArgs<S, M>;
  deleteMany: DeleteManyArgs<S, M>;
  count: CountArgs<S, M>;
  aggregate: AggregateArgs<S, M>;
  groupBy: GroupByArgs<S, M>;
};

/** Operations that return arrays */
type ArrayOps = 'findMany' | 'groupBy';

/** Operations that return { count: number } */
type CountResultOps = 'createMany' | 'updateMany' | 'deleteMany';

/** Operations that return number */
type NumberResultOps = 'count';

/** Operations that return any */
type AnyResultOps = 'aggregate';

/** Operations that return nullable results */
type NullableOps = 'findUnique' | 'findFirst';

/** Mutations (vs queries) */
type MutationOps = 'create' | 'createMany' | 'update' | 'updateMany' | 'upsert' | 'delete' | 'deleteMany';

// =============================================================================
// Vanilla tRPC Client Types
// =============================================================================

/** Query procedure - infers result from input */
interface DynamicQuery<S extends SchemaDef, M extends GetModels<S>, Args, Default, Arr extends boolean> {
  query<T extends Args>(input: T): Promise<Result<S, M, T, Default, Arr>>;
  query(input?: undefined): Promise<Default>;
}

/** Simple query - fixed result type */
interface SimpleQuery<Args, R> {
  query(input?: Args): Promise<R>;
}

/** Mutation procedure - infers result from input */
interface DynamicMutation<S extends SchemaDef, M extends GetModels<S>, Args, Default> {
  mutate<T extends Args>(input: T): Promise<Result<S, M, T, Default>>;
}

/** Simple mutation - fixed result type */
interface SimpleMutation<Args, R> {
  mutate(input: Args): Promise<R>;
}

/** Build client procedure type for an operation */
type ClientProcedure<S extends SchemaDef, M extends GetModels<S>, Op extends keyof OperationArgs<S, M>> =
  Op extends MutationOps
    ? Op extends CountResultOps
      ? SimpleMutation<OperationArgs<S, M>[Op], { count: number }>
      : DynamicMutation<S, M, OperationArgs<S, M>[Op], DefaultResult<S, M>>
    : Op extends NumberResultOps
      ? SimpleQuery<OperationArgs<S, M>[Op], number>
      : Op extends AnyResultOps
        ? SimpleQuery<OperationArgs<S, M>[Op], any>
        : Op extends 'groupBy'
          ? SimpleQuery<OperationArgs<S, M>[Op], any[]>
          : DynamicQuery<S, M, OperationArgs<S, M>[Op],
              Op extends NullableOps ? DefaultResult<S, M> | null : Op extends ArrayOps ? DefaultResult<S, M>[] : DefaultResult<S, M>,
              Op extends ArrayOps ? true : false>;

/** All client procedures for a model */
export type TypedClientModelProcedures<S extends SchemaDef, M extends GetModels<S>> = {
  [Op in keyof OperationArgs<S, M>]: ClientProcedure<S, M, Op>;
};

// =============================================================================
// React Query / tRPC React Hook Types
// =============================================================================

/** Base query result shape */
type QueryResult<T> = { data: T | undefined; error: Error | null; isLoading: boolean; isPending: boolean; isError: boolean; isSuccess: boolean; refetch: () => Promise<unknown>; [k: string]: unknown };

/** Base mutation result shape */
type MutationResult<T, V> = { data: T | undefined; error: Error | null; isLoading: boolean; isPending: boolean; isError: boolean; isSuccess: boolean; mutate: (v: V, o?: { onSuccess?: (d: T) => void; onError?: (e: Error) => void; onSettled?: () => void }) => void; mutateAsync: (v: V, o?: { onSuccess?: (d: T) => void; onError?: (e: Error) => void; onSettled?: () => void }) => Promise<T>; [k: string]: unknown };

/** Query hook - infers result from input */
interface DynamicQueryHook<S extends SchemaDef, M extends GetModels<S>, Args, Default, Arr extends boolean> {
  useQuery<T extends Args>(input: T, opts?: { enabled?: boolean; [k: string]: unknown }): QueryResult<Result<S, M, T, Default, Arr>>;
  useQuery(input?: undefined, opts?: { enabled?: boolean; [k: string]: unknown }): QueryResult<Default>;
}

/** Simple query hook - fixed result type */
interface SimpleQueryHook<Args, R> {
  useQuery(input?: Args, opts?: { enabled?: boolean; [k: string]: unknown }): QueryResult<R>;
}

/** Mutation hook - infers result from input */
interface DynamicMutationHook<S extends SchemaDef, M extends GetModels<S>, Args, Default> {
  useMutation(opts?: { onSuccess?: (d: any) => void; onError?: (e: Error) => void; onSettled?: () => void; [k: string]: unknown }): {
    mutate: <T extends Args>(input: T, o?: { onSuccess?: (d: Result<S, M, T, Default>) => void; onError?: (e: Error) => void; onSettled?: () => void }) => void;
    mutateAsync: <T extends Args>(input: T, o?: { onSuccess?: (d: Result<S, M, T, Default>) => void; onError?: (e: Error) => void; onSettled?: () => void }) => Promise<Result<S, M, T, Default>>;
    data: Default | undefined; error: Error | null; isLoading: boolean; isPending: boolean; isError: boolean; isSuccess: boolean; [k: string]: unknown;
  };
}

/** Simple mutation hook - fixed result type */
interface SimpleMutationHook<Args, R> {
  useMutation(opts?: { onSuccess?: (d: R) => void; onError?: (e: Error) => void; onSettled?: () => void; [k: string]: unknown }): MutationResult<R, Args>;
}

/** Build React hook type for an operation */
type ReactHook<S extends SchemaDef, M extends GetModels<S>, Op extends keyof OperationArgs<S, M>> =
  Op extends MutationOps
    ? Op extends CountResultOps
      ? SimpleMutationHook<OperationArgs<S, M>[Op], { count: number }>
      : DynamicMutationHook<S, M, OperationArgs<S, M>[Op], DefaultResult<S, M>>
    : Op extends NumberResultOps
      ? SimpleQueryHook<OperationArgs<S, M>[Op], number>
      : Op extends AnyResultOps
        ? SimpleQueryHook<OperationArgs<S, M>[Op], any>
        : Op extends 'groupBy'
          ? SimpleQueryHook<OperationArgs<S, M>[Op], any[]>
          : DynamicQueryHook<S, M, OperationArgs<S, M>[Op],
              Op extends NullableOps ? DefaultResult<S, M> | null : Op extends ArrayOps ? DefaultResult<S, M>[] : DefaultResult<S, M>,
              Op extends ArrayOps ? true : false>;

/** All React hooks for a model */
export type TypedReactModelHooks<S extends SchemaDef, M extends GetModels<S>> = {
  [Op in keyof OperationArgs<S, M>]: ReactHook<S, M, Op>;
};

// =============================================================================
// Main Type Helpers
// =============================================================================

/** Typed vanilla tRPC client with full include/select type inference */
export type TypedTRPCClient<S extends SchemaDef> = {
  [K in GetModels<S> as Uncapitalize<K>]: TypedClientModelProcedures<S, K>;
};

/** Typed tRPC React hooks with full include/select type inference */
export type TypedTRPCReact<S extends SchemaDef> = {
  [K in GetModels<S> as Uncapitalize<K>]: TypedReactModelHooks<S, K>;
};

// =============================================================================
// Type Converter Utilities
// =============================================================================

/** Detect if client is React-based */
type IsReactClient<T> = T extends { useQuery: any } | { useMutation: any } ? true : false;

/** Get the appropriate types based on client type */
type InferClientTypes<S extends SchemaDef, T> =
  IsReactClient<T> extends true ? TypedTRPCReact<S> : TypedTRPCClient<S>;

/** Result type with optional path application */
type WithZenStackResult<S extends SchemaDef, T, TPath extends string | undefined> =
  TPath extends string
    ? ApplyAtPath<T, TPath, InferClientTypes<S, T>>
    : InferClientTypes<S, T>;

/**
 * Converts a tRPC client or React hooks instance to a fully typed version
 * with include/select inference. This is a type-only transformation.
 *
 * Supports optional path parameter for nested namespaces with dot notation.
 *
 * @example
 * ```typescript
 * // For vanilla tRPC client (root level):
 * const client = withZenStackTypes<SchemaType>()(createTRPCClient<AppRouter>({ links: [...] }));
 *
 * // For tRPC React hooks (root level):
 * const trpc = withZenStackTypes<SchemaType>()(createTRPCReact<AppRouter>());
 *
 * // With nested namespace (single level):
 * const trpc = withZenStackTypes<SchemaType>('db')(createTRPCReact<AppRouter>());
 *
 * // With nested namespace (multi-level):
 * const trpc = withZenStackTypes<SchemaType>('api.db')(createTRPCReact<AppRouter>());
 * ```
 */
export function withZenStackTypes<S extends SchemaDef, TPath extends string | undefined = undefined>(_path?: TPath) {
  return <T>(client: T): WithZenStackResult<S, T, TPath> => {
    return client as any;
  };
}

/**
 * Type utility to add ZenStack types to a nested namespace within a tRPC client.
 *
 * @example
 * ```typescript
 * type TypedTRPC = Omit<typeof _trpc, 'db'> & { db: WithZenStackTypes<SchemaType, 'react'> };
 * export const trpc = _trpc as unknown as TypedTRPC;
 * ```
 */
export type WithZenStackTypes<S extends SchemaDef, Mode extends 'client' | 'react' = 'react'> =
  Mode extends 'react' ? TypedTRPCReact<S> : TypedTRPCClient<S>;

// =============================================================================
// Deep Nesting Type Utilities
// =============================================================================

/** Split a dot-separated path into head and tail */
type SplitPath<P extends string> = P extends `${infer Head}.${infer Tail}` ? [Head, Tail] : [P, never];

/** Recursively apply types at a nested path */
type ApplyAtPath<TClient, Path extends string, TTypes> =
  SplitPath<Path> extends [infer Head extends string, infer Tail]
    ? Tail extends never
      ? Omit<TClient, Head> & { [K in Head]: TTypes }
      : Omit<TClient, Head> & { [K in Head]: Head extends keyof TClient ? ApplyAtPath<TClient[Head], Tail & string, TTypes> : TTypes }
    : TClient;

/**
 * Helper function to type a nested namespace within your tRPC React hooks.
 * Supports dot-notation for deep nesting.
 *
 * @example
 * ```typescript
 * // Single level nesting
 * export const trpc = withNestedZenStackReact<SchemaType, typeof _trpc, 'db'>('db')(_trpc);
 *
 * // Multi-level nesting
 * export const trpc = withNestedZenStackReact<SchemaType, typeof _trpc, 'api.db'>('api.db')(_trpc);
 * ```
 */
export function withNestedZenStackReact<S extends SchemaDef, TClient, TPath extends string>(_path: TPath) {
  return (client: TClient): ApplyAtPath<TClient, TPath, TypedTRPCReact<S>> => client as any;
}

/**
 * Helper function to type a nested namespace within your vanilla tRPC client.
 * Supports dot-notation for deep nesting.
 *
 * @example
 * ```typescript
 * // Single level nesting
 * export const client = withNestedZenStackClient<SchemaType, typeof _client, 'db'>('db')(_client);
 *
 * // Multi-level nesting
 * export const client = withNestedZenStackClient<SchemaType, typeof _client, 'api.db'>('api.db')(_client);
 * ```
 */
export function withNestedZenStackClient<S extends SchemaDef, TClient, TPath extends string>(_path: TPath) {
  return (client: TClient): ApplyAtPath<TClient, TPath, TypedTRPCClient<S>> => client as any;
}
