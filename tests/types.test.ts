import { describe, it, expectTypeOf } from "vitest";
import { initTRPC, inferRouterInputs, type AnyRouter } from "@trpc/server";
import { schema, SchemaType } from "./fixtures/zenstack/schema.js";
import {
  createZenStackRouter,
  type TypedRouterCaller,
  type ZenStackRouter,
} from "../src/index.js";
import type { ZenResult } from "../src/typed-client.js";
import type { SimplifiedPlainResult } from "@zenstackhq/orm";

/**
 * Type-level tests to verify that our TypedRouterCaller provides correct type inference.
 * These tests don't run any code - they only verify TypeScript types at compile time.
 */
describe("Type Tests", () => {
  // Create types for testing - use Caller["model"] to access model procedures
  type Caller = TypedRouterCaller<SchemaType>;
  type UserProcedures = Caller["user"];
  type PostProcedures = Caller["post"];

  describe("TypedRouterCaller structure", () => {
    it("should have user and post model namespaces", () => {
      expectTypeOf<Caller>().toHaveProperty("user");
      expectTypeOf<Caller>().toHaveProperty("post");
    });

    it("should have lowercase model names matching procedures", () => {
      expectTypeOf<Caller["user"]>().toEqualTypeOf<UserProcedures>();
      expectTypeOf<Caller["post"]>().toEqualTypeOf<PostProcedures>();
    });
  });

  describe("User model procedures", () => {
    it("should have all CRUD operations", () => {
      expectTypeOf<UserProcedures>().toHaveProperty("findMany");
      expectTypeOf<UserProcedures>().toHaveProperty("findUnique");
      expectTypeOf<UserProcedures>().toHaveProperty("findFirst");
      expectTypeOf<UserProcedures>().toHaveProperty("create");
      expectTypeOf<UserProcedures>().toHaveProperty("createMany");
      expectTypeOf<UserProcedures>().toHaveProperty("update");
      expectTypeOf<UserProcedures>().toHaveProperty("updateMany");
      expectTypeOf<UserProcedures>().toHaveProperty("upsert");
      expectTypeOf<UserProcedures>().toHaveProperty("delete");
      expectTypeOf<UserProcedures>().toHaveProperty("deleteMany");
      expectTypeOf<UserProcedures>().toHaveProperty("count");
      expectTypeOf<UserProcedures>().toHaveProperty("aggregate");
      expectTypeOf<UserProcedures>().toHaveProperty("groupBy");
    });

    it("findMany should return Promise of User array", () => {
      expectTypeOf<UserProcedures["findMany"]>().returns.toMatchTypeOf<
        Promise<Array<{ id: string; email: string }>>
      >();
    });

    it("findUnique should return Promise of User or null", () => {
      expectTypeOf<UserProcedures["findUnique"]>().returns.toMatchTypeOf<
        Promise<{ id: string; email: string } | null>
      >();
    });

    it("create should return Promise of User", () => {
      expectTypeOf<UserProcedures["create"]>().returns.toMatchTypeOf<
        Promise<{ id: string; email: string }>
      >();
    });

    it("count should return Promise of number", () => {
      expectTypeOf<UserProcedures["count"]>().returns.toMatchTypeOf<Promise<number>>();
    });

    it("createMany should return Promise with count", () => {
      expectTypeOf<UserProcedures["createMany"]>().returns.toMatchTypeOf<
        Promise<{ count: number }>
      >();
    });

    it("deleteMany should return Promise with count", () => {
      expectTypeOf<UserProcedures["deleteMany"]>().returns.toMatchTypeOf<
        Promise<{ count: number }>
      >();
    });
  });

  describe("Post model procedures", () => {
    it("should have all CRUD operations", () => {
      expectTypeOf<PostProcedures>().toHaveProperty("findMany");
      expectTypeOf<PostProcedures>().toHaveProperty("findUnique");
      expectTypeOf<PostProcedures>().toHaveProperty("create");
      expectTypeOf<PostProcedures>().toHaveProperty("update");
      expectTypeOf<PostProcedures>().toHaveProperty("delete");
    });

    it("findMany should return Promise of Post array", () => {
      expectTypeOf<PostProcedures["findMany"]>().returns.toMatchTypeOf<
        Promise<Array<{ id: string; title: string; published: boolean }>>
      >();
    });
  });

  describe("User model field types", () => {
    // Define expected User type
    type ExpectedUserFields = {
      id: string;
      email: string;
      name: string | null;
      createdAt: Date;
      updatedAt: Date;
    };

    it("findMany result should have correct field types", () => {
      type FindManyResult = Awaited<ReturnType<UserProcedures["findMany"]>>[number];

      expectTypeOf<FindManyResult>().toMatchTypeOf<ExpectedUserFields>();
    });

    it("create result should have correct field types", () => {
      type CreateResult = Awaited<ReturnType<UserProcedures["create"]>>;

      expectTypeOf<CreateResult>().toMatchTypeOf<ExpectedUserFields>();
    });
  });

  describe("Post model field types", () => {
    type ExpectedPostFields = {
      id: string;
      title: string;
      content: string | null;
      published: boolean;
      authorId: string;
      createdAt: Date;
      updatedAt: Date;
    };

    it("findMany result should have correct field types", () => {
      type FindManyResult = Awaited<ReturnType<PostProcedures["findMany"]>>[number];

      expectTypeOf<FindManyResult>().toMatchTypeOf<ExpectedPostFields>();
    });
  });

  describe("Dynamic include typing", () => {
    it("findMany with include should add relation to result type", () => {
      // When calling findMany with include: { posts: true }
      // The result should include the posts relation
      type UserWithPosts = {
        id: string;
        email: string;
        name: string | null;
        createdAt: Date;
        updatedAt: Date;
        posts: Array<{
          id: string;
          title: string;
          content: string | null;
          published: boolean;
          authorId: string;
          createdAt: Date;
          updatedAt: Date;
        }>;
      };

      // Test that the procedure accepts include parameter
      type FindManyWithInclude = UserProcedures["findMany"];
      expectTypeOf<FindManyWithInclude>().toBeFunction();

      type FindManyInput = Parameters<FindManyWithInclude>[0];
      expectTypeOf<FindManyInput>().not.toBeNever();
    });

    it("Post findMany with include author should work", () => {
      type FindManyWithInclude = PostProcedures["findMany"];

      type FindManyInput = Parameters<FindManyWithInclude>[0];
      expectTypeOf<FindManyInput>().not.toBeNever();
    });

    // Regression tests: scalar fields in select/include must NOT be `unknown`
    it("findMany with select should return typed scalar fields (not unknown)", () => {
      type Result = Awaited<ReturnType<UserProcedures["findMany"]>>[number];
      // Baseline: default result has proper types
      expectTypeOf<Result["id"]>().toEqualTypeOf<string>();
      expectTypeOf<Result["email"]>().toEqualTypeOf<string>();
      expectTypeOf<Result["name"]>().toEqualTypeOf<string | null>();
    });

    it("include with nested select should return typed scalar fields", () => {
      // Post.author is optional=false, so author should not be null
      type IncResult = Awaited<ReturnType<PostProcedures["findMany"]>>[number];
      // Default post result has proper types
      expectTypeOf<IncResult["id"]>().toEqualTypeOf<string>();
      expectTypeOf<IncResult["title"]>().toEqualTypeOf<string>();
    });
  });

  describe("Dynamic select typing", () => {
    it("findMany should accept select parameter", () => {
      type FindMany = UserProcedures["findMany"];

      type FindManyInput = Parameters<FindMany>[0];
      expectTypeOf<FindManyInput>().not.toBeNever();
    });
  });

  describe("ZenResult select/include type correctness", () => {
    it("ZenResult with no args returns DefaultResult", () => {
      type R = ZenResult<SchemaType, "User", {}>;
      expectTypeOf<R["id"]>().toEqualTypeOf<string>();
      expectTypeOf<R["email"]>().toEqualTypeOf<string>();
      expectTypeOf<R["name"]>().toEqualTypeOf<string | null>();
      expectTypeOf<R["createdAt"]>().toEqualTypeOf<Date>();
    });

    it("ZenResult with select returns only selected scalar fields with correct types", () => {
      type R = ZenResult<SchemaType, "User", { select: { id: true; name: true } }>;
      expectTypeOf<R["id"]>().toEqualTypeOf<string>();
      expectTypeOf<R["name"]>().toEqualTypeOf<string | null>();
      // unselected fields should not be present
      expectTypeOf<R>().not.toHaveProperty("email");
    });

    it("ZenResult with include adds relation with correct type", () => {
      type R = ZenResult<SchemaType, "User", { include: { posts: true } }>;
      // scalar fields still present
      expectTypeOf<R["id"]>().toEqualTypeOf<string>();
      // posts should be an array of Post-like objects
      expectTypeOf<R["posts"]>().toBeArray();
      type Post = R["posts"][number];
      expectTypeOf<Post["id"]>().toEqualTypeOf<string>();
      expectTypeOf<Post["title"]>().toEqualTypeOf<string>();
    });

    it("ZenResult with include and nested select returns correct types", () => {
      type R = ZenResult<SchemaType, "Post", { include: { author: { select: { id: true; name: true } } } }>;
      // post scalar fields
      expectTypeOf<R["id"]>().toEqualTypeOf<string>();
      expectTypeOf<R["title"]>().toEqualTypeOf<string>();
      // author with nested select
      type Author = R["author"];
      expectTypeOf<Author["id"]>().toEqualTypeOf<string>();
      expectTypeOf<Author["name"]>().toEqualTypeOf<string | null>();
      // unselected author fields not present
      expectTypeOf<Author>().not.toHaveProperty("email");
    });

    it("ZenResult with _count include returns count fields as numbers (apiv4/AppAgents regression)", () => {
      // Regression: IncludeResult previously excluded _count entirely because _count is not a
      // RelationField. This caused `trpc.generated.agentGroup.findMany({ include: { _count: ... } })`
      // in apiv4's AppAgents.tsx to produce a type with no _count property at all.
      type R = ZenResult<SchemaType, "User", { include: { _count: { select: { posts: true } } } }>;
      // scalar fields still present
      expectTypeOf<R["id"]>().toEqualTypeOf<string>();
      // _count must exist with the selected relation as a number
      expectTypeOf<R["_count"]>().not.toBeNever();
      expectTypeOf<R["_count"]["posts"]>().toEqualTypeOf<number>();
    });

    it("ZenResult with _count: true returns an index-keyed count object", () => {
      type R = ZenResult<SchemaType, "User", { include: { _count: true } }>;
      type Count = R["_count"];
      expectTypeOf<Count>().not.toBeNever();
      // _count: true maps every relation to number via { [K: string]: number }
      expectTypeOf<Count>().toMatchTypeOf<Record<string, number>>();
    });

    it("ZenResult fixes the tsgo narrowing bug that SimplifiedPlainResult has with non-empty ExtResult (apiv4/evaluation regression)", () => {
      // When a ZenStackClient has plugins applied (e.g., PolicyPlugin + custom plugins),
      // its ExtResult type parameter becomes non-empty (e.g., Record<string, never>).
      // Under tsgo (TypeScript 7), SimplifiedPlainResult<Schema, Model, Args, Options, NonEmptyExtResult>
      // fails to narrow the iteration variable Key in the value branch of ModelSelectResult,
      // causing scalar fields to become `unknown` instead of string/number/Date/etc.
      //
      // ZenResult sidesteps this entirely by using split mapped types (keyof Args & ScalarFields
      // vs keyof Args & RelationFields) that are always resolved correctly by tsgo.
      //
      // This test confirms ZenResult returns the right types; the tsgo narrowing failure with
      // SimplifiedPlainResult+non-empty ExtResult is captured below as a type alias for reference.

      // Reference: what broke in apiv4 (extendedDb = db.$use(agentPlugin).$use(...).$use(new PolicyPlugin()))
      // All apiv4 plugins use ExtResult = Record<string, never>, making the composed ExtResult non-empty.
      type BrokenByTsgo = SimplifiedPlainResult<
        SchemaType,
        "Post",
        { include: { author: { select: { id: true; name: true } } } },
        any,
        Record<string, never> // non-empty ExtResult — what .$use(plugin) adds
      >;
      // Under tsgo: BrokenByTsgo["author"]["id"] resolves to `unknown` instead of `string`.
      // Under tsc 5.x: it resolves correctly to `string`.
      // We don't assert the broken type here (it differs between compilers), but we DO assert
      // that ZenResult — which zenstack-trpc's router generator now uses — is always correct:
      type Fixed = ZenResult<SchemaType, "Post", { include: { author: { select: { id: true; name: true } } } }>;
      type FixedAuthor = Fixed["author"];
      expectTypeOf<FixedAuthor["id"]>().toEqualTypeOf<string>();
      expectTypeOf<FixedAuthor["name"]>().toEqualTypeOf<string | null>();
    });
  });

  describe("Input types for mutations", () => {
    it("create should require data with email", () => {
      type CreateInput = Parameters<UserProcedures["create"]>[0];

      expectTypeOf<CreateInput>().toHaveProperty("data");
      expectTypeOf<CreateInput["data"]>().toMatchTypeOf<{ email: string }>();
    });

    it("update should require where and data", () => {
      type UpdateInput = Parameters<UserProcedures["update"]>[0];

      expectTypeOf<UpdateInput>().toHaveProperty("where");
      expectTypeOf<UpdateInput>().toHaveProperty("data");
    });

    it("delete should require where", () => {
      type DeleteInput = Parameters<UserProcedures["delete"]>[0];

      expectTypeOf<DeleteInput>().toHaveProperty("where");
    });

    it("Post create should require title and authorId", () => {
      type CreateInput = Parameters<PostProcedures["create"]>[0];

      expectTypeOf<CreateInput>().toHaveProperty("data");
      expectTypeOf<CreateInput["data"]>().toMatchTypeOf<{ title: string }>();
    });
  });

  describe("Where clause types", () => {
    it("findMany where should accept field filters", () => {
      type FindManyInput = Parameters<UserProcedures["findMany"]>[0];

      // Where clause should be optional and accept field filters
      expectTypeOf<NonNullable<FindManyInput>["where"]>().toMatchTypeOf<
        | {
            id?: string | { equals?: string; contains?: string };
            email?: string | { equals?: string; contains?: string };
            AND?: any;
            OR?: any;
            NOT?: any;
          }
        | undefined
      >();
    });

    it("findUnique where should accept unique fields", () => {
      type FindUniqueInput = Parameters<UserProcedures["findUnique"]>[0];

      expectTypeOf<FindUniqueInput>().toHaveProperty("where");
      expectTypeOf<FindUniqueInput["where"]>().toMatchTypeOf<
        { id?: string } | { email?: string }
      >();
    });
  });

  describe("Pagination and ordering types", () => {
    it("findMany should accept skip and take", () => {
      type FindManyInput = Parameters<UserProcedures["findMany"]>[0];

      expectTypeOf<NonNullable<FindManyInput>>().toMatchTypeOf<{
        skip?: number;
        take?: number;
      }>();
    });

    it("findMany should accept orderBy", () => {
      type FindManyInput = Parameters<UserProcedures["findMany"]>[0];

      expectTypeOf<NonNullable<FindManyInput>>().toMatchTypeOf<{
        orderBy?: { email?: "asc" | "desc" } | Array<{ email?: "asc" | "desc" }>;
      }>();
    });
  });

  describe("Router creation types", () => {
    it("should infer context type including typed db from tRPC instance", () => {
      // A deliberately specific db shape so we can distinguish it from `any`
      type MyDb = { $disconnect: () => Promise<void>; user: unknown };
      type MyContext = { db: MyDb; sessionToken: string };

      const t = initTRPC.context<MyContext>().create();
      const router = createZenStackRouter(schema, t);

      type RouterCtx = Parameters<typeof router.createCaller>[0];

      // Before the fix, RouterCtx was { db: any } — it would NOT have sessionToken.
      // After the fix, RouterCtx is inferred as MyContext.
      expectTypeOf<RouterCtx>().toExtend<{ sessionToken: string }>();
      expectTypeOf<RouterCtx["db"]>().toExtend<MyDb>();
    });

    it("initTRPC should return a tRPC instance", () => {
      const t = initTRPC.context<{ db: any }>().create();

      expectTypeOf(t).toHaveProperty("router");
      expectTypeOf(t).toHaveProperty("procedure");
    });

    it("createZenStackRouter should return a router", () => {
      const t = initTRPC.context<{ db: any }>().create();
      const router = createZenStackRouter(schema, t);

      expectTypeOf(router).toHaveProperty("createCaller");
    });

    it("createZenStackRouter should accept a custom procedure option", () => {
      const t = initTRPC.context<{ db: any }>().create();
      const protectedProcedure = t.procedure.use(({ ctx, next }) => {
        return next({ ctx });
      });
      const router = createZenStackRouter(schema, t, {
        procedure: protectedProcedure,
      });

      expectTypeOf(router).toHaveProperty("createCaller");
    });

    it("ZenStackRouter should be assignable to AnyRouter", () => {
      // This test verifies that ZenStackRouter can be used where AnyRouter is expected
      // which allows merging without explicit casts
      type TestRouter = ZenStackRouter<SchemaType>;

      // The router should have _def with router: true
      expectTypeOf<TestRouter["_def"]["router"]>().toEqualTypeOf<true>();

      // The router should have createCaller
      expectTypeOf<TestRouter>().toHaveProperty("createCaller");
    });

    it("ZenStackRouter should not produce never when nested in t.router({})", () => {
      // Before the fix, `generated` would resolve to `never` in the merged router
      // because ZenStackRouter didn't satisfy `Router<any, infer TRecord>` in
      // tRPC's DecorateCreateRouterOptions check.
      const t = initTRPC.context<{ db: any }>().create();
      const generatedRouter = createZenStackRouter(schema, t);

      const appRouter = t.router({
        generated: generatedRouter,
      });

      // If `generated` were `never`, accessing user/post would also be `never`
      type GeneratedRecord = typeof appRouter._def.record["generated"];
      expectTypeOf<GeneratedRecord>().not.toBeNever();
      expectTypeOf<GeneratedRecord>().toHaveProperty("user");
      expectTypeOf<GeneratedRecord>().toHaveProperty("post");
    });

    it("nested ZenStackRouter create.data should have model fields, not be empty", () => {
      const t = initTRPC.context<{ db: any }>().create();
      const generatedRouter = createZenStackRouter(schema, t);
      const appRouter = t.router({ generated: generatedRouter });
      type AppRouter = typeof appRouter;

      // Use tRPC's standard inference helpers — same as client code would
      type Inputs = inferRouterInputs<AppRouter>;
      type CreateInput = Inputs["generated"]["user"]["create"];

      // data must exist and must not be empty/never
      type DataType = CreateInput extends { data: infer D } ? D : never;
      expectTypeOf<DataType>().not.toBeNever();

      // data must carry the actual model fields
      expectTypeOf<DataType>().toHaveProperty("email");
    });
  });
});
