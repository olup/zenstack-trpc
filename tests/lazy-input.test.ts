import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { initTRPC } from "@trpc/server";
import { createQuerySchemaFactory } from "@zenstackhq/orm";
import { schema } from "./fixtures/zenstack/schema.js";
import { createZenStackRouter } from "../src/index.js";
import { createTestDb, setupTestDb, removeTestDb } from "./setup.js";

type TestDb = ReturnType<typeof createTestDb>;
type TestContext = { db: TestDb };

describe("lazy input schemas", () => {
  let db: TestDb;
  const t = initTRPC.context<TestContext>().create();

  beforeAll(async () => {
    db = createTestDb();
    await setupTestDb(db);
  });

  afterAll(async () => {
    await db.$disconnect();
    removeTestDb();
  });

  it("builds no input schema when the router is created", () => {
    const factory = createQuerySchemaFactory(schema);
    createZenStackRouter(schema, t, { zodFactory: factory });
    expect(factory.cacheStats.size).toBe(0);
  });

  it("builds a procedure's schema on its first call and reuses it afterwards", async () => {
    const factory = createQuerySchemaFactory(schema);
    const caller = createZenStackRouter(schema, t, { zodFactory: factory }).createCaller({ db });

    await caller.user.findMany({});
    const afterFindMany = factory.cacheStats.size;
    expect(afterFindMany).toBeGreaterThan(0);

    await caller.user.findMany({ take: 1 });
    expect(factory.cacheStats.size).toBe(afterFindMany);

    await caller.post.count({});
    expect(factory.cacheStats.size).toBeGreaterThan(afterFindMany);
  });

  it("still validates input through the lazy schema", async () => {
    const caller = createZenStackRouter(schema, t).createCaller({ db });
    await expect(caller.user.findMany({ bogus: 1 } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.user.findMany({ take: "x" } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("shares the ORM client's schema cache when given its $zod factory", async () => {
    const caller = createZenStackRouter(schema, t, { zodFactory: db.$zod }).createCaller({ db });
    const before = db.$zod.cacheStats.size;
    await caller.post.findFirst({});
    const keys = db.$zod.cacheStats.keys;
    expect(db.$zod.cacheStats.size).toBeGreaterThan(before);
    expect(keys.some((k) => k.includes("makeFindSchema") && k.includes("Post"))).toBe(true);
  });
});
