import { describe, it, expect } from "vitest";
import { z } from "zod";
import { schema } from "./fixtures/zenstack/schema.js";
import {
  createWhereSchema,
  createCreateDataSchema,
  createUpdateDataSchema,
  createUniqueWhereSchema,
  createSelectSchema,
  createIncludeSchema,
  createOrderBySchema,
  createModelSchemas,
} from "../src/zod-schemas.js";

describe("Zod Schema Generators", () => {
  describe("createWhereSchema", () => {
    it("should create a valid where schema for User model", () => {
      const whereSchema = createWhereSchema(schema, "User");

      // Valid inputs
      expect(() => whereSchema.parse({})).not.toThrow();
      expect(() => whereSchema.parse({ email: "test@example.com" })).not.toThrow();
      expect(() => whereSchema.parse({ name: "Alice" })).not.toThrow();
      expect(() => whereSchema.parse({ id: "123" })).not.toThrow();
    });

    it("should accept filter operators", () => {
      const whereSchema = createWhereSchema(schema, "User");

      expect(() =>
        whereSchema.parse({
          email: { contains: "example.com" },
        })
      ).not.toThrow();

      expect(() =>
        whereSchema.parse({
          email: { startsWith: "alice" },
        })
      ).not.toThrow();

      expect(() =>
        whereSchema.parse({
          email: { endsWith: ".com" },
        })
      ).not.toThrow();
    });

    it("should accept logical operators", () => {
      const whereSchema = createWhereSchema(schema, "User");

      expect(() =>
        whereSchema.parse({
          AND: [{ email: "test@example.com" }, { name: "Alice" }],
        })
      ).not.toThrow();

      expect(() =>
        whereSchema.parse({
          OR: [{ email: "test1@example.com" }, { email: "test2@example.com" }],
        })
      ).not.toThrow();

      expect(() =>
        whereSchema.parse({
          NOT: { email: "test@example.com" },
        })
      ).not.toThrow();
    });

    it("should create a valid where schema for Post model", () => {
      const whereSchema = createWhereSchema(schema, "Post");

      expect(() => whereSchema.parse({})).not.toThrow();
      expect(() => whereSchema.parse({ title: "Hello" })).not.toThrow();
      expect(() => whereSchema.parse({ published: true })).not.toThrow();
      expect(() => whereSchema.parse({ authorId: "123" })).not.toThrow();
    });
  });

  describe("createCreateDataSchema", () => {
    it("should create a valid create data schema for User", () => {
      const createSchema = createCreateDataSchema(schema, "User");

      // Required field only
      expect(() =>
        createSchema.parse({
          email: "test@example.com",
        })
      ).not.toThrow();

      // With optional fields
      expect(() =>
        createSchema.parse({
          email: "test@example.com",
          name: "Alice",
        })
      ).not.toThrow();
    });

    it("should allow optional fields to be omitted", () => {
      const createSchema = createCreateDataSchema(schema, "User");

      // id, name, createdAt, updatedAt should all be optional
      const result = createSchema.parse({
        email: "test@example.com",
      }) as { email: string };

      expect(result.email).toBe("test@example.com");
    });

    it("should create a valid create data schema for Post", () => {
      const createSchema = createCreateDataSchema(schema, "Post");

      expect(() =>
        createSchema.parse({
          title: "Hello World",
          authorId: "123",
        })
      ).not.toThrow();

      expect(() =>
        createSchema.parse({
          title: "Hello World",
          content: "This is content",
          published: true,
          authorId: "123",
        })
      ).not.toThrow();
    });

    it("should accept relation operations", () => {
      const createSchema = createCreateDataSchema(schema, "User");

      expect(() =>
        createSchema.parse({
          email: "test@example.com",
          posts: {
            create: { title: "Hello", authorId: "123" },
          },
        })
      ).not.toThrow();

      expect(() =>
        createSchema.parse({
          email: "test@example.com",
          posts: {
            connect: [{ id: "123" }],
          },
        })
      ).not.toThrow();
    });
  });

  describe("createUpdateDataSchema", () => {
    it("should create a valid update data schema for User", () => {
      const updateSchema = createUpdateDataSchema(schema, "User");

      expect(() =>
        updateSchema.parse({
          name: "New Name",
        })
      ).not.toThrow();

      expect(() =>
        updateSchema.parse({
          email: "new@example.com",
          name: "New Name",
        })
      ).not.toThrow();
    });

    it("should allow all fields to be optional for updates", () => {
      const updateSchema = createUpdateDataSchema(schema, "User");

      expect(() => updateSchema.parse({})).not.toThrow();
    });

    it("should accept relation update operations", () => {
      const updateSchema = createUpdateDataSchema(schema, "User");

      expect(() =>
        updateSchema.parse({
          posts: {
            create: { title: "New Post" },
          },
        })
      ).not.toThrow();

      expect(() =>
        updateSchema.parse({
          posts: {
            connect: { id: "123" },
          },
        })
      ).not.toThrow();

      expect(() =>
        updateSchema.parse({
          posts: {
            disconnect: { id: "123" },
          },
        })
      ).not.toThrow();

      expect(() =>
        updateSchema.parse({
          posts: {
            delete: { id: "123" },
          },
        })
      ).not.toThrow();
    });
  });

  describe("createUniqueWhereSchema", () => {
    it("should create schema accepting id field", () => {
      const uniqueSchema = createUniqueWhereSchema(schema, "User");

      expect(() => uniqueSchema.parse({ id: "123" })).not.toThrow();
    });

    it("should create schema accepting unique email field", () => {
      const uniqueSchema = createUniqueWhereSchema(schema, "User");

      expect(() => uniqueSchema.parse({ email: "test@example.com" })).not.toThrow();
    });

    it("should work for Post model", () => {
      const uniqueSchema = createUniqueWhereSchema(schema, "Post");

      expect(() => uniqueSchema.parse({ id: "123" })).not.toThrow();
    });
  });

  describe("createSelectSchema", () => {
    it("should allow selecting individual fields", () => {
      const selectSchema = createSelectSchema(schema, "User");

      expect(() =>
        selectSchema.parse({
          id: true,
          email: true,
          name: true,
        })
      ).not.toThrow();
    });

    it("should allow selecting relations", () => {
      const selectSchema = createSelectSchema(schema, "User");

      expect(() =>
        selectSchema.parse({
          id: true,
          posts: true,
        })
      ).not.toThrow();
    });

    it("should allow undefined (select all)", () => {
      const selectSchema = createSelectSchema(schema, "User");

      expect(() => selectSchema.parse(undefined)).not.toThrow();
    });
  });

  describe("createIncludeSchema", () => {
    it("should allow including relations", () => {
      const includeSchema = createIncludeSchema(schema, "User");

      expect(() =>
        includeSchema.parse({
          posts: true,
        })
      ).not.toThrow();
    });

    it("should allow nested include options", () => {
      const includeSchema = createIncludeSchema(schema, "User");

      expect(() =>
        includeSchema.parse({
          posts: {
            where: { published: true },
          },
        })
      ).not.toThrow();
    });

    it("should work for Post model with author relation", () => {
      const includeSchema = createIncludeSchema(schema, "Post");

      expect(() =>
        includeSchema.parse({
          author: true,
        })
      ).not.toThrow();
    });
  });

  describe("createOrderBySchema", () => {
    it("should accept asc/desc for scalar fields", () => {
      const orderBySchema = createOrderBySchema(schema, "User");

      expect(() =>
        orderBySchema.parse({
          email: "asc",
        })
      ).not.toThrow();

      expect(() =>
        orderBySchema.parse({
          name: "desc",
        })
      ).not.toThrow();

      expect(() =>
        orderBySchema.parse({
          createdAt: "desc",
        })
      ).not.toThrow();
    });

    it("should accept array of orderBy", () => {
      const orderBySchema = createOrderBySchema(schema, "User");

      expect(() =>
        orderBySchema.parse([{ createdAt: "desc" }, { email: "asc" }])
      ).not.toThrow();
    });
  });

  describe("createModelSchemas", () => {
    it("should create all operation schemas for User model", () => {
      const schemas = createModelSchemas(schema, "User");

      expect(schemas).toHaveProperty("findMany");
      expect(schemas).toHaveProperty("findUnique");
      expect(schemas).toHaveProperty("findFirst");
      expect(schemas).toHaveProperty("create");
      expect(schemas).toHaveProperty("createMany");
      expect(schemas).toHaveProperty("update");
      expect(schemas).toHaveProperty("updateMany");
      expect(schemas).toHaveProperty("upsert");
      expect(schemas).toHaveProperty("delete");
      expect(schemas).toHaveProperty("deleteMany");
      expect(schemas).toHaveProperty("count");
      expect(schemas).toHaveProperty("aggregate");
      expect(schemas).toHaveProperty("groupBy");
    });

    it("findMany schema should validate correctly", () => {
      const schemas = createModelSchemas(schema, "User");

      expect(() => schemas.findMany.parse(undefined)).not.toThrow();
      expect(() => schemas.findMany.parse({})).not.toThrow();
      expect(() =>
        schemas.findMany.parse({
          where: { email: "test@example.com" },
          include: { posts: true },
          orderBy: { createdAt: "desc" },
          skip: 0,
          take: 10,
        })
      ).not.toThrow();
    });

    it("findUnique schema should require where", () => {
      const schemas = createModelSchemas(schema, "User");

      expect(() =>
        schemas.findUnique.parse({
          where: { id: "123" },
        })
      ).not.toThrow();

      expect(() =>
        schemas.findUnique.parse({
          where: { email: "test@example.com" },
          include: { posts: true },
        })
      ).not.toThrow();
    });

    it("create schema should validate data field", () => {
      const schemas = createModelSchemas(schema, "User");

      expect(() =>
        schemas.create.parse({
          data: { email: "test@example.com" },
        })
      ).not.toThrow();

      expect(() =>
        schemas.create.parse({
          data: { email: "test@example.com", name: "Alice" },
          include: { posts: true },
        })
      ).not.toThrow();
    });

    it("update schema should validate where and data", () => {
      const schemas = createModelSchemas(schema, "User");

      expect(() =>
        schemas.update.parse({
          where: { id: "123" },
          data: { name: "New Name" },
        })
      ).not.toThrow();
    });

    it("delete schema should require where", () => {
      const schemas = createModelSchemas(schema, "User");

      expect(() =>
        schemas.delete.parse({
          where: { id: "123" },
        })
      ).not.toThrow();
    });

    it("count schema should be optional", () => {
      const schemas = createModelSchemas(schema, "User");

      expect(() => schemas.count.parse(undefined)).not.toThrow();
      expect(() => schemas.count.parse({})).not.toThrow();
      expect(() =>
        schemas.count.parse({
          where: { email: { contains: "example.com" } },
        })
      ).not.toThrow();
    });

    it("aggregate schema should validate aggregation fields", () => {
      const schemas = createModelSchemas(schema, "Post");

      expect(() =>
        schemas.aggregate.parse({
          _count: true,
        })
      ).not.toThrow();

      expect(() =>
        schemas.aggregate.parse({
          where: { published: true },
          _count: true,
        })
      ).not.toThrow();
    });

    it("groupBy schema should require by field", () => {
      const schemas = createModelSchemas(schema, "Post");

      expect(() =>
        schemas.groupBy.parse({
          by: "published",
          _count: true,
        })
      ).not.toThrow();

      expect(() =>
        schemas.groupBy.parse({
          by: ["published", "authorId"],
          _count: true,
        })
      ).not.toThrow();
    });
  });
});
