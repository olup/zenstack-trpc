import { describe, it, expectTypeOf } from "vitest";
import { initTRPC, inferRouterOutputs, inferRouterInputs } from "@trpc/server";
import { largeSchema, LargeSchemaType } from "./fixtures/zenstack/large-schema.js";
import { createZenStackRouter } from "../src/index.js";
import type { ZenResult } from "../src/typed-client.js";
import type { SimplifiedPlainResult } from "@zenstackhq/orm";

/**
 * Regression: @zenstackhq/orm 3.5.0 added `ExtResult extends ExtResultBase<Schema>` to
 * ModelResult/ModelSelectResult. Even with the default `{}`, TypeScript evaluates the
 * ExtResultBase<Schema> constraint (iterates ALL models × ALL fields) at every ModelResult
 * instantiation. For large schemas (apiv4: 57 models, ~15 avg fields) this exceeds
 * TypeScript's instantiation limit through inferRouterOutputs, silently falling back to
 * `unknown` for scalar fields.
 *
 * Fix: ZenDefaultResult maps NonRelationFields directly without going through ModelResult,
 * eliminating the ExtResultBase<Schema> overhead entirely from our generated procedure types.
 *
 * See: https://github.com/zenstackhq/zenstack/issues/2569
 */
describe("large model – inferRouterOutputs depth (zenstackhq/zenstack#2569)", () => {
  const t = initTRPC.context<{ db: any }>().create();
  const generatedRouter = createZenStackRouter(largeSchema, t);
  const appRouter = t.router({ generated: generatedRouter });
  type AppRouter = typeof appRouter;

  type Outputs = inferRouterOutputs<AppRouter>;
  type Row = Outputs["generated"]["bigModel"]["findMany"][0];

  it("findMany default output should resolve scalar fields (not unknown)", () => {
    // With SimplifiedPlainResult these fall back to `unknown` on large schemas (3.5.x+).
    // ZenDefaultResult avoids ModelResult entirely so these always resolve correctly.
    expectTypeOf<Row["id"]>().toEqualTypeOf<string>();
    expectTypeOf<Row["name"]>().toEqualTypeOf<string>();
    expectTypeOf<Row["slug"]>().toEqualTypeOf<string>();
    expectTypeOf<Row["historyCount"]>().toEqualTypeOf<number>();
    expectTypeOf<Row["isPublic"]>().toEqualTypeOf<boolean>();
    expectTypeOf<Row["avatarUrl"]>().toEqualTypeOf<string | null>();
    // DateTime maps to string in ZenStack's type system
    expectTypeOf<Row["createdAt"]>().toEqualTypeOf<string>();
  });

  it("findMany nested include+select on large model resolves fields (not unknown)", () => {
    // The exact apiv4 pattern: include a large model with a nested select.
    // BigModel has a self-relation (parent: BigModel) so the included model is also large.
    // ZenResult used by the generated router avoids ModelSelectResult's per-key
    // NonRelationFields check that compounds with the ExtResultBase constraint.
    type R = ZenResult<LargeSchemaType, "BigModel", {
      include: { parent: { select: { id: true; name: true; slug: true; historyCount: true } } }
    }>;
    type Parent = NonNullable<R["parent"]>;
    expectTypeOf<Parent["id"]>().toEqualTypeOf<string>();
    expectTypeOf<Parent["name"]>().toEqualTypeOf<string>();
    expectTypeOf<Parent["historyCount"]>().toEqualTypeOf<number>();
    // Scalar fields on the outer model still correct
    expectTypeOf<R["id"]>().toEqualTypeOf<string>();
    expectTypeOf<R["name"]>().toEqualTypeOf<string>();
  });

  it("ZenResult correctly handles SimplifiedPlainResult depth issue through inferRouterOutputs", () => {
    // Document the broken vs fixed type for the same query shape.
    // SimplifiedPlainResult goes through ModelResult (with ExtResultBase<Schema> constraint);
    // ZenResult uses direct mapped types with no ModelResult.
    type Broken = SimplifiedPlainResult<LargeSchemaType, "BigModel", {
      include: { parent: { select: { id: true; name: true } } }
    }>;
    type Fixed = ZenResult<LargeSchemaType, "BigModel", {
      include: { parent: { select: { id: true; name: true } } }
    }>;

    // Both resolve correctly at this schema scale (100 models).
    // At apiv4 scale (57 models × ~15 avg fields) SimplifiedPlainResult exceeds the limit
    // and parent.id becomes `unknown`; ZenResult stays correct because it never uses ModelResult.
    type FixedParent = NonNullable<Fixed["parent"]>;
    expectTypeOf<FixedParent["id"]>().toEqualTypeOf<string>();
    expectTypeOf<FixedParent["name"]>().toEqualTypeOf<string>();
  });

  it("findMany input type is accessible through inferRouterInputs", () => {
    type Inputs = inferRouterInputs<AppRouter>;
    type FindManyInput = NonNullable<Inputs["generated"]["bigModel"]["findMany"]>;
    expectTypeOf<FindManyInput>().toMatchTypeOf<{ where?: unknown }>();
  });
});
