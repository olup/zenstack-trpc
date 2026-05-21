import { describe, it, expectTypeOf } from "vitest";
import { initTRPC, inferRouterOutputs } from "@trpc/server";
import { schema, SchemaType } from "./fixtures/zenstack/apiv4-schema.js";
import { createZenStackRouter } from "../src/index.js";
import type { ZenResult } from "../src/typed-client.js";

/**
 * Regression test using the real apiv4 schema (57 models).
 *
 * Without the ZenDefaultResult fix, scalar fields on Agent resolve as `unknown`
 * through inferRouterOutputs when using @zenstackhq/orm 3.5.x because ModelResult's
 * new `ExtResult extends ExtResultBase<Schema>` constraint iterates all 57 models ×
 * all their fields at every instantiation, exceeding TypeScript's limit.
 *
 * See: https://github.com/zenstackhq/zenstack/issues/2569
 */
describe("apiv4 schema – inferRouterOutputs depth regression", () => {
  const t = initTRPC.context<{ db: any }>().create();
  const generatedRouter = createZenStackRouter(schema, t);
  const appRouter = t.router({ generated: generatedRouter });
  type AppRouter = typeof appRouter;

  type Outputs = inferRouterOutputs<AppRouter>;
  type AgentRow = Outputs["generated"]["agent"]["findMany"][0];

  it("Agent findMany scalar fields resolve correctly (not unknown)", () => {
    expectTypeOf<AgentRow["id"]>().toEqualTypeOf<string>();
    expectTypeOf<AgentRow["name"]>().toEqualTypeOf<string>();
    expectTypeOf<AgentRow["slug"]>().toEqualTypeOf<string>();
    expectTypeOf<AgentRow["avatarUrl"]>().toEqualTypeOf<string | null>();
    expectTypeOf<AgentRow["historyMessageCount"]>().toEqualTypeOf<number>();
    expectTypeOf<AgentRow["model"]>().toEqualTypeOf<string>();
    expectTypeOf<AgentRow["instructions"]>().toEqualTypeOf<string>();
    expectTypeOf<AgentRow["settingsConversationStarterEnabled"]>().toEqualTypeOf<boolean>();
    // DateTime fields map to string in ZenStack's type system
    expectTypeOf<AgentRow["createdAt"]>().toEqualTypeOf<string>();
    expectTypeOf<AgentRow["updatedAt"]>().toEqualTypeOf<string>();
  });

  it("App findMany scalar fields resolve correctly (not unknown)", () => {
    type AppRow = Outputs["generated"]["app"]["findMany"][0];
    expectTypeOf<AppRow["id"]>().toEqualTypeOf<string>();
    expectTypeOf<AppRow["name"]>().toEqualTypeOf<string>();
  });

  it("ZenResult with nested include+select on Agent resolves fields (not unknown)", () => {
    // Mirrors the exact pattern used in apiv4's AppAgents.tsx:
    // agent.findMany({ include: { app: { select: { id, name } } } })
    type R = ZenResult<SchemaType, "Agent", {
      include: { app: { select: { id: true; name: true } } }
    }>;
    type IncludedApp = NonNullable<R["app"]>;
    expectTypeOf<IncludedApp["id"]>().toEqualTypeOf<string>();
    expectTypeOf<IncludedApp["name"]>().toEqualTypeOf<string>();
    // Outer agent scalar fields still correct
    expectTypeOf<R["id"]>().toEqualTypeOf<string>();
    expectTypeOf<R["name"]>().toEqualTypeOf<string>();
    expectTypeOf<R["slug"]>().toEqualTypeOf<string>();
  });
});
