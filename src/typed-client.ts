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
import type { SimplifiedPlainResult } from "@zenstackhq/orm";
import type {
  UseQueryResult,
  UseMutationResult,
  UseMutationOptions,
  UseQueryOptions,
} from "@tanstack/react-query";
import type { TRPCClientErrorLike } from "@trpc/client";
import type {
  OperationArgs,
  ArrayOps,
  CountResultOps,
  NumberResultOps,
  AnyResultOps,
  NullableOps,
  MutationOps,
} from "./operations.js";

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
// React Query Utils Types
// =============================================================================

type Updater<T> = T | ((value: T) => T);

type QueryUtilsProcedure<Args, Data> = {
  invalidate(input?: Args, filters?: unknown, options?: unknown): Promise<void>;
  refetch(input?: Args, filters?: unknown, options?: unknown): Promise<void>;
  reset(input?: Args, filters?: unknown, options?: unknown): Promise<void>;
  cancel(input?: Args, filters?: unknown, options?: unknown): Promise<void>;
  fetch(input: Args, opts?: unknown): Promise<Data>;
  prefetch(input: Args, opts?: unknown): Promise<void>;
  ensureData(input: Args, opts?: unknown): Promise<Data>;
  getData(input?: Args): Data | undefined;
  setData(input: Args, updater: Updater<Data | undefined>, opts?: unknown): void;
  queryOptions(input: Args, opts?: unknown): unknown;
  infiniteQueryOptions(input: Args, opts?: unknown): unknown;
  fetchInfinite(input: Args, opts?: unknown): Promise<unknown>;
  prefetchInfinite(input: Args, opts?: unknown): Promise<void>;
  getInfiniteData(input?: Args): unknown;
  setInfiniteData(input: Args, updater: Updater<unknown>, opts?: unknown): void;
  [key: string]: unknown;
};

type MutationUtilsProcedure = {
  setMutationDefaults(options: unknown): void;
  getMutationDefaults(): unknown;
  isMutating(): number;
  [key: string]: unknown;
};

interface DynamicQueryUtils<S extends SchemaDef, M extends GetModels<S>, Args, Default, Arr extends boolean> {
  fetch<T extends Args>(input: T, opts?: unknown): Promise<Result<S, M, T, Default, Arr>>;
  prefetch<T extends Args>(input: T, opts?: unknown): Promise<void>;
  ensureData<T extends Args>(input: T, opts?: unknown): Promise<Result<S, M, T, Default, Arr>>;
  getData<T extends Args>(input?: T): Result<S, M, T, Default, Arr> | undefined;
  setData<T extends Args>(input: T, updater: Updater<Result<S, M, T, Default, Arr> | undefined>, opts?: unknown): void;
  invalidate<T extends Args>(input?: T, filters?: unknown, options?: unknown): Promise<void>;
  refetch<T extends Args>(input?: T, filters?: unknown, options?: unknown): Promise<void>;
  reset<T extends Args>(input?: T, filters?: unknown, options?: unknown): Promise<void>;
  cancel<T extends Args>(input?: T, filters?: unknown, options?: unknown): Promise<void>;
  queryOptions<T extends Args>(input: T, opts?: unknown): unknown;
  infiniteQueryOptions<T extends Args>(input: T, opts?: unknown): unknown;
  fetchInfinite<T extends Args>(input: T, opts?: unknown): Promise<unknown>;
  prefetchInfinite<T extends Args>(input: T, opts?: unknown): Promise<void>;
  getInfiniteData<T extends Args>(input?: T): unknown;
  setInfiniteData<T extends Args>(input: T, updater: Updater<unknown>, opts?: unknown): void;
  [key: string]: unknown;
}

interface SimpleQueryUtils<Args, Data> extends QueryUtilsProcedure<Args, Data> {}

type ReactUtilsProcedure<S extends SchemaDef, M extends GetModels<S>, Op extends keyof OperationArgs<S, M>> =
  Op extends MutationOps
    ? MutationUtilsProcedure
    : Op extends CountResultOps
      ? SimpleQueryUtils<OperationArgs<S, M>[Op], { count: number }>
      : Op extends NumberResultOps
        ? SimpleQueryUtils<OperationArgs<S, M>[Op], number>
        : Op extends AnyResultOps
          ? SimpleQueryUtils<OperationArgs<S, M>[Op], any>
          : Op extends 'groupBy'
            ? SimpleQueryUtils<OperationArgs<S, M>[Op], any[]>
            : DynamicQueryUtils<S, M, OperationArgs<S, M>[Op],
                Op extends NullableOps ? DefaultResult<S, M> | null : Op extends ArrayOps ? DefaultResult<S, M>[] : DefaultResult<S, M>,
                Op extends ArrayOps ? true : false>;

type RouterLevelUtils = {
  invalidate(input?: undefined, filters?: unknown, options?: unknown): Promise<void>;
};

type TypedReactModelUtils<S extends SchemaDef, M extends GetModels<S>> = RouterLevelUtils & {
  [Op in keyof OperationArgs<S, M>]: ReactUtilsProcedure<S, M, Op>;
};

export type TypedTRPCReactUtils<S extends SchemaDef> = {
  [K in GetModels<S> as Uncapitalize<K>]: TypedReactModelUtils<S, K>;
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
    ? { readonly __types: TypedTRPCReact<S>; readonly __utils: TypedTRPCReactUtils<S>; readonly __path: P }
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

/** Extract the utils types from an adapter */
type ExtractUtils<T> = T extends { readonly __utils: infer Utils } ? Utils : never;

/** Extract the path from an adapter */
type ExtractPath<T> = T extends { readonly __path: infer P } ? P : undefined;

type AnyFn = (...args: any[]) => any;
type IfAny<T, Y, N> = 0 extends 1 & T ? Y : N;
type Override<T, R> = Omit<T, keyof R> & R;
type UseUtilsReturn<TClient> = TClient extends { useUtils: AnyFn } ? ReturnType<TClient["useUtils"]> : Record<string, unknown>;
type BaseUtilsExtras = Record<string, unknown>;

type MergeUtils<TBase, Path extends string | undefined, TUtils> = IfAny<
  TBase,
  Path extends string ? ApplyAtPath<BaseUtilsExtras, Path, TUtils> : TUtils & BaseUtilsExtras,
  Path extends string ? ApplyAtPath<TBase & BaseUtilsExtras, Path, TUtils> : TBase & TUtils & BaseUtilsExtras
>;

type ApplyUtilsIfPresent<TBase, TClient, Path extends string | undefined, TUtils> = [TUtils] extends [never]
  ? TBase
  : Override<
      TBase,
      {
        useUtils: () => MergeUtils<UseUtilsReturn<TClient>, Path, TUtils>;
        useContext: () => MergeUtils<UseUtilsReturn<TClient>, Path, TUtils>;
      }
    >;

/** Apply the typed transformation to a client */
type ApplyTyped<TClient, T> =
  ExtractPath<T> extends string
    ? ApplyUtilsIfPresent<ApplyAtPath<TClient, ExtractPath<T>, ExtractTypes<T>>, TClient, ExtractPath<T>, ExtractUtils<T>>
    : ApplyUtilsIfPresent<ExtractTypes<T>, TClient, undefined, ExtractUtils<T>>;

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
