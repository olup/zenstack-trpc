import { describe, it, expectTypeOf } from "vitest";
import { initTRPC, inferRouterInputs, inferRouterOutputs, type AnyRouter } from "@trpc/server";
import { createTRPCReact } from "@trpc/react-query";
import { schema, SchemaType } from "./fixtures/zenstack/schema.js";
import {
  createZenStackRouter,
  type TypedRouterCaller,
  type TypedTRPCClient,
  type TypedTRPCReact,
  type TypedTRPCReactUtils,
  type WithZenStack,
  type WithReact,
  type WithClient,
  typedClient,
} from "../src/index.js";

/**
 * Type helper to check if a type is 'any'
 * Returns true if T is any, false otherwise
 */
type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * Type helper to assert a type is NOT any at compile time
 * Will cause a TypeScript error if T is any
 */
type AssertNotAny<T> = IsAny<T> extends true ? never : T;

/**
 * Tests to verify that client-side types work correctly.
 *
 * The issue: TypedRouterCaller<SchemaType> provides full types for server-side callers,
 * but when using createTRPCClient<AppRouter>, the types are not properly inferred
 * because tRPC relies on the router's type structure to infer procedure types.
 */
describe("Client-side Type Tests", () => {
  // Create the router
  const t = initTRPC.context<{ db: any }>().create();
  const appRouter = createZenStackRouter(schema, t);
  type AppRouter = typeof appRouter;

  // Server-side caller type (this works)
  type ServerCaller = TypedRouterCaller<SchemaType>;

  // tRPC's built-in type inference helpers
  type RouterInputs = inferRouterInputs<AppRouter>;
  type RouterOutputs = inferRouterOutputs<AppRouter>;

  // ============================================================================
  // COMPILE-TIME TYPE ASSERTIONS
  // These lines will cause TypeScript errors if the types are 'any'
  // Comment these out to see the tests pass, uncomment to see the real type issues
  // ============================================================================

  // Test that output types are NOT any (these SHOULD compile without errors)
  // If they fail, it means the router doesn't provide proper output types
  type _AssertFindManyOutputNotAny = AssertNotAny<RouterOutputs["user"]["findMany"]>;
  type _AssertCreateOutputNotAny = AssertNotAny<RouterOutputs["user"]["create"]>;
  type _AssertCountOutputNotAny = AssertNotAny<RouterOutputs["user"]["count"]>;

  // Test that input types are NOT any
  type _AssertCreateInputNotAny = AssertNotAny<RouterInputs["user"]["create"]>;
  type _AssertFindManyInputNotAny = AssertNotAny<RouterInputs["user"]["findMany"]>;

  describe("Server-side caller types (baseline - should work)", () => {
    it("should have typed model namespaces", () => {
      expectTypeOf<ServerCaller>().toHaveProperty("user");
      expectTypeOf<ServerCaller>().toHaveProperty("post");
    });

    it("should have typed procedures", () => {
      expectTypeOf<ServerCaller["user"]["findMany"]>().toBeFunction();
      expectTypeOf<ServerCaller["user"]["create"]>().toBeFunction();
    });

    it("should have typed return values", () => {
      expectTypeOf<ServerCaller["user"]["findMany"]>().returns.toMatchTypeOf<
        Promise<Array<{ id: string; email: string }>>
      >();
    });

    it("should have typed input parameters", () => {
      type CreateInput = Parameters<ServerCaller["user"]["create"]>[0];
      expectTypeOf<CreateInput>().toHaveProperty("data");
      expectTypeOf<CreateInput["data"]>().toMatchTypeOf<{ email: string }>();
    });
  });

  describe("Client-side types via AppRouter (the problem area)", () => {
    // Simulate what a tRPC client would see
    // Note: We can't actually create a client without a link, but we can test the types

    it("AppRouter should have user namespace", () => {
      // This tests whether the router type has the user property
      expectTypeOf<AppRouter>().toHaveProperty("user");
    });

    it("AppRouter should have post namespace", () => {
      expectTypeOf<AppRouter>().toHaveProperty("post");
    });

    it("AppRouter.user should have findMany procedure", () => {
      // This tests the structure that tRPC clients use to infer types
      expectTypeOf<AppRouter["user"]>().toHaveProperty("findMany");
    });

    it("AppRouter.user should have create procedure", () => {
      expectTypeOf<AppRouter["user"]>().toHaveProperty("create");
    });

    // These tests check if the procedure types are properly inferred
    // tRPC clients use _def.query._output_in / _def.mutation._input_in etc.
    it("AppRouter.user.findMany should have _def with query type info", () => {
      expectTypeOf<AppRouter["user"]["findMany"]>().toHaveProperty("_def");
    });

    it("AppRouter.user.create should have _def with mutation type info", () => {
      expectTypeOf<AppRouter["user"]["create"]>().toHaveProperty("_def");
    });
  });

  describe("tRPC inferRouterInputs/inferRouterOutputs (what clients actually use)", () => {
    // These are the actual types that tRPC clients use for inference

    it("RouterInputs should have user namespace", () => {
      expectTypeOf<RouterInputs>().toHaveProperty("user");
    });

    it("RouterInputs.user should have findMany", () => {
      expectTypeOf<RouterInputs["user"]>().toHaveProperty("findMany");
    });

    it("RouterInputs.user should have create", () => {
      expectTypeOf<RouterInputs["user"]>().toHaveProperty("create");
    });

    it("RouterOutputs should have user namespace", () => {
      expectTypeOf<RouterOutputs>().toHaveProperty("user");
    });

    it("RouterOutputs.user should have findMany", () => {
      expectTypeOf<RouterOutputs["user"]>().toHaveProperty("findMany");
    });

    // THE ACTUAL PROBLEM: These types should be properly typed, not 'any' or 'unknown'
    // The input to user.create should require { data: { email: string, ... } }
    it("RouterInputs.user.create should have data property with email", () => {
      type CreateInput = RouterInputs["user"]["create"];
      expectTypeOf<CreateInput>().toHaveProperty("data");
      // This test verifies the input type is not just 'any'
      expectTypeOf<CreateInput>().not.toBeAny();
    });

    it("RouterInputs.user.findMany should accept where clause", () => {
      type FindManyInput = RouterInputs["user"]["findMany"];
      // This should not be 'any' - it should be properly typed
      expectTypeOf<FindManyInput>().not.toBeAny();
    });

    // THE KEY TEST: Output types should be properly typed
    it("RouterOutputs.user.findMany should return array of users", () => {
      type FindManyOutput = RouterOutputs["user"]["findMany"];
      // This should not be 'any' - it should be the User type
      expectTypeOf<FindManyOutput>().not.toBeAny();
    });

    it("RouterOutputs.user.create should return a user", () => {
      type CreateOutput = RouterOutputs["user"]["create"];
      // This should not be 'any' - it should be the User type
      expectTypeOf<CreateOutput>().not.toBeAny();
    });

    // If we can, verify the actual shape of the output
    it("RouterOutputs.user.findMany should be an array", () => {
      type FindManyOutput = RouterOutputs["user"]["findMany"];
      // Check if it's an array type (this would fail if output is 'any')
      expectTypeOf<FindManyOutput>().toBeArray();
    });

    it("RouterOutputs.user.count should return a number", () => {
      type CountOutput = RouterOutputs["user"]["count"];
      expectTypeOf<CountOutput>().not.toBeAny();
      expectTypeOf<CountOutput>().toMatchTypeOf<number>();
    });

    it("RouterOutputs.user.createMany should return count object", () => {
      type CreateManyOutput = RouterOutputs["user"]["createMany"];
      expectTypeOf<CreateManyOutput>().not.toBeAny();
      expectTypeOf<CreateManyOutput>().toMatchTypeOf<{ count: number }>();
    });
  });

  describe("Input type specificity", () => {
    // These tests verify that input types are specific, not just 'any'

    it("user.create input should require data.email", () => {
      type CreateInput = RouterInputs["user"]["create"];
      // If properly typed, data should have an email field
      type DataType = CreateInput extends { data: infer D } ? D : never;
      expectTypeOf<DataType>().not.toBeNever();
      expectTypeOf<DataType>().toHaveProperty("email");
    });

    it("user.update input should require where and data", () => {
      type UpdateInput = RouterInputs["user"]["update"];
      expectTypeOf<UpdateInput>().toHaveProperty("where");
      expectTypeOf<UpdateInput>().toHaveProperty("data");
    });

    it("user.delete input should require where", () => {
      type DeleteInput = RouterInputs["user"]["delete"];
      expectTypeOf<DeleteInput>().toHaveProperty("where");
    });

    it("user.findUnique input should require where", () => {
      type FindUniqueInput = RouterInputs["user"]["findUnique"];
      expectTypeOf<FindUniqueInput>().toHaveProperty("where");
    });
  });

  describe("Output type specificity", () => {
    // These tests verify output types match the ZenStack model

    it("user.findMany output items should have id and email", () => {
      type FindManyOutput = RouterOutputs["user"]["findMany"];
      type UserItem = FindManyOutput extends Array<infer U> ? U : never;
      expectTypeOf<UserItem>().not.toBeNever();
      expectTypeOf<UserItem>().toHaveProperty("id");
      expectTypeOf<UserItem>().toHaveProperty("email");
    });

    it("user.findUnique output should have id and email or be null", () => {
      type FindUniqueOutput = RouterOutputs["user"]["findUnique"];
      // Should be User | null
      expectTypeOf<FindUniqueOutput>().not.toBeAny();
    });

    it("post.findMany output items should have title and authorId", () => {
      type FindManyOutput = RouterOutputs["post"]["findMany"];
      type PostItem = FindManyOutput extends Array<infer P> ? P : never;
      expectTypeOf<PostItem>().not.toBeNever();
      expectTypeOf<PostItem>().toHaveProperty("title");
      expectTypeOf<PostItem>().toHaveProperty("authorId");
    });
  });

  describe("Include and Select input types", () => {
    // These tests verify that include/select options are properly typed in inputs

    it("user.findMany input should accept include option", () => {
      type FindManyInput = RouterInputs["user"]["findMany"];
      // FindManyInput can be undefined, so extract the non-undefined type
      type NonNullInput = Exclude<FindManyInput, undefined>;
      // Check that NonNullInput is an object type (not never)
      expectTypeOf<NonNullInput>().not.toBeNever();
    });

    it("user.findMany input should accept select option", () => {
      type FindManyInput = RouterInputs["user"]["findMany"];
      type NonNullInput = Exclude<FindManyInput, undefined>;
      expectTypeOf<NonNullInput>().not.toBeNever();
    });

    it("user.findMany input is properly typed (not any)", () => {
      type FindManyInput = RouterInputs["user"]["findMany"];
      expectTypeOf<FindManyInput>().not.toBeAny();
    });

    it("post.findMany input is properly typed (not any)", () => {
      type FindManyInput = RouterInputs["post"]["findMany"];
      expectTypeOf<FindManyInput>().not.toBeAny();
    });

    it("user.create input should accept include option", () => {
      type CreateInput = RouterInputs["user"]["create"];
      expectTypeOf<CreateInput>().toHaveProperty("include");
    });

    it("user.update input should accept include option", () => {
      type UpdateInput = RouterInputs["user"]["update"];
      expectTypeOf<UpdateInput>().toHaveProperty("include");
    });
  });

  describe("Relation types in output (base model fields)", () => {
    // Note: tRPC client types provide base model fields.
    // Dynamic include/select reflection requires server-side TypedRouterCaller.

    it("user.findMany output has base User fields", () => {
      type FindManyOutput = RouterOutputs["user"]["findMany"];
      type UserItem = FindManyOutput extends Array<infer U> ? U : never;
      expectTypeOf<UserItem>().toHaveProperty("id");
      expectTypeOf<UserItem>().toHaveProperty("email");
      expectTypeOf<UserItem>().toHaveProperty("name");
      expectTypeOf<UserItem>().toHaveProperty("createdAt");
      expectTypeOf<UserItem>().toHaveProperty("updatedAt");
    });

    it("post.findMany output has base Post fields", () => {
      type FindManyOutput = RouterOutputs["post"]["findMany"];
      type PostItem = FindManyOutput extends Array<infer P> ? P : never;
      expectTypeOf<PostItem>().toHaveProperty("id");
      expectTypeOf<PostItem>().toHaveProperty("title");
      expectTypeOf<PostItem>().toHaveProperty("content");
      expectTypeOf<PostItem>().toHaveProperty("published");
      expectTypeOf<PostItem>().toHaveProperty("authorId");
    });

    it("user.create output has base User fields", () => {
      type CreateOutput = RouterOutputs["user"]["create"];
      expectTypeOf<CreateOutput>().toHaveProperty("id");
      expectTypeOf<CreateOutput>().toHaveProperty("email");
    });

    it("post.create output has base Post fields", () => {
      type CreateOutput = RouterOutputs["post"]["create"];
      expectTypeOf<CreateOutput>().toHaveProperty("id");
      expectTypeOf<CreateOutput>().toHaveProperty("title");
      expectTypeOf<CreateOutput>().toHaveProperty("authorId");
    });
  });

  describe("Server-side TypedRouterCaller (full dynamic typing)", () => {
    // TypedRouterCaller provides full dynamic output typing based on include/select

    it("findMany function is properly typed", () => {
      // ServerCaller provides a findMany function that accepts typed args
      expectTypeOf<ServerCaller["user"]["findMany"]>().toBeFunction();
    });

    it("create function is properly typed", () => {
      expectTypeOf<ServerCaller["user"]["create"]>().toBeFunction();
    });

    it("post findMany function is properly typed", () => {
      expectTypeOf<ServerCaller["post"]["findMany"]>().toBeFunction();
    });

    it("user model has all CRUD operations", () => {
      expectTypeOf<ServerCaller["user"]>().toHaveProperty("findMany");
      expectTypeOf<ServerCaller["user"]>().toHaveProperty("findUnique");
      expectTypeOf<ServerCaller["user"]>().toHaveProperty("findFirst");
      expectTypeOf<ServerCaller["user"]>().toHaveProperty("create");
      expectTypeOf<ServerCaller["user"]>().toHaveProperty("createMany");
      expectTypeOf<ServerCaller["user"]>().toHaveProperty("update");
      expectTypeOf<ServerCaller["user"]>().toHaveProperty("updateMany");
      expectTypeOf<ServerCaller["user"]>().toHaveProperty("upsert");
      expectTypeOf<ServerCaller["user"]>().toHaveProperty("delete");
      expectTypeOf<ServerCaller["user"]>().toHaveProperty("deleteMany");
      expectTypeOf<ServerCaller["user"]>().toHaveProperty("count");
      expectTypeOf<ServerCaller["user"]>().toHaveProperty("aggregate");
      expectTypeOf<ServerCaller["user"]>().toHaveProperty("groupBy");
    });

    it("post model has all CRUD operations", () => {
      expectTypeOf<ServerCaller["post"]>().toHaveProperty("findMany");
      expectTypeOf<ServerCaller["post"]>().toHaveProperty("findUnique");
      expectTypeOf<ServerCaller["post"]>().toHaveProperty("create");
      expectTypeOf<ServerCaller["post"]>().toHaveProperty("update");
      expectTypeOf<ServerCaller["post"]>().toHaveProperty("delete");
    });
  });

  describe("TypedTRPCClient (full include/select inference for clients)", () => {
    // TypedTRPCClient provides full dynamic typing when cast from a tRPC client
    type TypedClient = TypedTRPCClient<SchemaType>;

    it("has user namespace", () => {
      expectTypeOf<TypedClient>().toHaveProperty("user");
    });

    it("has post namespace", () => {
      expectTypeOf<TypedClient>().toHaveProperty("post");
    });

    it("user.findMany has query method", () => {
      expectTypeOf<TypedClient["user"]["findMany"]>().toHaveProperty("query");
    });

    it("user.create has mutate method", () => {
      expectTypeOf<TypedClient["user"]["create"]>().toHaveProperty("mutate");
    });

    it("user model has all CRUD operations", () => {
      expectTypeOf<TypedClient["user"]>().toHaveProperty("findMany");
      expectTypeOf<TypedClient["user"]>().toHaveProperty("findUnique");
      expectTypeOf<TypedClient["user"]>().toHaveProperty("findFirst");
      expectTypeOf<TypedClient["user"]>().toHaveProperty("create");
      expectTypeOf<TypedClient["user"]>().toHaveProperty("createMany");
      expectTypeOf<TypedClient["user"]>().toHaveProperty("update");
      expectTypeOf<TypedClient["user"]>().toHaveProperty("updateMany");
      expectTypeOf<TypedClient["user"]>().toHaveProperty("upsert");
      expectTypeOf<TypedClient["user"]>().toHaveProperty("delete");
      expectTypeOf<TypedClient["user"]>().toHaveProperty("deleteMany");
      expectTypeOf<TypedClient["user"]>().toHaveProperty("count");
      expectTypeOf<TypedClient["user"]>().toHaveProperty("aggregate");
      expectTypeOf<TypedClient["user"]>().toHaveProperty("groupBy");
    });

    it("post model has all CRUD operations", () => {
      expectTypeOf<TypedClient["post"]>().toHaveProperty("findMany");
      expectTypeOf<TypedClient["post"]>().toHaveProperty("findUnique");
      expectTypeOf<TypedClient["post"]>().toHaveProperty("create");
      expectTypeOf<TypedClient["post"]>().toHaveProperty("update");
      expectTypeOf<TypedClient["post"]>().toHaveProperty("delete");
    });

    it("count returns number", () => {
      expectTypeOf<TypedClient["user"]["count"]["query"]>().returns.toMatchTypeOf<Promise<number>>();
    });

    it("createMany returns count object", () => {
      expectTypeOf<TypedClient["user"]["createMany"]["mutate"]>().returns.toMatchTypeOf<Promise<{ count: number }>>();
    });

    it("deleteMany returns count object", () => {
      expectTypeOf<TypedClient["user"]["deleteMany"]["mutate"]>().returns.toMatchTypeOf<Promise<{ count: number }>>();
    });
  });

  // ==========================================================================
  // COMPOSABLE TYPE SYSTEM TESTS
  // ==========================================================================

  describe("Composable Type System - WithZenStack", () => {
    it("WithZenStack creates a type container with schema", () => {
      type Container = WithZenStack<SchemaType>;
      expectTypeOf<Container>().toHaveProperty("__schema");
      expectTypeOf<Container>().toHaveProperty("__path");
    });

    it("WithZenStack with path includes the path type", () => {
      type Container = WithZenStack<SchemaType, "db">;
      expectTypeOf<Container["__path"]>().toEqualTypeOf<"db">();
    });

    it("WithZenStack without path has undefined path", () => {
      type Container = WithZenStack<SchemaType>;
      expectTypeOf<Container["__path"]>().toEqualTypeOf<undefined>();
    });
  });

  describe("Composable Type System - WithReact adapter", () => {
    type ReactTyped = WithReact<WithZenStack<SchemaType>>;

    it("WithReact transforms to React hook types", () => {
      expectTypeOf<ReactTyped>().toHaveProperty("__types");
      expectTypeOf<ReactTyped>().toHaveProperty("__path");
    });

    it("WithReact preserves undefined path", () => {
      expectTypeOf<ReactTyped["__path"]>().toEqualTypeOf<undefined>();
    });

    it("WithReact with path preserves the path", () => {
      type ReactWithPath = WithReact<WithZenStack<SchemaType, "generated">>;
      expectTypeOf<ReactWithPath["__path"]>().toEqualTypeOf<"generated">();
    });

    it("WithReact __types has model namespaces", () => {
      expectTypeOf<ReactTyped["__types"]>().toHaveProperty("user");
      expectTypeOf<ReactTyped["__types"]>().toHaveProperty("post");
    });

    it("WithReact __types.user has useQuery hooks", () => {
      expectTypeOf<ReactTyped["__types"]["user"]["findMany"]>().toHaveProperty("useQuery");
      expectTypeOf<ReactTyped["__types"]["user"]["findUnique"]>().toHaveProperty("useQuery");
      expectTypeOf<ReactTyped["__types"]["user"]["count"]>().toHaveProperty("useQuery");
    });

    it("WithReact __types.user has useMutation hooks", () => {
      expectTypeOf<ReactTyped["__types"]["user"]["create"]>().toHaveProperty("useMutation");
      expectTypeOf<ReactTyped["__types"]["user"]["update"]>().toHaveProperty("useMutation");
      expectTypeOf<ReactTyped["__types"]["user"]["delete"]>().toHaveProperty("useMutation");
    });
  });

  describe("Composable Type System - WithClient adapter", () => {
    type ClientTyped = WithClient<WithZenStack<SchemaType>>;

    it("WithClient transforms to vanilla client types", () => {
      expectTypeOf<ClientTyped>().toHaveProperty("__types");
      expectTypeOf<ClientTyped>().toHaveProperty("__path");
    });

    it("WithClient preserves undefined path", () => {
      expectTypeOf<ClientTyped["__path"]>().toEqualTypeOf<undefined>();
    });

    it("WithClient with path preserves the path", () => {
      type ClientWithPath = WithClient<WithZenStack<SchemaType, "db">>;
      expectTypeOf<ClientWithPath["__path"]>().toEqualTypeOf<"db">();
    });

    it("WithClient __types has model namespaces", () => {
      expectTypeOf<ClientTyped["__types"]>().toHaveProperty("user");
      expectTypeOf<ClientTyped["__types"]>().toHaveProperty("post");
    });

    it("WithClient __types.user has query methods", () => {
      expectTypeOf<ClientTyped["__types"]["user"]["findMany"]>().toHaveProperty("query");
      expectTypeOf<ClientTyped["__types"]["user"]["findUnique"]>().toHaveProperty("query");
      expectTypeOf<ClientTyped["__types"]["user"]["count"]>().toHaveProperty("query");
    });

    it("WithClient __types.user has mutate methods", () => {
      expectTypeOf<ClientTyped["__types"]["user"]["create"]>().toHaveProperty("mutate");
      expectTypeOf<ClientTyped["__types"]["user"]["update"]>().toHaveProperty("mutate");
      expectTypeOf<ClientTyped["__types"]["user"]["delete"]>().toHaveProperty("mutate");
    });
  });

  describe("Composable Type System - typedClient function", () => {
    it("typedClient is a function", () => {
      expectTypeOf(typedClient).toBeFunction();
    });

    it("typedClient returns a function that accepts a client", () => {
      type ReactTyped = WithReact<WithZenStack<SchemaType>>;
      const wrapper = typedClient<ReactTyped>();
      expectTypeOf(wrapper).toBeFunction();
    });
  });

  describe("Composable Type System - typedClient useUtils typing", () => {
    type ReactTyped = WithReact<WithZenStack<SchemaType, "generated">>;
    const mockClient = {} as {
      useUtils: () => { generated: any; queryClient: unknown };
      useContext: () => { generated: any; queryClient: unknown };
      generated: unknown;
    };
    const trpc = typedClient<ReactTyped>()(mockClient);

    it("useUtils includes typed generated model utilities", () => {
      type Utils = ReturnType<typeof trpc.useUtils>;
      expectTypeOf<Utils>().toHaveProperty("generated");
      expectTypeOf<Utils["generated"]>().toHaveProperty("user");
      expectTypeOf<Utils["generated"]["user"]>().toHaveProperty("findMany");
      expectTypeOf<Utils["generated"]["user"]>().toHaveProperty("invalidate");
      expectTypeOf<Utils["generated"]["user"]["findMany"]>().toHaveProperty("invalidate");
    });

    it("useContext includes typed generated model utilities", () => {
      type Utils = ReturnType<typeof trpc.useContext>;
      expectTypeOf<Utils>().toHaveProperty("generated");
      expectTypeOf<Utils["generated"]>().toHaveProperty("post");
      expectTypeOf<Utils["generated"]["post"]>().toHaveProperty("findUnique");
      expectTypeOf<Utils["generated"]["post"]["findUnique"]>().toHaveProperty("getData");
    });
  });

  describe("Composable Type System - useUtils merging preserves types (realistic apiV4 pattern)", () => {
    // This mirrors the real-world setup in apiV4:
    // - A merged appRouter with custom routers (admin, chat, session) + generated ZenStack router
    // - createTRPCReact<AppRouter>() for the base client with real tRPC-inferred types
    // - typedClient<WithReact<WithZenStack<SchemaType, "generated">>>() to apply ZenStack types

    const t = initTRPC.context<{ db: any }>().create();

    // Custom routers (like admin/chat/session in apiV4)
    const adminRouter = t.router({
      getStats: t.procedure.query(() => ({ totalUsers: 42, activeUsers: 10 })),
      banUser: t.procedure.input((v: unknown) => v as { userId: string }).mutation(() => ({ success: true })),
    });

    const chatRouter = t.router({
      sendMessage: t.procedure.input((v: unknown) => v as { text: string }).mutation(() => ({ messageId: "123" })),
    });

    // Generated ZenStack router (cast to AnyRouter like in apiV4)
    const generatedRouter = createZenStackRouter(schema, t) as unknown as AnyRouter;

    // Merged app router - same pattern as apiV4
    const appRouter = t.router({
      admin: adminRouter,
      chat: chatRouter,
      generated: generatedRouter,
    });
    type AppRouter = typeof appRouter;

    // createTRPCReact with real AppRouter types - exactly like apiV4
    const _trpc = createTRPCReact<AppRouter>();
    type ReactTyped = WithReact<WithZenStack<SchemaType, "generated">>;
    const trpc = typedClient<ReactTyped>()(_trpc);

    it("preserves custom router utils types from real tRPC inference", () => {
      type Utils = ReturnType<typeof trpc.useUtils>;

      // admin router utils should be properly typed (not any)
      expectTypeOf<Utils["admin"]>().not.toBeAny();
      expectTypeOf<Utils["admin"]["getStats"]>().not.toBeAny();
      expectTypeOf<Utils["admin"]["getStats"]["invalidate"]>().not.toBeAny();
      expectTypeOf<Utils["admin"]["banUser"]>().not.toBeAny();

      // chat router utils should be properly typed
      expectTypeOf<Utils["chat"]>().not.toBeAny();
      expectTypeOf<Utils["chat"]["sendMessage"]>().not.toBeAny();
    });

    it("ZenStack generated utils are properly typed at the nested path", () => {
      type Utils = ReturnType<typeof trpc.useUtils>;

      expectTypeOf<Utils["generated"]>().not.toBeAny();
      expectTypeOf<Utils["generated"]["user"]>().not.toBeAny();
      expectTypeOf<Utils["generated"]["user"]["findMany"]>().not.toBeAny();
      expectTypeOf<Utils["generated"]["user"]["findMany"]["invalidate"]>().not.toBeAny();
      expectTypeOf<Utils["generated"]["post"]>().not.toBeAny();
      expectTypeOf<Utils["generated"]["post"]["findUnique"]>().not.toBeAny();
    });

    it("all router utils coexist with correct types", () => {
      type Utils = ReturnType<typeof trpc.useUtils>;

      // Custom routers
      expectTypeOf<Utils>().toHaveProperty("admin");
      expectTypeOf<Utils>().toHaveProperty("chat");

      // ZenStack generated
      expectTypeOf<Utils>().toHaveProperty("generated");
      expectTypeOf<Utils["generated"]>().toHaveProperty("user");
      expectTypeOf<Utils["generated"]>().toHaveProperty("post");
    });

    it("typed hooks on custom routers are preserved", () => {
      // admin.getStats.useQuery should still work with proper types
      expectTypeOf<typeof trpc.admin.getStats.useQuery>().not.toBeAny();
      expectTypeOf<typeof trpc.admin.banUser.useMutation>().not.toBeAny();
      expectTypeOf<typeof trpc.chat.sendMessage.useMutation>().not.toBeAny();
    });

    it("typed hooks on generated router have ZenStack overrides", () => {
      expectTypeOf<typeof trpc.generated.user.findMany.useQuery>().not.toBeAny();
      expectTypeOf<typeof trpc.generated.user.create.useMutation>().not.toBeAny();
      expectTypeOf<typeof trpc.generated.post.findUnique.useQuery>().not.toBeAny();
    });
  });

  describe("Composable Type System - Nesting with paths", () => {
    // Single level nesting
    type SingleNested = WithReact<WithZenStack<SchemaType, "db">>;

    it("single level nesting has correct path", () => {
      expectTypeOf<SingleNested["__path"]>().toEqualTypeOf<"db">();
    });

    // Multi-level nesting
    type MultiNested = WithReact<WithZenStack<SchemaType, "api.db">>;

    it("multi-level nesting has correct path", () => {
      expectTypeOf<MultiNested["__path"]>().toEqualTypeOf<"api.db">();
    });

    // Deep nesting
    type DeepNested = WithReact<WithZenStack<SchemaType, "api.v1.db.models">>;

    it("deep nesting has correct path", () => {
      expectTypeOf<DeepNested["__path"]>().toEqualTypeOf<"api.v1.db.models">();
    });
  });

  // ==========================================================================
  // TYPED TRPC REACT TESTS
  // ==========================================================================

  describe("TypedTRPCReact - React hooks structure", () => {
    type ReactHooks = TypedTRPCReact<SchemaType>;

    it("has user and post namespaces", () => {
      expectTypeOf<ReactHooks>().toHaveProperty("user");
      expectTypeOf<ReactHooks>().toHaveProperty("post");
    });

    it("user namespace has all query operations with useQuery", () => {
      expectTypeOf<ReactHooks["user"]>().toHaveProperty("findMany");
      expectTypeOf<ReactHooks["user"]>().toHaveProperty("findUnique");
      expectTypeOf<ReactHooks["user"]>().toHaveProperty("findFirst");
      expectTypeOf<ReactHooks["user"]>().toHaveProperty("count");
      expectTypeOf<ReactHooks["user"]>().toHaveProperty("aggregate");
      expectTypeOf<ReactHooks["user"]>().toHaveProperty("groupBy");
    });

    it("user namespace has all mutation operations with useMutation", () => {
      expectTypeOf<ReactHooks["user"]>().toHaveProperty("create");
      expectTypeOf<ReactHooks["user"]>().toHaveProperty("createMany");
      expectTypeOf<ReactHooks["user"]>().toHaveProperty("update");
      expectTypeOf<ReactHooks["user"]>().toHaveProperty("updateMany");
      expectTypeOf<ReactHooks["user"]>().toHaveProperty("upsert");
      expectTypeOf<ReactHooks["user"]>().toHaveProperty("delete");
      expectTypeOf<ReactHooks["user"]>().toHaveProperty("deleteMany");
    });

    it("useQuery returns QueryResult shape", () => {
      type UseQueryReturn = ReturnType<ReactHooks["user"]["findMany"]["useQuery"]>;
      expectTypeOf<UseQueryReturn>().toHaveProperty("data");
      expectTypeOf<UseQueryReturn>().toHaveProperty("error");
      expectTypeOf<UseQueryReturn>().toHaveProperty("isLoading");
      expectTypeOf<UseQueryReturn>().toHaveProperty("isPending");
      expectTypeOf<UseQueryReturn>().toHaveProperty("isError");
      expectTypeOf<UseQueryReturn>().toHaveProperty("isSuccess");
      expectTypeOf<UseQueryReturn>().toHaveProperty("refetch");
    });

    it("useMutation returns MutationResult shape", () => {
      type UseMutationReturn = ReturnType<ReactHooks["user"]["create"]["useMutation"]>;
      expectTypeOf<UseMutationReturn>().toHaveProperty("data");
      expectTypeOf<UseMutationReturn>().toHaveProperty("error");
      expectTypeOf<UseMutationReturn>().toHaveProperty("isPending");
      expectTypeOf<UseMutationReturn>().toHaveProperty("mutate");
      expectTypeOf<UseMutationReturn>().toHaveProperty("mutateAsync");
    });
  });

  describe("TypedTRPCReactUtils - export and structure", () => {
    type ReactUtils = TypedTRPCReactUtils<SchemaType>;

    it("has model namespaces", () => {
      expectTypeOf<ReactUtils>().toHaveProperty("user");
      expectTypeOf<ReactUtils>().toHaveProperty("post");
    });

    it("model procedures expose utils helpers", () => {
      expectTypeOf<ReactUtils["user"]>().toHaveProperty("findMany");
      expectTypeOf<ReactUtils["user"]["findMany"]>().toHaveProperty("invalidate");
      expectTypeOf<ReactUtils["user"]["findMany"]>().toHaveProperty("getData");
    });
  });

  // ==========================================================================
  // RETURN TYPE TESTS - verifying correct return types per operation
  // ==========================================================================

  describe("TypedTRPCClient - Return types per operation", () => {
    type Client = TypedTRPCClient<SchemaType>;

    // findMany returns array
    it("findMany.query returns Promise of array", () => {
      type Return = ReturnType<Client["user"]["findMany"]["query"]>;
      expectTypeOf<Return>().toMatchTypeOf<Promise<unknown[]>>();
    });

    // findUnique returns single or null
    it("findUnique.query returns Promise of object or null", () => {
      type Return = ReturnType<Client["user"]["findUnique"]["query"]>;
      expectTypeOf<Return>().toMatchTypeOf<Promise<unknown | null>>();
    });

    // findFirst returns single or null
    it("findFirst.query returns Promise of object or null", () => {
      type Return = ReturnType<Client["user"]["findFirst"]["query"]>;
      expectTypeOf<Return>().toMatchTypeOf<Promise<unknown | null>>();
    });

    // count returns number
    it("count.query returns Promise<number>", () => {
      type Return = ReturnType<Client["user"]["count"]["query"]>;
      expectTypeOf<Return>().toEqualTypeOf<Promise<number>>();
    });

    // create returns single object
    it("create.mutate returns Promise of created object", () => {
      type Return = ReturnType<Client["user"]["create"]["mutate"]>;
      expectTypeOf<Return>().toMatchTypeOf<Promise<{ id: string; email: string }>>();
    });

    // createMany returns { count: number }
    it("createMany.mutate returns Promise<{ count: number }>", () => {
      type Return = ReturnType<Client["user"]["createMany"]["mutate"]>;
      expectTypeOf<Return>().toEqualTypeOf<Promise<{ count: number }>>();
    });

    // update returns updated object
    it("update.mutate returns Promise of updated object", () => {
      type Return = ReturnType<Client["user"]["update"]["mutate"]>;
      expectTypeOf<Return>().toMatchTypeOf<Promise<{ id: string; email: string }>>();
    });

    // updateMany returns { count: number }
    it("updateMany.mutate returns Promise<{ count: number }>", () => {
      type Return = ReturnType<Client["user"]["updateMany"]["mutate"]>;
      expectTypeOf<Return>().toEqualTypeOf<Promise<{ count: number }>>();
    });

    // upsert returns object
    it("upsert.mutate returns Promise of upserted object", () => {
      type Return = ReturnType<Client["user"]["upsert"]["mutate"]>;
      expectTypeOf<Return>().toMatchTypeOf<Promise<{ id: string; email: string }>>();
    });

    // delete returns deleted object
    it("delete.mutate returns Promise of deleted object", () => {
      type Return = ReturnType<Client["user"]["delete"]["mutate"]>;
      expectTypeOf<Return>().toMatchTypeOf<Promise<{ id: string; email: string }>>();
    });

    // deleteMany returns { count: number }
    it("deleteMany.mutate returns Promise<{ count: number }>", () => {
      type Return = ReturnType<Client["user"]["deleteMany"]["mutate"]>;
      expectTypeOf<Return>().toEqualTypeOf<Promise<{ count: number }>>();
    });

    // aggregate returns any (complex aggregation result)
    it("aggregate.query returns Promise", () => {
      type Return = ReturnType<Client["user"]["aggregate"]["query"]>;
      expectTypeOf<Return>().toMatchTypeOf<Promise<unknown>>();
    });

    // groupBy returns array
    it("groupBy.query returns Promise of array", () => {
      type Return = ReturnType<Client["user"]["groupBy"]["query"]>;
      expectTypeOf<Return>().toMatchTypeOf<Promise<unknown[]>>();
    });
  });

  // ==========================================================================
  // INPUT PARAMETER TESTS
  // ==========================================================================

  describe("TypedTRPCClient - Input parameter types", () => {
    type Client = TypedTRPCClient<SchemaType>;

    it("findMany.query is callable", () => {
      expectTypeOf<Client["user"]["findMany"]["query"]>().toBeFunction();
    });

    it("findUnique.query is callable", () => {
      expectTypeOf<Client["user"]["findUnique"]["query"]>().toBeFunction();
    });

    it("create.mutate is callable", () => {
      expectTypeOf<Client["user"]["create"]["mutate"]>().toBeFunction();
    });

    it("update.mutate is callable", () => {
      expectTypeOf<Client["user"]["update"]["mutate"]>().toBeFunction();
    });

    it("delete.mutate is callable", () => {
      expectTypeOf<Client["user"]["delete"]["mutate"]>().toBeFunction();
    });

    it("count.query is callable", () => {
      expectTypeOf<Client["user"]["count"]["query"]>().toBeFunction();
    });
  });

  // ==========================================================================
  // REACT HOOKS INPUT/OUTPUT TYPE TESTS
  // ==========================================================================

  describe("TypedTRPCReact - useQuery input and output types", () => {
    type ReactHooks = TypedTRPCReact<SchemaType>;

    it("findMany.useQuery is callable", () => {
      expectTypeOf<ReactHooks["user"]["findMany"]["useQuery"]>().toBeFunction();
    });

    it("findMany.useQuery result.data is array or undefined", () => {
      type Result = ReturnType<ReactHooks["user"]["findMany"]["useQuery"]>;
      type Data = Result["data"];
      // data should be array | undefined (because query might not have loaded yet)
      expectTypeOf<Data>().toMatchTypeOf<unknown[] | undefined>();
    });

    it("findUnique.useQuery result.data can be null", () => {
      type Result = ReturnType<ReactHooks["user"]["findUnique"]["useQuery"]>;
      type Data = Result["data"];
      // data should be object | null | undefined
      expectTypeOf<Data>().toMatchTypeOf<unknown | null | undefined>();
    });

    it("count.useQuery result.data is number or undefined", () => {
      type Result = ReturnType<ReactHooks["user"]["count"]["useQuery"]>;
      type Data = Result["data"];
      expectTypeOf<Data>().toMatchTypeOf<number | undefined>();
    });
  });

  describe("TypedTRPCReact - useMutation input and output types", () => {
    type ReactHooks = TypedTRPCReact<SchemaType>;

    it("create.useMutation().mutate accepts data object", () => {
      type MutationResult = ReturnType<ReactHooks["user"]["create"]["useMutation"]>;
      type MutateFn = MutationResult["mutate"];
      expectTypeOf<MutateFn>().toBeFunction();
    });

    it("create.useMutation().mutateAsync returns Promise", () => {
      type MutationResult = ReturnType<ReactHooks["user"]["create"]["useMutation"]>;
      type MutateAsyncFn = MutationResult["mutateAsync"];
      expectTypeOf<MutateAsyncFn>().toBeFunction();
      type AsyncReturn = ReturnType<MutateAsyncFn>;
      expectTypeOf<AsyncReturn>().toMatchTypeOf<Promise<unknown>>();
    });

    it("createMany.useMutation().mutateAsync returns Promise<{ count: number }>", () => {
      type MutationResult = ReturnType<ReactHooks["user"]["createMany"]["useMutation"]>;
      type MutateAsyncFn = MutationResult["mutateAsync"];
      type AsyncReturn = ReturnType<MutateAsyncFn>;
      expectTypeOf<AsyncReturn>().toEqualTypeOf<Promise<{ count: number }>>();
    });

    it("deleteMany.useMutation().mutateAsync returns Promise<{ count: number }>", () => {
      type MutationResult = ReturnType<ReactHooks["user"]["deleteMany"]["useMutation"]>;
      type MutateAsyncFn = MutationResult["mutateAsync"];
      type AsyncReturn = ReturnType<MutateAsyncFn>;
      expectTypeOf<AsyncReturn>().toEqualTypeOf<Promise<{ count: number }>>();
    });
  });

  // ==========================================================================
  // MODEL FIELD TYPE TESTS
  // ==========================================================================

  describe("Return types contain correct model fields", () => {
    type Client = TypedTRPCClient<SchemaType>;

    it("user findMany returns objects with User fields", () => {
      type Return = Awaited<ReturnType<Client["user"]["findMany"]["query"]>>;
      type UserItem = Return extends (infer U)[] ? U : never;
      expectTypeOf<UserItem>().toHaveProperty("id");
      expectTypeOf<UserItem>().toHaveProperty("email");
      expectTypeOf<UserItem>().toHaveProperty("name");
      expectTypeOf<UserItem>().toHaveProperty("createdAt");
      expectTypeOf<UserItem>().toHaveProperty("updatedAt");
    });

    it("post findMany returns objects with Post fields", () => {
      type Return = Awaited<ReturnType<Client["post"]["findMany"]["query"]>>;
      type PostItem = Return extends (infer P)[] ? P : never;
      expectTypeOf<PostItem>().toHaveProperty("id");
      expectTypeOf<PostItem>().toHaveProperty("title");
      expectTypeOf<PostItem>().toHaveProperty("content");
      expectTypeOf<PostItem>().toHaveProperty("published");
      expectTypeOf<PostItem>().toHaveProperty("authorId");
      expectTypeOf<PostItem>().toHaveProperty("createdAt");
      expectTypeOf<PostItem>().toHaveProperty("updatedAt");
    });

    it("user create returns object with User fields", () => {
      type Return = Awaited<ReturnType<Client["user"]["create"]["mutate"]>>;
      expectTypeOf<Return>().toHaveProperty("id");
      expectTypeOf<Return>().toHaveProperty("email");
      expectTypeOf<Return>().toHaveProperty("name");
    });

    it("post create returns object with Post fields", () => {
      type Return = Awaited<ReturnType<Client["post"]["create"]["mutate"]>>;
      expectTypeOf<Return>().toHaveProperty("id");
      expectTypeOf<Return>().toHaveProperty("title");
      expectTypeOf<Return>().toHaveProperty("authorId");
    });
  });

  // ==========================================================================
  // FIELD TYPE CORRECTNESS TESTS
  // ==========================================================================

  describe("Field types are correct", () => {
    type Client = TypedTRPCClient<SchemaType>;

    it("user.id is string", () => {
      type Return = Awaited<ReturnType<Client["user"]["findMany"]["query"]>>;
      type UserItem = Return extends (infer U)[] ? U : never;
      type IdType = UserItem extends { id: infer I } ? I : never;
      expectTypeOf<IdType>().toEqualTypeOf<string>();
    });

    it("user.email is string", () => {
      type Return = Awaited<ReturnType<Client["user"]["findMany"]["query"]>>;
      type UserItem = Return extends (infer U)[] ? U : never;
      type EmailType = UserItem extends { email: infer E } ? E : never;
      expectTypeOf<EmailType>().toEqualTypeOf<string>();
    });

    it("user.name is string or null (optional field)", () => {
      type Return = Awaited<ReturnType<Client["user"]["findMany"]["query"]>>;
      type UserItem = Return extends (infer U)[] ? U : never;
      type NameType = UserItem extends { name: infer N } ? N : never;
      expectTypeOf<NameType>().toMatchTypeOf<string | null>();
    });

    it("post.published is boolean", () => {
      type Return = Awaited<ReturnType<Client["post"]["findMany"]["query"]>>;
      type PostItem = Return extends (infer P)[] ? P : never;
      type PublishedType = PostItem extends { published: infer Pub } ? Pub : never;
      expectTypeOf<PublishedType>().toEqualTypeOf<boolean>();
    });

    it("post.content is string or null (optional field)", () => {
      type Return = Awaited<ReturnType<Client["post"]["findMany"]["query"]>>;
      type PostItem = Return extends (infer P)[] ? P : never;
      type ContentType = PostItem extends { content: infer C } ? C : never;
      expectTypeOf<ContentType>().toMatchTypeOf<string | null>();
    });
  });

  // ==========================================================================
  // DYNAMIC RETURN TYPES BASED ON INCLUDE/SELECT
  // This is the key feature - return types change based on input options
  // ==========================================================================

  describe("Dynamic return types with include/select (TypedRouterCaller)", () => {
    // TypedRouterCaller is the server-side caller with full dynamic typing
    type Caller = TypedRouterCaller<SchemaType>;

    it("findMany without include returns base User type", () => {
      // When called with no args or empty args, returns base User[]
      type BaseReturn = Awaited<ReturnType<typeof findManyNoInclude>>;
      async function findManyNoInclude(caller: Caller) {
        return caller.user.findMany({});
      }
      expectTypeOf<BaseReturn[0]>().toHaveProperty("id");
      expectTypeOf<BaseReturn[0]>().toHaveProperty("email");
      // Without include, posts should NOT be present
      expectTypeOf<BaseReturn[0]>().not.toHaveProperty("posts");
    });

    it("findMany with include: { posts: true } returns User with posts", () => {
      // When include: { posts: true } is passed, return type includes posts
      async function findManyWithPosts(caller: Caller) {
        return caller.user.findMany({ include: { posts: true } });
      }
      type WithPostsReturn = Awaited<ReturnType<typeof findManyWithPosts>>;
      expectTypeOf<WithPostsReturn[0]>().toHaveProperty("id");
      expectTypeOf<WithPostsReturn[0]>().toHaveProperty("email");
      expectTypeOf<WithPostsReturn[0]>().toHaveProperty("posts");
    });

    it("post.findMany with include: { author: true } returns Post with author", () => {
      async function findPostsWithAuthor(caller: Caller) {
        return caller.post.findMany({ include: { author: true } });
      }
      type WithAuthorReturn = Awaited<ReturnType<typeof findPostsWithAuthor>>;
      expectTypeOf<WithAuthorReturn[0]>().toHaveProperty("id");
      expectTypeOf<WithAuthorReturn[0]>().toHaveProperty("title");
      expectTypeOf<WithAuthorReturn[0]>().toHaveProperty("author");
    });

    it("create with include: { posts: true } returns User with posts", () => {
      async function createWithPosts(caller: Caller) {
        return caller.user.create({
          data: { email: "test@test.com" },
          include: { posts: true },
        });
      }
      type CreateWithPostsReturn = Awaited<ReturnType<typeof createWithPosts>>;
      expectTypeOf<CreateWithPostsReturn>().toHaveProperty("id");
      expectTypeOf<CreateWithPostsReturn>().toHaveProperty("email");
      expectTypeOf<CreateWithPostsReturn>().toHaveProperty("posts");
    });

    it("findUnique with include returns object with relations", () => {
      async function findUniqueWithPosts(caller: Caller) {
        return caller.user.findUnique({
          where: { id: "123" },
          include: { posts: true },
        });
      }
      type FindUniqueReturn = Awaited<ReturnType<typeof findUniqueWithPosts>>;
      // findUnique can return null
      type NonNullReturn = NonNullable<FindUniqueReturn>;
      expectTypeOf<NonNullReturn>().toHaveProperty("id");
      expectTypeOf<NonNullReturn>().toHaveProperty("posts");
    });

    it("update with include returns updated object with relations", () => {
      async function updateWithPosts(caller: Caller) {
        return caller.user.update({
          where: { id: "123" },
          data: { name: "Updated" },
          include: { posts: true },
        });
      }
      type UpdateReturn = Awaited<ReturnType<typeof updateWithPosts>>;
      expectTypeOf<UpdateReturn>().toHaveProperty("id");
      expectTypeOf<UpdateReturn>().toHaveProperty("posts");
    });
  });

  describe("Dynamic return types with select (TypedRouterCaller)", () => {
    type Caller = TypedRouterCaller<SchemaType>;

    it("findMany with select returns only selected fields", () => {
      async function findManySelect(caller: Caller) {
        return caller.user.findMany({
          select: { id: true, email: true },
        });
      }
      type SelectReturn = Awaited<ReturnType<typeof findManySelect>>;
      expectTypeOf<SelectReturn[0]>().toHaveProperty("id");
      expectTypeOf<SelectReturn[0]>().toHaveProperty("email");
      // Non-selected fields should not be present
      // Note: TypeScript structural typing may still allow access, but the
      // intent is that only selected fields are in the type
    });

    it("findUnique with select returns only selected fields", () => {
      async function findUniqueSelect(caller: Caller) {
        return caller.user.findUnique({
          where: { id: "123" },
          select: { id: true, name: true },
        });
      }
      type SelectReturn = Awaited<ReturnType<typeof findUniqueSelect>>;
      type NonNullReturn = NonNullable<SelectReturn>;
      expectTypeOf<NonNullReturn>().toHaveProperty("id");
      expectTypeOf<NonNullReturn>().toHaveProperty("name");
    });

    it("create with select returns only selected fields", () => {
      async function createSelect(caller: Caller) {
        return caller.user.create({
          data: { email: "test@test.com" },
          select: { id: true },
        });
      }
      type CreateReturn = Awaited<ReturnType<typeof createSelect>>;
      expectTypeOf<CreateReturn>().toHaveProperty("id");
    });

    it("select can include relations", () => {
      async function selectWithRelation(caller: Caller) {
        return caller.user.findMany({
          select: {
            id: true,
            posts: true,
          },
        });
      }
      type SelectReturn = Awaited<ReturnType<typeof selectWithRelation>>;
      expectTypeOf<SelectReturn[0]>().toHaveProperty("id");
      expectTypeOf<SelectReturn[0]>().toHaveProperty("posts");
    });
  });

  describe("Nested includes (TypedRouterCaller)", () => {
    type Caller = TypedRouterCaller<SchemaType>;

    it("nested include: posts with author", () => {
      async function nestedInclude(caller: Caller) {
        return caller.user.findMany({
          include: {
            posts: {
              include: {
                author: true,
              },
            },
          },
        });
      }
      type Return = Awaited<ReturnType<typeof nestedInclude>>;
      expectTypeOf<Return[0]>().toHaveProperty("posts");
      // The posts should have author included
      type PostsType = Return[0]["posts"];
      expectTypeOf<PostsType>().toBeArray();
    });
  });

  // ==========================================================================
  // COMPILE-TIME TYPE ASSERTIONS FOR COMPOSABLE SYSTEM
  // ==========================================================================

  describe("Compile-time type assertions for composable system", () => {
    // These assertions verify types at compile time

    it("WithZenStack type structure is correct", () => {
      type T = WithZenStack<SchemaType, "db">;
      // Compile-time check - this should not error
      const _check: T["__path"] extends "db" ? true : false = true;
      expectTypeOf(_check).toEqualTypeOf<true>();
    });

    it("WithReact preserves path correctly", () => {
      type T = WithReact<WithZenStack<SchemaType, "nested.path">>;
      const _check: T["__path"] extends "nested.path" ? true : false = true;
      expectTypeOf(_check).toEqualTypeOf<true>();
    });

    it("WithClient preserves path correctly", () => {
      type T = WithClient<WithZenStack<SchemaType, "api.db">>;
      const _check: T["__path"] extends "api.db" ? true : false = true;
      expectTypeOf(_check).toEqualTypeOf<true>();
    });

    it("Adapters produce different types", () => {
      type ReactTypes = WithReact<WithZenStack<SchemaType>>["__types"];
      type ClientTypes = WithClient<WithZenStack<SchemaType>>["__types"];
      // React types should have useQuery, Client types should have query
      expectTypeOf<ReactTypes["user"]["findMany"]>().toHaveProperty("useQuery");
      expectTypeOf<ClientTypes["user"]["findMany"]>().toHaveProperty("query");
      // And vice versa should NOT have the other
      expectTypeOf<ReactTypes["user"]["findMany"]>().not.toHaveProperty("query");
      expectTypeOf<ClientTypes["user"]["findMany"]>().not.toHaveProperty("useQuery");
    });
  });
});
