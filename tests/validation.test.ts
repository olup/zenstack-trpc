import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { initTRPC, TRPCError } from "@trpc/server";
import { schema } from "./fixtures/zenstack/schema.js";
import { createZenStackRouter } from "../src/index.js";
import {
  createWhereSchema,
  createCreateDataSchema,
  createModelSchemas,
} from "../src/zod-schemas.js";
import { createTestDb, setupTestDb, removeTestDb } from "./setup.js";

describe("Validation Tests", () => {
  let db: ReturnType<typeof createTestDb>;
  let t: ReturnType<typeof initTRPC.context<{ db: any }>["create"]>;
  let appRouter: ReturnType<typeof createZenStackRouter>;
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(async () => {
    db = createTestDb();
    await setupTestDb(db);
    t = initTRPC.context<{ db: any }>().create();
    appRouter = createZenStackRouter(schema, t);
    caller = appRouter.createCaller({ db });
  });

  beforeEach(async () => {
    await caller.post.deleteMany({});
    await caller.user.deleteMany({});
  });

  afterAll(async () => {
    await db.$disconnect();
    removeTestDb();
  });

  describe("Zod Schema Validation Failures", () => {
    describe("Where Schema Validation", () => {
      it("should reject invalid filter operators", () => {
        const whereSchema = createWhereSchema(schema, "User");

        // Invalid operator value type
        expect(() =>
          whereSchema.parse({
            email: { contains: 123 }, // should be string
          })
        ).toThrow();
      });

      it("should reject invalid boolean values", () => {
        const whereSchema = createWhereSchema(schema, "Post");

        expect(() =>
          whereSchema.parse({
            published: "yes", // should be boolean
          })
        ).toThrow();
      });
    });

    describe("Create Data Schema Validation", () => {
      it("should reject wrong type for email field", () => {
        const createSchema = createCreateDataSchema(schema, "User");

        expect(() =>
          createSchema.parse({
            email: 12345, // should be string
          })
        ).toThrow();
      });

      it("should reject wrong type for boolean field", () => {
        const createSchema = createCreateDataSchema(schema, "Post");

        expect(() =>
          createSchema.parse({
            title: "Test",
            published: "true", // should be boolean
            authorId: "123",
          })
        ).toThrow();
      });

      it("should reject array instead of single value", () => {
        const createSchema = createCreateDataSchema(schema, "User");

        expect(() =>
          createSchema.parse({
            email: ["test@example.com"], // should be single string
          })
        ).toThrow();
      });
    });

    describe("Operation Schema Validation", () => {
      const schemas = createModelSchemas(schema, "User");

      it("should reject findUnique without where clause", () => {
        expect(() =>
          schemas.findUnique.parse({
            // missing required 'where'
            include: { posts: true },
          })
        ).toThrow();
      });

      it("should reject create without data clause", () => {
        expect(() =>
          schemas.create.parse({
            // missing required 'data'
            include: { posts: true },
          })
        ).toThrow();
      });

      it("should reject update without where clause", () => {
        expect(() =>
          schemas.update.parse({
            // missing required 'where'
            data: { name: "Test" },
          })
        ).toThrow();
      });

      it("should reject update without data clause", () => {
        expect(() =>
          schemas.update.parse({
            where: { id: "123" },
            // missing required 'data'
          })
        ).toThrow();
      });

      it("should reject delete without where clause", () => {
        expect(() =>
          schemas.delete.parse({
            // missing required 'where'
          })
        ).toThrow();
      });

      it("should reject upsert without required clauses", () => {
        expect(() =>
          schemas.upsert.parse({
            where: { id: "123" },
            // missing 'create' and 'update'
          })
        ).toThrow();
      });

      it("should reject groupBy without by field", () => {
        expect(() =>
          schemas.groupBy.parse({
            // missing required 'by'
            _count: true,
          })
        ).toThrow();
      });

      it("should reject invalid skip value", () => {
        expect(() =>
          schemas.findMany.parse({
            skip: "10", // should be number
          })
        ).toThrow();
      });

      it("should reject invalid take value", () => {
        expect(() =>
          schemas.findMany.parse({
            take: "5", // should be number
          })
        ).toThrow();
      });

      it("should reject invalid orderBy direction", () => {
        expect(() =>
          schemas.findMany.parse({
            orderBy: { email: "ascending" }, // should be 'asc' or 'desc'
          })
        ).toThrow();
      });
    });
  });

  describe("tRPC Procedure Validation Failures", () => {
    describe("User operations", () => {
      it("should reject create with invalid email type", async () => {
        await expect(
          caller.user.create({
            data: {
              email: 12345 as any, // invalid type
            },
          })
        ).rejects.toThrow(TRPCError);
      });

      it("should reject create with invalid name type", async () => {
        await expect(
          caller.user.create({
            data: {
              email: "test@example.com",
              name: { first: "John" } as any, // should be string or null
            },
          })
        ).rejects.toThrow(TRPCError);
      });

      it("should reject findUnique with invalid where", async () => {
        await expect(
          caller.user.findUnique({
            where: "invalid" as any, // should be object
          })
        ).rejects.toThrow(TRPCError);
      });

      it("should reject findMany with invalid skip type", async () => {
        await expect(
          caller.user.findMany({
            skip: "10" as any, // should be number
          })
        ).rejects.toThrow(TRPCError);
      });

      it("should reject findMany with invalid take type", async () => {
        await expect(
          caller.user.findMany({
            take: "5" as any, // should be number
          })
        ).rejects.toThrow(TRPCError);
      });

      it("should reject update with invalid data type", async () => {
        const user = await caller.user.create({
          data: { email: "test@example.com" },
        });

        await expect(
          caller.user.update({
            where: { id: user.id },
            data: "invalid" as any, // should be object
          })
        ).rejects.toThrow(TRPCError);
      });

      it("should reject delete with invalid where type", async () => {
        await expect(
          caller.user.delete({
            where: null as any, // should be object
          })
        ).rejects.toThrow(TRPCError);
      });

      it("should reject count with invalid where type", async () => {
        await expect(
          caller.user.count({
            where: "invalid" as any, // should be object
          })
        ).rejects.toThrow(TRPCError);
      });

      it("should reject aggregate without required fields", async () => {
        // aggregate should work but validate the structure
        await expect(
          caller.user.aggregate({
            _count: "invalid" as any, // should be boolean or object
          })
        ).rejects.toThrow(TRPCError);
      });

      it("should reject groupBy with invalid by type", async () => {
        await expect(
          caller.user.groupBy({
            by: 123 as any, // should be string or array
          })
        ).rejects.toThrow(TRPCError);
      });
    });

    describe("Post operations", () => {
      it("should reject create with invalid published type", async () => {
        const user = await caller.user.create({
          data: { email: "author@example.com" },
        });

        await expect(
          caller.post.create({
            data: {
              title: "Test",
              published: "yes" as any, // should be boolean
              authorId: user.id,
            },
          })
        ).rejects.toThrow(TRPCError);
      });

      it("should reject create with invalid title type", async () => {
        const user = await caller.user.create({
          data: { email: "author@example.com" },
        });

        await expect(
          caller.post.create({
            data: {
              title: 123 as any, // should be string
              authorId: user.id,
            },
          })
        ).rejects.toThrow(TRPCError);
      });

      it("should reject findMany with invalid orderBy", async () => {
        await expect(
          caller.post.findMany({
            orderBy: { title: "invalid" as any }, // should be 'asc' or 'desc'
          })
        ).rejects.toThrow(TRPCError);
      });
    });

    describe("Validation error details", () => {
      it("should include validation error details in TRPCError", async () => {
        try {
          await caller.user.create({
            data: {
              email: 12345 as any,
            },
          });
          expect.fail("Should have thrown");
        } catch (error) {
          expect(error).toBeInstanceOf(TRPCError);
          expect((error as TRPCError).code).toBe("BAD_REQUEST");
          // The error should contain zod validation details
          expect((error as TRPCError).cause).toBeDefined();
        }
      });

      it("should provide meaningful error for missing required field", async () => {
        try {
          await caller.user.update({
            where: { id: "123" },
            // missing data field
          } as any);
          expect.fail("Should have thrown");
        } catch (error) {
          expect(error).toBeInstanceOf(TRPCError);
          expect((error as TRPCError).code).toBe("BAD_REQUEST");
        }
      });
    });
  });

  describe("Edge Case Validations", () => {
    it("should accept empty object for optional where in findMany", async () => {
      // This should NOT throw - empty where is valid
      const users = await caller.user.findMany({ where: {} });
      expect(Array.isArray(users)).toBe(true);
    });

    it("should accept undefined for optional findMany args", async () => {
      // This should NOT throw - undefined args is valid
      const users = await caller.user.findMany();
      expect(Array.isArray(users)).toBe(true);
    });

    it("should accept null for optional string fields", async () => {
      // This should NOT throw - null is valid for optional fields
      const user = await caller.user.create({
        data: {
          email: "test@example.com",
          name: null,
        },
      });
      expect(user.name).toBeNull();
    });

    it("should reject undefined for required string fields", async () => {
      await expect(
        caller.post.create({
          data: {
            title: undefined as any, // required field
            authorId: "123",
          },
        })
      ).rejects.toThrow();
    });

    it("should handle very deep nested validation", async () => {
      // Deep nested structure should be validated
      await expect(
        caller.user.findMany({
          where: {
            AND: [
              {
                OR: [
                  { email: 123 as any }, // invalid type deep in structure
                ],
              },
            ],
          },
        })
      ).rejects.toThrow(TRPCError);
    });
  });
});
