import { describe, it, expectTypeOf } from "vitest";
import { initTRPC, inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { createTRPCClient } from "@trpc/client";
import { schema, SchemaType } from "./fixtures/zenstack/schema.js";
import {
  createZenStackRouter,
  type TypedRouterCaller,
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
});
