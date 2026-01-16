import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { initTRPC, TRPCError } from "@trpc/server";
import { schema, SchemaType } from "./fixtures/zenstack/schema.js";
import { createZenStackRouter, type ZenStackRouter } from "../src/index.js";
import { createTestDb, setupTestDb, cleanupTestDb, removeTestDb } from "./setup.js";

type TestDb = ReturnType<typeof createTestDb>;
type TestContext = { db: TestDb };

describe("Router Generator", () => {
  let db: TestDb;
  let appRouter: ZenStackRouter<SchemaType, TestContext>;
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(async () => {
    db = createTestDb();
    await setupTestDb(db);
    const t = initTRPC.context<TestContext>().create();
    appRouter = createZenStackRouter(schema, t);
    caller = appRouter.createCaller({ db });
  });

  beforeEach(async () => {
    // Clean via tRPC caller to ensure consistency
    await caller.post.deleteMany({});
    await caller.user.deleteMany({});
  });

  afterAll(async () => {
    await db.$disconnect();
    removeTestDb();
  });

  describe("createZenStackRouter", () => {
    it("should create router with model namespaces", () => {
      expect(appRouter).toBeDefined();
      expect(caller.user).toBeDefined();
      expect(caller.post).toBeDefined();
    });

    it("should have all CRUD operations for User model", () => {
      expect(caller.user.findMany).toBeDefined();
      expect(caller.user.findUnique).toBeDefined();
      expect(caller.user.findFirst).toBeDefined();
      expect(caller.user.create).toBeDefined();
      expect(caller.user.createMany).toBeDefined();
      expect(caller.user.update).toBeDefined();
      expect(caller.user.updateMany).toBeDefined();
      expect(caller.user.upsert).toBeDefined();
      expect(caller.user.delete).toBeDefined();
      expect(caller.user.deleteMany).toBeDefined();
      expect(caller.user.count).toBeDefined();
      expect(caller.user.aggregate).toBeDefined();
      expect(caller.user.groupBy).toBeDefined();
    });

    it("should have all CRUD operations for Post model", () => {
      expect(caller.post.findMany).toBeDefined();
      expect(caller.post.findUnique).toBeDefined();
      expect(caller.post.findFirst).toBeDefined();
      expect(caller.post.create).toBeDefined();
      expect(caller.post.createMany).toBeDefined();
      expect(caller.post.update).toBeDefined();
      expect(caller.post.updateMany).toBeDefined();
      expect(caller.post.upsert).toBeDefined();
      expect(caller.post.delete).toBeDefined();
      expect(caller.post.deleteMany).toBeDefined();
      expect(caller.post.count).toBeDefined();
      expect(caller.post.aggregate).toBeDefined();
      expect(caller.post.groupBy).toBeDefined();
    });

    it("should allow overriding the base procedure", async () => {
      type ProtectedContext = TestContext & { user?: { id: string } };
      const t = initTRPC.context<ProtectedContext>().create();
      const protectedProcedure = t.procedure.use(({ ctx, next }) => {
        if (!ctx.user) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }
        return next({ ctx });
      });
      const protectedRouter = createZenStackRouter(schema, t, {
        procedure: protectedProcedure,
      });
      const protectedCaller = protectedRouter.createCaller({ db });

      await expect(protectedCaller.user.findMany()).rejects.toThrowError(
        TRPCError
      );

      const authedCaller = protectedRouter.createCaller({
        db,
        user: { id: "user_1" },
      });
      await expect(authedCaller.user.findMany()).resolves.toEqual([]);
    });
  });

  describe("User CRUD Operations", () => {
    describe("create", () => {
      it("should create a user with required fields", async () => {
        const user = await caller.user.create({
          data: {
            email: "test@example.com",
          },
        });

        expect(user).toBeDefined();
        expect(user.id).toBeDefined();
        expect(user.email).toBe("test@example.com");
        expect(user.createdAt).toBeDefined();
        expect(user.updatedAt).toBeDefined();
      });

      it("should create a user with optional fields", async () => {
        const user = await caller.user.create({
          data: {
            email: "test@example.com",
            name: "Test User",
          },
        });

        expect(user.email).toBe("test@example.com");
        expect(user.name).toBe("Test User");
      });

      it("should create a user with nested posts", async () => {
        const user = await caller.user.create({
          data: {
            email: "test@example.com",
            posts: {
              create: [
                { title: "Post 1" },
                { title: "Post 2" },
              ],
            },
          },
          include: {
            posts: true,
          },
        });

        expect(user.posts).toHaveLength(2);
        expect(user.posts[0].title).toBe("Post 1");
        expect(user.posts[1].title).toBe("Post 2");
      });
    });

    describe("findMany", () => {
      it("should return empty array when no users exist", async () => {
        const users = await caller.user.findMany();

        expect(users).toEqual([]);
      });

      it("should return all users", async () => {
        await caller.user.create({ data: { email: "user1@example.com" } });
        await caller.user.create({ data: { email: "user2@example.com" } });

        const users = await caller.user.findMany();

        expect(users).toHaveLength(2);
      });

      it("should filter users by where clause", async () => {
        await caller.user.create({ data: { email: "user1@example.com", name: "Alice" } });
        await caller.user.create({ data: { email: "user2@example.com", name: "Bob" } });

        const users = await caller.user.findMany({
          where: { name: "Alice" },
        });

        expect(users).toHaveLength(1);
        expect(users[0].name).toBe("Alice");
      });

      it("should order users", async () => {
        await caller.user.create({ data: { email: "b@example.com" } });
        await caller.user.create({ data: { email: "a@example.com" } });

        const users = await caller.user.findMany({
          orderBy: { email: "asc" },
        });

        expect(users[0].email).toBe("a@example.com");
        expect(users[1].email).toBe("b@example.com");
      });

      it("should support pagination with skip and take", async () => {
        await caller.user.create({ data: { email: "user1@example.com" } });
        await caller.user.create({ data: { email: "user2@example.com" } });
        await caller.user.create({ data: { email: "user3@example.com" } });

        const users = await caller.user.findMany({
          skip: 1,
          take: 1,
          orderBy: { email: "asc" },
        });

        expect(users).toHaveLength(1);
        expect(users[0].email).toBe("user2@example.com");
      });

      it("should include relations", async () => {
        await caller.user.create({
          data: {
            email: "test@example.com",
            posts: {
              create: { title: "Test Post" },
            },
          },
        });

        const users = await caller.user.findMany({
          include: { posts: true },
        });

        expect(users[0].posts).toHaveLength(1);
        expect(users[0].posts[0].title).toBe("Test Post");
      });
    });

    describe("findUnique", () => {
      it("should find user by id", async () => {
        const created = await caller.user.create({
          data: { email: "test@example.com" },
        });

        const found = await caller.user.findUnique({
          where: { id: created.id },
        });

        expect(found).toBeDefined();
        expect(found?.id).toBe(created.id);
      });

      it("should find user by unique email", async () => {
        await caller.user.create({
          data: { email: "test@example.com" },
        });

        const found = await caller.user.findUnique({
          where: { email: "test@example.com" },
        });

        expect(found).toBeDefined();
        expect(found?.email).toBe("test@example.com");
      });

      it("should return null when user not found", async () => {
        const found = await caller.user.findUnique({
          where: { id: "nonexistent" },
        });

        expect(found).toBeNull();
      });
    });

    describe("findFirst", () => {
      it("should find first user matching criteria", async () => {
        await caller.user.create({ data: { email: "user1@example.com", name: "Alice" } });
        await caller.user.create({ data: { email: "user2@example.com", name: "Alice" } });

        const found = await caller.user.findFirst({
          where: { name: "Alice" },
          orderBy: { email: "asc" },
        });

        expect(found).toBeDefined();
        expect(found?.email).toBe("user1@example.com");
      });

      it("should return null when no match found", async () => {
        const found = await caller.user.findFirst({
          where: { name: "Nonexistent" },
        });

        expect(found).toBeNull();
      });
    });

    describe("update", () => {
      it("should update user fields", async () => {
        const created = await caller.user.create({
          data: { email: "test@example.com" },
        });

        const updated = await caller.user.update({
          where: { id: created.id },
          data: { name: "Updated Name" },
        });

        expect(updated.name).toBe("Updated Name");
      });

      it("should update user email", async () => {
        const created = await caller.user.create({
          data: { email: "old@example.com" },
        });

        const updated = await caller.user.update({
          where: { id: created.id },
          data: { email: "new@example.com" },
        });

        expect(updated.email).toBe("new@example.com");
      });
    });

    describe("updateMany", () => {
      it("should update multiple users", async () => {
        await caller.user.create({ data: { email: "user1@example.com" } });
        await caller.user.create({ data: { email: "user2@example.com" } });

        const result = await caller.user.updateMany({
          data: { name: "Updated" },
        });

        expect(result.count).toBe(2);

        const users = await caller.user.findMany();
        expect(users.every((u) => u.name === "Updated")).toBe(true);
      });

      it("should update users matching criteria only", async () => {
        await caller.user.create({ data: { email: "user1@example.com", name: "Alice" } });
        await caller.user.create({ data: { email: "user2@example.com", name: "Bob" } });

        await caller.user.updateMany({
          where: { name: "Alice" },
          data: { name: "Updated Alice" },
        });

        const users = await caller.user.findMany({ orderBy: { email: "asc" } });
        expect(users[0].name).toBe("Updated Alice");
        expect(users[1].name).toBe("Bob");
      });
    });

    describe("upsert", () => {
      it("should create user when not exists", async () => {
        const user = await caller.user.upsert({
          where: { email: "new@example.com" },
          create: { email: "new@example.com", name: "New User" },
          update: { name: "Updated User" },
        });

        expect(user.email).toBe("new@example.com");
        expect(user.name).toBe("New User");
      });

      it("should update user when exists", async () => {
        await caller.user.create({
          data: { email: "existing@example.com", name: "Original" },
        });

        const user = await caller.user.upsert({
          where: { email: "existing@example.com" },
          create: { email: "existing@example.com", name: "New User" },
          update: { name: "Updated User" },
        });

        expect(user.name).toBe("Updated User");
      });
    });

    describe("delete", () => {
      it("should delete user by id", async () => {
        const created = await caller.user.create({
          data: { email: "test@example.com" },
        });

        const deleted = await caller.user.delete({
          where: { id: created.id },
        });

        expect(deleted.id).toBe(created.id);

        const found = await caller.user.findUnique({
          where: { id: created.id },
        });
        expect(found).toBeNull();
      });
    });

    describe("deleteMany", () => {
      it("should delete all users", async () => {
        await caller.user.create({ data: { email: "user1@example.com" } });
        await caller.user.create({ data: { email: "user2@example.com" } });

        const result = await caller.user.deleteMany({});

        expect(result.count).toBe(2);

        const users = await caller.user.findMany();
        expect(users).toHaveLength(0);
      });

      it("should delete users matching criteria", async () => {
        await caller.user.create({ data: { email: "user1@example.com", name: "Delete" } });
        await caller.user.create({ data: { email: "user2@example.com", name: "Keep" } });

        const result = await caller.user.deleteMany({
          where: { name: "Delete" },
        });

        expect(result.count).toBe(1);

        const users = await caller.user.findMany();
        expect(users).toHaveLength(1);
        expect(users[0].name).toBe("Keep");
      });
    });

    describe("count", () => {
      it("should count all users", async () => {
        await caller.user.create({ data: { email: "user1@example.com" } });
        await caller.user.create({ data: { email: "user2@example.com" } });

        const count = await caller.user.count();

        expect(count).toBe(2);
      });

      it("should count users matching criteria", async () => {
        await caller.user.create({ data: { email: "user1@example.com", name: "Alice" } });
        await caller.user.create({ data: { email: "user2@example.com", name: "Bob" } });

        const count = await caller.user.count({
          where: { name: "Alice" },
        });

        expect(count).toBe(1);
      });
    });

    describe("aggregate", () => {
      it("should aggregate count", async () => {
        await caller.user.create({ data: { email: "user1@example.com" } });
        await caller.user.create({ data: { email: "user2@example.com" } });

        const result = await caller.user.aggregate({
          _count: true,
        });

        expect(result._count).toBe(2);
      });
    });
  });

  describe("Post CRUD Operations", () => {
    let userId: string;

    beforeEach(async () => {
      // Clean and create fresh user for each test
      await caller.post.deleteMany({});
      await caller.user.deleteMany({});
      const user = await caller.user.create({
        data: { email: "author@example.com" },
      });
      userId = user.id;
    });

    describe("create", () => {
      it("should create a post with required fields", async () => {
        const post = await caller.post.create({
          data: {
            title: "Test Post",
            authorId: userId,
          },
        });

        expect(post.title).toBe("Test Post");
        expect(post.authorId).toBe(userId);
        expect(post.published).toBe(false);
      });

      it("should create a post with all fields", async () => {
        const post = await caller.post.create({
          data: {
            title: "Test Post",
            content: "Test content",
            published: true,
            authorId: userId,
          },
        });

        expect(post.title).toBe("Test Post");
        expect(post.content).toBe("Test content");
        expect(post.published).toBe(true);
      });
    });

    describe("findMany with filters", () => {
      it("should filter by published status", async () => {
        await caller.post.create({
          data: { title: "Published Post", published: true, authorId: userId },
        });
        await caller.post.create({
          data: { title: "Draft Post", published: false, authorId: userId },
        });

        const publishedPosts = await caller.post.findMany({
          where: { published: true },
        });

        expect(publishedPosts).toHaveLength(1);
        expect(publishedPosts[0].title).toBe("Published Post");
      });

      it("should filter by title contains", async () => {
        await caller.post.create({
          data: { title: "Published Post", published: true, authorId: userId },
        });
        await caller.post.create({
          data: { title: "Draft Post", published: false, authorId: userId },
        });

        const posts = await caller.post.findMany({
          where: {
            title: { contains: "Draft" },
          },
        });

        expect(posts).toHaveLength(1);
        expect(posts[0].title).toBe("Draft Post");
      });
    });

    describe("relations", () => {
      it("should include author relation", async () => {
        await caller.post.create({
          data: { title: "Test Post", authorId: userId },
        });

        const posts = await caller.post.findMany({
          include: { author: true },
        });

        expect(posts[0].author).toBeDefined();
        expect(posts[0].author.email).toBe("author@example.com");
      });
    });
  });

  describe("Error Handling", () => {
    it("should throw error when creating user with duplicate email", async () => {
      await caller.user.create({
        data: { email: "duplicate@example.com" },
      });

      await expect(
        caller.user.create({
          data: { email: "duplicate@example.com" },
        })
      ).rejects.toThrow();
    });

    it("should throw error when updating non-existent user", async () => {
      await expect(
        caller.user.update({
          where: { id: "nonexistent" },
          data: { name: "Test" },
        })
      ).rejects.toThrow();
    });

    it("should throw error when deleting non-existent user", async () => {
      await expect(
        caller.user.delete({
          where: { id: "nonexistent" },
        })
      ).rejects.toThrow();
    });
  });
});
