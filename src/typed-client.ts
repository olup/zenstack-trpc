/**
 * Typed tRPC client helpers for full include/select type inference.
 *
 * tRPC's standard type inference loses generic type information for procedure
 * input/output types. This module provides a composable type system that
 * restores full dynamic typing based on include/select options.
 *
 * @example
 * ```typescript
 * import { createTRPCReact } from "@trpc/react-query";
 * import { typedClient, type WithZenStack, type WithReact } from "zenstack-trpc";
 * import type { AppRouter } from "./server/trpc.js";
 * import type { SchemaType } from "./zenstack/schema.js";
 *
 * // Compose types and apply to client
 * type Typed = WithReact<WithZenStack<SchemaType>>;
 * const _trpc = createTRPCReact<AppRouter>();
 * export const trpc = typedClient<Typed>()(_trpc);
 *
 * // With nested namespace
 * type Typed = WithReact<WithZenStack<SchemaType, "db">>;
 * export const trpc = typedClient<Typed>()(_trpc);
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
import type {
  UseQueryResult,
  UseMutationResult,
  UseMutationOptions,
  UseQueryOptions,
} from "@tanstack/react-query";
import type { TRPCClientErrorLike } from "@trpc/client";

/** Convert model names to lowercase (internal utility, also used by router-generator) */
export type Uncapitalize<S extends string> = S extends `${infer F}${infer R}` ? `${Lowercase<F>}${R}` : S;

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

/** All client procedures for a model (internal) */
type TypedClientModelProcedures<S extends SchemaDef, M extends GetModels<S>> = {
  [Op in keyof OperationArgs<S, M>]: ClientProcedure<S, M, Op>;
};

// =============================================================================
// React Query / tRPC React Hook Types
// =============================================================================

/** tRPC hook result extension */
type TRPCHookResult = { trpc: { path: string } };

/** Query result with tRPC extension */
type TRPCQueryResult<TData, TError = TRPCClientErrorLike<any>> = UseQueryResult<TData, TError> & TRPCHookResult;

/** Mutation result with tRPC extension */
type TRPCMutationResult<TData, TError, TVariables, TContext = unknown> = UseMutationResult<TData, TError, TVariables, TContext> & TRPCHookResult;

/** Query options type */
type QueryOpts<TData, TError = TRPCClientErrorLike<any>> = Omit<UseQueryOptions<TData, TError, TData, any>, 'queryKey' | 'queryFn'>;

/** Mutation options type */
type MutationOpts<TData, TError, TVariables, TContext = unknown> = Omit<UseMutationOptions<TData, TError, TVariables, TContext>, 'mutationKey' | 'mutationFn'>;

/** Query hook - infers result from input */
interface DynamicQueryHook<S extends SchemaDef, M extends GetModels<S>, Args, Default, Arr extends boolean> {
  useQuery<T extends Args>(input: T, opts?: QueryOpts<Result<S, M, T, Default, Arr>>): TRPCQueryResult<Result<S, M, T, Default, Arr>>;
  useQuery(input?: undefined, opts?: QueryOpts<Default>): TRPCQueryResult<Default>;
}

/** Simple query hook - fixed result type */
interface SimpleQueryHook<Args, R> {
  useQuery(input?: Args, opts?: QueryOpts<R>): TRPCQueryResult<R>;
}

/** Mutation hook - infers result from input */
interface DynamicMutationHook<S extends SchemaDef, M extends GetModels<S>, Args, Default> {
  useMutation<TContext = unknown>(opts?: MutationOpts<Default, TRPCClientErrorLike<any>, Args, TContext>): TRPCMutationResult<Default, TRPCClientErrorLike<any>, Args, TContext>;
}

/** Simple mutation hook - fixed result type */
interface SimpleMutationHook<Args, R> {
  useMutation<TContext = unknown>(opts?: MutationOpts<R, TRPCClientErrorLike<any>, Args, TContext>): TRPCMutationResult<R, TRPCClientErrorLike<any>, Args, TContext>;
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

/** All React hooks for a model (internal) */
type TypedReactModelHooks<S extends SchemaDef, M extends GetModels<S>> = {
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
// Composable Type Utilities
// =============================================================================

/**
 * Base ZenStack type container. Use with adapter types like WithReact or WithClient.
 *
 * @example
 * ```typescript
 * // With React adapter:
 * type Typed = WithReact<WithZenStack<SchemaType, "generated">>;
 *
 * // With vanilla client adapter:
 * type Typed = WithClient<WithZenStack<SchemaType, "db">>;
 *
 * // At root level (no nesting):
 * type Typed = WithReact<WithZenStack<SchemaType>>;
 * ```
 */
export type WithZenStack<S extends SchemaDef, TPath extends string | undefined = undefined> = {
  readonly __schema: S;
  readonly __path: TPath;
};

/**
 * React Query adapter - transforms WithZenStack into tRPC React hook types.
 *
 * @example
 * ```typescript
 * type Typed = WithReact<WithZenStack<SchemaType, "generated">>;
 * const trpc = typedClient<Typed>()(_trpc);
 * ```
 */
export type WithReact<T extends WithZenStack<any, any>> =
  T extends WithZenStack<infer S, infer P>
    ? { readonly __types: TypedTRPCReact<S>; readonly __path: P }
    : never;

/**
 * Vanilla tRPC client adapter - transforms WithZenStack into vanilla client types.
 *
 * @example
 * ```typescript
 * type Typed = WithClient<WithZenStack<SchemaType, "db">>;
 * const client = typedClient<Typed>()(rawClient);
 * ```
 */
export type WithClient<T extends WithZenStack<any, any>> =
  T extends WithZenStack<infer S, infer P>
    ? { readonly __types: TypedTRPCClient<S>; readonly __path: P }
    : never;

/** Extract the final types from an adapter */
type ExtractTypes<T> = T extends { readonly __types: infer Types } ? Types : never;

/** Extract the path from an adapter */
type ExtractPath<T> = T extends { readonly __path: infer P } ? P : undefined;

/** Apply the typed transformation to a client */
type ApplyTyped<TClient, T> =
  ExtractPath<T> extends string
    ? ApplyAtPath<TClient, ExtractPath<T>, ExtractTypes<T>>
    : ExtractTypes<T>;

/**
 * Apply composed types to a tRPC client.
 *
 * @example
 * ```typescript
 * // Define composed types
 * type Typed = WithReact<WithZenStack<SchemaType, "generated">>;
 *
 * // Apply to client
 * const _trpc = createTRPCReact<AppRouter>();
 * export const trpc = typedClient<Typed>()(_trpc);
 * ```
 */
export function typedClient<T extends { readonly __types: any; readonly __path: any }>() {
  return <TClient>(client: TClient): ApplyTyped<TClient, T> => client as any;
}

// =============================================================================
// Deep Nesting Type Utilities
// =============================================================================

/** Recursively apply types at a nested path */
type ApplyAtPath<TClient, Path extends string, TTypes> =
  Path extends `${infer Head}.${infer Tail}`
    ? Omit<TClient, Head> & { [K in Head]: Head extends keyof TClient ? ApplyAtPath<TClient[Head], Tail, TTypes> : TTypes }
    : Omit<TClient, Path> & { [K in Path]: TTypes };
