import { ZenStackClient } from "@zenstackhq/orm";
import { SqliteDialect } from "kysely";
import SQLite from "better-sqlite3";
import { schema } from "./fixtures/zenstack/schema.js";
import { beforeAll, beforeEach, afterAll } from "vitest";
import fs from "fs";
import path from "path";

const TEST_DB_PATH = "./tests/fixtures/test.db";

export function createTestDb() {
  // Remove existing test database
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  const db = new ZenStackClient(schema, {
    dialect: new SqliteDialect({
      database: new SQLite(TEST_DB_PATH),
    }),
  });

  return db;
}

export async function setupTestDb(db: ReturnType<typeof createTestDb>) {
  // Push schema to test database
  await db.$pushSchema();
}

export async function cleanupTestDb(db: ReturnType<typeof createTestDb>) {
  // Clean up all data
  await db.post.deleteMany();
  await db.user.deleteMany();
}

export function removeTestDb() {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
}
