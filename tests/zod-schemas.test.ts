import { describe, it, expect } from "vitest";
import { schema } from "./fixtures/zenstack/schema.js";
import { createQuerySchemaFactory } from "@zenstackhq/orm";

const factory = createQuerySchemaFactory(schema);

describe("ZodSchemaFactory", () => {
  describe("where schema (via makeFindManySchema)", () => {
    it("should accept empty where for User", () => {
      expect(() => factory.makeFindManySchema("User").parse({})).not.toThrow();
      expect(() =>
        factory.makeFindManySchema("User").parse({ where: {} })
      ).not.toThrow();
      expect(() =>
        factory.makeFindManySchema("User").parse({ where: { email: "test@example.com" } })
      ).not.toThrow();
      expect(() =>
        factory.makeFindManySchema("User").parse({ where: { id: "123" } })
      ).not.toThrow();
    });

    it("should accept filter operators", () => {
      expect(() =>
        factory.makeFindManySchema("User").parse({ where: { email: { contains: "example.com" } } })
      ).not.toThrow();
      expect(() =>
        factory.makeFindManySchema("User").parse({ where: { email: { startsWith: "alice" } } })
      ).not.toThrow();
      expect(() =>
        factory.makeFindManySchema("User").parse({ where: { email: { endsWith: ".com" } } })
      ).not.toThrow();
    });

    it("should accept logical operators", () => {
      expect(() =>
        factory.makeFindManySchema("User").parse({
          where: { AND: [{ email: "test@example.com" }, { name: "Alice" }] },
        })
      ).not.toThrow();
      expect(() =>
        factory.makeFindManySchema("User").parse({
          where: { OR: [{ email: "test1@example.com" }, { email: "test2@example.com" }] },
        })
      ).not.toThrow();
      expect(() =>
        factory.makeFindManySchema("User").parse({
          where: { NOT: { email: "test@example.com" } },
        })
      ).not.toThrow();
    });

    it("should accept empty where for Post", () => {
      expect(() => factory.makeFindManySchema("Post").parse({})).not.toThrow();
      expect(() =>
        factory.makeFindManySchema("Post").parse({ where: { title: "Hello" } })
      ).not.toThrow();
      expect(() =>
        factory.makeFindManySchema("Post").parse({ where: { published: true } })
      ).not.toThrow();
      expect(() =>
        factory.makeFindManySchema("Post").parse({ where: { authorId: "123" } })
      ).not.toThrow();
    });
  });

  describe("makeCreateSchema", () => {
    it("should accept required field only for User", () => {
      expect(() =>
        factory.makeCreateSchema("User").parse({ data: { email: "test@example.com" } })
      ).not.toThrow();
    });

    it("should accept optional fields for User", () => {
      expect(() =>
        factory.makeCreateSchema("User").parse({
          data: { email: "test@example.com", name: "Alice" },
        })
      ).not.toThrow();
    });

    it("should allow optional fields to be omitted for User", () => {
      const result = factory.makeCreateSchema("User").parse({
        data: { email: "test@example.com" },
      }) as { data: { email: string } };
      expect(result.data.email).toBe("test@example.com");
    });

    it("should accept required fields for Post", () => {
      expect(() =>
        factory.makeCreateSchema("Post").parse({
          data: { title: "Hello World", authorId: "123" },
        })
      ).not.toThrow();
      expect(() =>
        factory.makeCreateSchema("Post").parse({
          data: { title: "Hello World", content: "content", published: true, authorId: "123" },
        })
      ).not.toThrow();
    });

    it("should accept nested relation operations", () => {
      expect(() =>
        factory.makeCreateSchema("User").parse({
          data: { email: "test@example.com", posts: { connect: [{ id: "123" }] } },
        })
      ).not.toThrow();
    });
  });

  describe("makeUpdateSchema", () => {
    it("should accept partial data for User", () => {
      expect(() =>
        factory.makeUpdateSchema("User").parse({
          where: { id: "123" },
          data: { name: "New Name" },
        })
      ).not.toThrow();
      expect(() =>
        factory.makeUpdateSchema("User").parse({
          where: { id: "123" },
          data: { email: "new@example.com", name: "New Name" },
        })
      ).not.toThrow();
    });

    it("should allow empty data for updates", () => {
      expect(() =>
        factory.makeUpdateSchema("User").parse({
          where: { id: "123" },
          data: {},
        })
      ).not.toThrow();
    });

    it("should accept nested relation update operations", () => {
      expect(() =>
        factory.makeUpdateSchema("User").parse({
          where: { id: "123" },
          data: { posts: { connect: { id: "456" } } },
        })
      ).not.toThrow();
      expect(() =>
        factory.makeUpdateSchema("User").parse({
          where: { id: "123" },
          data: { posts: { disconnect: { id: "456" } } },
        })
      ).not.toThrow();
    });
  });

  describe("makeFindUniqueSchema (unique where)", () => {
    it("should accept id field for User", () => {
      expect(() =>
        factory.makeFindUniqueSchema("User").parse({ where: { id: "123" } })
      ).not.toThrow();
    });

    it("should accept unique email field for User", () => {
      expect(() =>
        factory.makeFindUniqueSchema("User").parse({ where: { email: "test@example.com" } })
      ).not.toThrow();
    });

    it("should work for Post model", () => {
      expect(() =>
        factory.makeFindUniqueSchema("Post").parse({ where: { id: "123" } })
      ).not.toThrow();
    });
  });

  describe("select (via makeFindManySchema)", () => {
    it("should allow selecting individual fields", () => {
      expect(() =>
        factory.makeFindManySchema("User").parse({ select: { id: true, email: true, name: true } })
      ).not.toThrow();
    });

    it("should allow selecting relations", () => {
      expect(() =>
        factory.makeFindManySchema("User").parse({ select: { id: true, posts: true } })
      ).not.toThrow();
    });

    it("should allow undefined select (select all)", () => {
      expect(() => factory.makeFindManySchema("User").parse(undefined)).not.toThrow();
      expect(() => factory.makeFindManySchema("User").parse({})).not.toThrow();
    });
  });

  describe("include (via makeFindManySchema)", () => {
    it("should allow including relations for User", () => {
      expect(() =>
        factory.makeFindManySchema("User").parse({ include: { posts: true } })
      ).not.toThrow();
    });

    it("should allow nested include options", () => {
      expect(() =>
        factory.makeFindManySchema("User").parse({ include: { posts: { where: { published: true } } } })
      ).not.toThrow();
    });

    it("should work for Post model with author relation", () => {
      expect(() =>
        factory.makeFindManySchema("Post").parse({ include: { author: true } })
      ).not.toThrow();
    });
  });

  describe("orderBy (via makeFindManySchema)", () => {
    it("should accept asc/desc for scalar fields", () => {
      expect(() =>
        factory.makeFindManySchema("User").parse({ orderBy: { email: "asc" } })
      ).not.toThrow();
      expect(() =>
        factory.makeFindManySchema("User").parse({ orderBy: { name: "desc" } })
      ).not.toThrow();
      expect(() =>
        factory.makeFindManySchema("User").parse({ orderBy: { createdAt: "desc" } })
      ).not.toThrow();
    });

    it("should accept array of orderBy", () => {
      expect(() =>
        factory.makeFindManySchema("User").parse({
          orderBy: [{ createdAt: "desc" }, { email: "asc" }],
        })
      ).not.toThrow();
    });
  });

  describe("all operation schemas for User model", () => {
    it("should produce schemas for all operations", () => {
      expect(factory.makeFindManySchema("User")).toBeDefined();
      expect(factory.makeFindUniqueSchema("User")).toBeDefined();
      expect(factory.makeFindFirstSchema("User")).toBeDefined();
      expect(factory.makeCreateSchema("User")).toBeDefined();
      expect(factory.makeCreateManySchema("User")).toBeDefined();
      expect(factory.makeUpdateSchema("User")).toBeDefined();
      expect(factory.makeUpdateManySchema("User")).toBeDefined();
      expect(factory.makeUpsertSchema("User")).toBeDefined();
      expect(factory.makeDeleteSchema("User")).toBeDefined();
      expect(factory.makeDeleteManySchema("User")).toBeDefined();
      expect(factory.makeCountSchema("User")).toBeDefined();
      expect(factory.makeAggregateSchema("User")).toBeDefined();
      expect(factory.makeGroupBySchema("User")).toBeDefined();
    });

    it("findMany schema should validate correctly", () => {
      expect(() => factory.makeFindManySchema("User").parse(undefined)).not.toThrow();
      expect(() => factory.makeFindManySchema("User").parse({})).not.toThrow();
      expect(() =>
        factory.makeFindManySchema("User").parse({
          where: { email: "test@example.com" },
          include: { posts: true },
          orderBy: { createdAt: "desc" },
          skip: 0,
          take: 10,
        })
      ).not.toThrow();
    });

    it("findUnique schema should require where", () => {
      expect(() =>
        factory.makeFindUniqueSchema("User").parse({ where: { id: "123" } })
      ).not.toThrow();
      expect(() =>
        factory.makeFindUniqueSchema("User").parse({
          where: { email: "test@example.com" },
          include: { posts: true },
        })
      ).not.toThrow();
    });

    it("create schema should validate data field", () => {
      expect(() =>
        factory.makeCreateSchema("User").parse({ data: { email: "test@example.com" } })
      ).not.toThrow();
      expect(() =>
        factory.makeCreateSchema("User").parse({
          data: { email: "test@example.com", name: "Alice" },
          include: { posts: true },
        })
      ).not.toThrow();
    });

    it("update schema should validate where and data", () => {
      expect(() =>
        factory.makeUpdateSchema("User").parse({
          where: { id: "123" },
          data: { name: "New Name" },
        })
      ).not.toThrow();
    });

    it("delete schema should require where", () => {
      expect(() =>
        factory.makeDeleteSchema("User").parse({ where: { id: "123" } })
      ).not.toThrow();
    });

    it("count schema should be optional", () => {
      expect(() => factory.makeCountSchema("User").parse(undefined)).not.toThrow();
      expect(() => factory.makeCountSchema("User").parse({})).not.toThrow();
      expect(() =>
        factory.makeCountSchema("User").parse({ where: { email: { contains: "example.com" } } })
      ).not.toThrow();
    });

    it("aggregate schema should validate aggregation fields", () => {
      expect(() =>
        factory.makeAggregateSchema("Post").parse({ _count: true })
      ).not.toThrow();
      expect(() =>
        factory.makeAggregateSchema("Post").parse({ where: { published: true }, _count: true })
      ).not.toThrow();
    });

    it("groupBy schema should require by field", () => {
      expect(() =>
        factory.makeGroupBySchema("Post").parse({ by: ["published"], _count: true })
      ).not.toThrow();
      expect(() =>
        factory.makeGroupBySchema("Post").parse({ by: ["published", "authorId"], _count: true })
      ).not.toThrow();
    });
  });
});
