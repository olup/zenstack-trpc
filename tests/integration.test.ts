import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { schema } from "./fixtures/zenstack/schema.js";
import {
  createTRPC,
  createZenStackRouter,
  type Context,
} from "../src/index.js";
import { createTestDb, setupTestDb, removeTestDb } from "./setup.js";

describe("Integration Tests", () => {
  let db: ReturnType<typeof createTestDb>;
  let t: ReturnType<typeof createTRPC<Context>>;
  let appRouter: ReturnType<typeof createZenStackRouter>;
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(async () => {
    db = createTestDb();
    await setupTestDb(db);
    t = createTRPC<Context>();
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

  describe("Complex Queries", () => {
    beforeEach(async () => {
      // Create multiple users with posts
      await caller.user.create({
        data: {
          email: "alice@example.com",
          name: "Alice",
          posts: {
            create: [
              { title: "Alice Post 1", published: true },
              { title: "Alice Post 2", published: false },
              { title: "Alice Post 3", published: true },
            ],
          },
        },
      });

      await caller.user.create({
        data: {
          email: "bob@example.com",
          name: "Bob",
          posts: {
            create: [
              { title: "Bob Post 1", published: true },
              { title: "Bob Post 2", published: true },
            ],
          },
        },
      });

      await caller.user.create({
        data: {
          email: "charlie@example.com",
          name: "Charlie",
        },
      });
    });

    describe("Filtering", () => {
      it("should filter with AND condition", async () => {
        const posts = await caller.post.findMany({
          where: {
            AND: [
              { published: true },
              { title: { contains: "Alice" } },
            ],
          },
        });

        expect(posts).toHaveLength(2);
        expect(posts.every((p) => p.published && p.title.includes("Alice"))).toBe(true);
      });

      it("should filter with OR condition", async () => {
        const posts = await caller.post.findMany({
          where: {
            OR: [
              { title: "Alice Post 1" },
              { title: "Bob Post 1" },
            ],
          },
        });

        expect(posts).toHaveLength(2);
      });

      it("should filter with NOT condition", async () => {
        const posts = await caller.post.findMany({
          where: {
            NOT: { published: false },
          },
        });

        expect(posts.every((p) => p.published === true)).toBe(true);
      });
    });

    describe("Sorting", () => {
      it("should sort by single field ascending", async () => {
        const users = await caller.user.findMany({
          orderBy: { email: "asc" },
        });

        expect(users[0].email).toBe("alice@example.com");
        expect(users[1].email).toBe("bob@example.com");
        expect(users[2].email).toBe("charlie@example.com");
      });

      it("should sort by single field descending", async () => {
        const users = await caller.user.findMany({
          orderBy: { email: "desc" },
        });

        expect(users[0].email).toBe("charlie@example.com");
        expect(users[1].email).toBe("bob@example.com");
        expect(users[2].email).toBe("alice@example.com");
      });

      it("should sort by multiple fields", async () => {
        // Create users with same name
        await caller.user.create({ data: { email: "z@example.com", name: "Alice" } });

        const users = await caller.user.findMany({
          where: { name: "Alice" },
          orderBy: [{ name: "asc" }, { email: "asc" }],
        });

        expect(users[0].email).toBe("alice@example.com");
        expect(users[1].email).toBe("z@example.com");
      });
    });

    describe("Pagination", () => {
      it("should paginate with skip and take", async () => {
        const page1 = await caller.user.findMany({
          orderBy: { email: "asc" },
          take: 2,
        });

        const page2 = await caller.user.findMany({
          orderBy: { email: "asc" },
          skip: 2,
          take: 2,
        });

        expect(page1).toHaveLength(2);
        expect(page2).toHaveLength(1);
        expect(page1[0].email).toBe("alice@example.com");
        expect(page2[0].email).toBe("charlie@example.com");
      });

      it("should paginate with cursor", async () => {
        const allUsers = await caller.user.findMany({
          orderBy: { email: "asc" },
        });

        const afterFirst = await caller.user.findMany({
          orderBy: { email: "asc" },
          cursor: { id: allUsers[0].id },
          skip: 1,
          take: 2,
        });

        expect(afterFirst).toHaveLength(2);
        expect(afterFirst[0].email).toBe("bob@example.com");
      });
    });

    describe("Select and Include", () => {
      it("should select specific fields", async () => {
        const users = await caller.user.findMany({
          select: {
            email: true,
            name: true,
          },
        });

        expect(users[0]).toHaveProperty("email");
        expect(users[0]).toHaveProperty("name");
      });

      it("should include relations with nested select", async () => {
        const users = await caller.user.findMany({
          include: {
            posts: {
              select: {
                title: true,
                published: true,
              },
            },
          },
        });

        const userWithPosts = users.find(u => u.posts && u.posts.length > 0);
        expect(userWithPosts?.posts[0]).toHaveProperty("title");
        expect(userWithPosts?.posts[0]).toHaveProperty("published");
      });

      it("should include relations with where filter", async () => {
        const users = await caller.user.findMany({
          include: {
            posts: {
              where: { published: true },
            },
          },
        });

        const alice = users.find((u) => u.email === "alice@example.com");
        expect(alice?.posts).toHaveLength(2); // Only published posts
      });

      it("should include relations with orderBy", async () => {
        const users = await caller.user.findMany({
          where: { email: "alice@example.com" },
          include: {
            posts: {
              orderBy: { title: "desc" },
            },
          },
        });

        expect(users[0].posts[0].title).toBe("Alice Post 3");
      });
    });

    describe("Aggregations", () => {
      it("should count all records", async () => {
        const userCount = await caller.user.count();
        const postCount = await caller.post.count();

        expect(userCount).toBe(3);
        expect(postCount).toBe(5);
      });

      it("should count with filter", async () => {
        const publishedCount = await caller.post.count({
          where: { published: true },
        });

        expect(publishedCount).toBe(4);
      });

      it("should aggregate with _count", async () => {
        const result = await caller.post.aggregate({
          _count: true,
        });

        expect(result._count).toBe(5);
      });

      it("should aggregate with filter", async () => {
        const result = await caller.post.aggregate({
          where: { published: true },
          _count: true,
        });

        expect(result._count).toBe(4);
      });
    });

    describe("GroupBy", () => {
      it("should group by single field", async () => {
        const groups = await caller.post.groupBy({
          by: "published",
          _count: true,
        });

        expect(groups).toHaveLength(2);
        const publishedGroup = groups.find((g) => g.published === true);
        const draftGroup = groups.find((g) => g.published === false);
        expect(publishedGroup?._count).toBe(4);
        expect(draftGroup?._count).toBe(1);
      });
    });
  });

  describe("Nested Operations", () => {
    describe("Create with relations", () => {
      it("should create user with multiple nested posts", async () => {
        const user = await caller.user.create({
          data: {
            email: "nested@example.com",
            posts: {
              create: [
                { title: "Post 1", content: "Content 1" },
                { title: "Post 2", content: "Content 2" },
                { title: "Post 3", content: "Content 3" },
              ],
            },
          },
          include: { posts: true },
        });

        expect(user.posts).toHaveLength(3);
      });

      it("should create post with connect to existing user", async () => {
        const user = await caller.user.create({
          data: { email: "existing@example.com" },
        });

        const post = await caller.post.create({
          data: {
            title: "Connected Post",
            author: {
              connect: { id: user.id },
            },
          },
          include: { author: true },
        });

        expect(post.author.id).toBe(user.id);
      });
    });

    describe("Update with relations", () => {
      it("should update user and create new posts", async () => {
        const user = await caller.user.create({
          data: { email: "update@example.com" },
        });

        const updated = await caller.user.update({
          where: { id: user.id },
          data: {
            name: "Updated Name",
            posts: {
              create: { title: "New Post" },
            },
          },
          include: { posts: true },
        });

        expect(updated.name).toBe("Updated Name");
        expect(updated.posts).toHaveLength(1);
      });

      // Note: disconnect is not testable here because Post.authorId is required
      // Disconnecting would set authorId to null, violating the NOT NULL constraint

      it("should update user and delete posts", async () => {
        const user = await caller.user.create({
          data: {
            email: "delete-posts@example.com",
            posts: {
              create: [{ title: "Post 1" }, { title: "Post 2" }],
            },
          },
          include: { posts: true },
        });

        const postToDelete = user.posts[0];

        const updated = await caller.user.update({
          where: { id: user.id },
          data: {
            posts: {
              delete: { id: postToDelete.id },
            },
          },
          include: { posts: true },
        });

        expect(updated.posts).toHaveLength(1);

        // Verify post is deleted
        const deletedPost = await caller.post.findUnique({
          where: { id: postToDelete.id },
        });
        expect(deletedPost).toBeNull();
      });
    });
  });

  describe("Batch Operations", () => {
    it("should create many users at once", async () => {
      const result = await caller.user.createMany({
        data: [
          { email: "batch1@example.com" },
          { email: "batch2@example.com" },
          { email: "batch3@example.com" },
        ],
      });

      expect(result.count).toBe(3);

      const users = await caller.user.findMany();
      expect(users).toHaveLength(3);
    });

    it("should update many records at once", async () => {
      await caller.user.createMany({
        data: [
          { email: "update1@example.com" },
          { email: "update2@example.com" },
          { email: "update3@example.com" },
        ],
      });

      const result = await caller.user.updateMany({
        where: { email: { contains: "update" } },
        data: { name: "Batch Updated" },
      });

      expect(result.count).toBe(3);

      const users = await caller.user.findMany();
      expect(users.every((u) => u.name === "Batch Updated")).toBe(true);
    });

    it("should delete many records at once", async () => {
      await caller.user.createMany({
        data: [
          { email: "delete1@example.com", name: "ToDelete" },
          { email: "delete2@example.com", name: "ToDelete" },
          { email: "keep@example.com", name: "ToKeep" },
        ],
      });

      const result = await caller.user.deleteMany({
        where: { name: "ToDelete" },
      });

      expect(result.count).toBe(2);

      const users = await caller.user.findMany();
      expect(users).toHaveLength(1);
      expect(users[0].name).toBe("ToKeep");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty where clause", async () => {
      await caller.user.create({ data: { email: "test@example.com" } });

      const users = await caller.user.findMany({ where: {} });
      expect(users).toHaveLength(1);
    });

    it("should handle null optional fields", async () => {
      const user = await caller.user.create({
        data: { email: "null@example.com", name: null },
      });

      expect(user.name).toBeNull();
    });

    it("should handle updating to null", async () => {
      const user = await caller.user.create({
        data: { email: "tonull@example.com", name: "Has Name" },
      });

      const updated = await caller.user.update({
        where: { id: user.id },
        data: { name: null },
      });

      expect(updated.name).toBeNull();
    });

    it("should handle findMany with no results", async () => {
      const users = await caller.user.findMany({
        where: { email: "nonexistent@example.com" },
      });

      expect(users).toEqual([]);
    });

    it("should handle count with no results", async () => {
      const count = await caller.user.count({
        where: { email: "nonexistent@example.com" },
      });

      expect(count).toBe(0);
    });

    it("should handle special characters in strings", async () => {
      const user = await caller.user.create({
        data: {
          email: "special+chars@example.com",
          name: "User's Name \"Quoted\"",
        },
      });

      expect(user.email).toBe("special+chars@example.com");
      expect(user.name).toBe("User's Name \"Quoted\"");
    });

    it("should handle very long strings", async () => {
      const longName = "A".repeat(1000);
      const user = await caller.user.create({
        data: {
          email: "longname@example.com",
          name: longName,
        },
      });

      expect(user.name).toBe(longName);
    });
  });
});
