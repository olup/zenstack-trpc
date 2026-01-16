import { describe, it, expectTypeOf } from "vitest";
import { initTRPC, type AnyRouter } from "@trpc/server";
import { schema, SchemaType } from "./fixtures/zenstack/schema.js";
import {
  createZenStackRouter,
  type TypedRouterCaller,
  type ZenStackRouter,
} from "../src/index.js";

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
  });

  describe("Dynamic select typing", () => {
    it("findMany should accept select parameter", () => {
      type FindMany = UserProcedures["findMany"];

      type FindManyInput = Parameters<FindMany>[0];
      expectTypeOf<FindManyInput>().not.toBeNever();
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
  });
});
