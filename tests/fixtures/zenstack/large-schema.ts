/* eslint-disable */
/**
 * Fixture: a schema large enough to reproduce the TypeScript instantiation-depth bug
 * introduced in @zenstackhq/orm@3.5.0.
 *
 * Root cause (zenstackhq/zenstack#2569):
 *   3.5.0 added `ExtResult extends ExtResultBase<Schema>` to ModelResult/ModelSelectResult.
 *   Even with the default `{}`, TypeScript evaluates the ExtResultBase<Schema> constraint at
 *   every level of the recursive ModelResult chain. ExtResultBase<Schema> iterates ALL models
 *   via GetModels<Schema> and ALL non-relation fields via NonRelationFields<Schema, M>, so
 *   the cost compounds with schema size. With ~50+ models, inferRouterOutputs exceeds
 *   TypeScript's instantiation limit and scalar fields fall back to `unknown`.
 *
 * Design:
 *   - BigModel: ~30 scalar fields + relations — mirrors apiv4's Agent model (the first model
 *     that exhibited the bug)
 *   - 46 stub models with minimal fields — inflate the schema breadth so inferRouterOutputs
 *     has to resolve the full set of procedure output types (13 per model)
 */

import { type SchemaDef, ExpressionUtils } from "@zenstackhq/orm/schema";

// Use separate helpers (no conditional spreads) so TypeScript infers exact literal types.
// `as const` on the return ensures `type: "String"` stays a literal, not widened to `string`.
const s  = (n: string) => ({ name: n, type: "String"   as const });
const so = (n: string) => ({ name: n, type: "String"   as const, optional: true as const });
const b  = (n: string, d: boolean) => ({ name: n, type: "Boolean"  as const, attributes: [{ name: "@default", args: [{ name: "value", value: ExpressionUtils.literal(d) }] }] as const, default: ExpressionUtils.literal(d) });
const i  = (n: string, d: number)  => ({ name: n, type: "Int"      as const, attributes: [{ name: "@default", args: [{ name: "value", value: ExpressionUtils.literal(d) }] }] as const, default: ExpressionUtils.literal(d) });
const io = (n: string) => ({ name: n, type: "Int"      as const, optional: true as const });
const fo = (n: string) => ({ name: n, type: "Float"    as const, optional: true as const });
const dt = (n: string) => ({ name: n, type: "DateTime" as const, attributes: [{ name: "@default", args: [{ name: "value", value: ExpressionUtils.call("now") }] }] as const, default: ExpressionUtils.call("now") });
const dtu = (n: string) => ({ name: n, type: "DateTime" as const, updatedAt: true as const, attributes: [{ name: "@updatedAt" }] as const });
const dto = (n: string) => ({ name: n, type: "DateTime" as const, optional: true as const });
const idF = () => ({ name: "id", type: "String" as const, id: true as const, attributes: [{ name: "@id" }, { name: "@default", args: [{ name: "value", value: ExpressionUtils.call("cuid") }] }] as const, default: ExpressionUtils.call("cuid") });

// Stub models with ~10 scalar fields each so ExtResultBase<Schema> accumulates meaningful depth.
// apiv4 has 57 models × ~15 avg fields = ~855 total fields. We target ~900 to exceed the threshold.
const stubModel = (modelName: string) => ({
  name: modelName,
  fields: {
    id:      idF(),
    label:   s("label"),
    slug:    s("slug"),
    status:  s("status"),
    count:   i("count", 0),
    active:  b("active", true),
    notes:   so("notes"),
    ref:     so("ref"),
    score:   io("score"),
    kind:    s("kind"),
  },
  idFields: ["id"] as const,
  uniqueFields: { id: { type: "String" } },
} as const);

export class LargeSchemaType implements SchemaDef {
  provider = { type: "sqlite" } as const;

  models = {
    /**
     * The "big" model — mirrors apiv4's Agent (34 fields: 20 scalar + 12 relations + 2 FKs).
     * This is the model where selected fields became `unknown` through inferRouterOutputs.
     */
    BigModel: {
      name: "BigModel",
      fields: {
        id:                  idF(),
        createdAt:           dt("createdAt"),
        updatedAt:           dtu("updatedAt"),
        name:                s("name"),
        slug:                { name: "slug", type: "String" as const, unique: true as const, attributes: [{ name: "@unique" }] as const },
        status:              s("status"),
        avatarUrl:           so("avatarUrl"),
        instructions:        { name: "instructions", type: "String" as const, attributes: [{ name: "@default", args: [{ name: "value", value: ExpressionUtils.literal("") }] }] as const, default: ExpressionUtils.literal("") },
        historyCount:        i("historyCount", 5),
        modelName:           { name: "modelName", type: "String" as const, attributes: [{ name: "@default", args: [{ name: "value", value: ExpressionUtils.literal("gpt-4") }] }] as const, default: ExpressionUtils.literal("gpt-4") },
        description:         so("description"),
        temperature:         fo("temperature"),
        maxTokens:           io("maxTokens"),
        isPublic:            b("isPublic", false),
        isArchived:          b("isArchived", false),
        version:             i("version", 1),
        externalId:          so("externalId"),
        configJson:          so("configJson"),
        notes:               so("notes"),
        publishedAt:         dto("publishedAt"),
        deletedAt:           dto("deletedAt"),
        transcriptionPrompt: so("transcriptionPrompt"),
        suggestionPrompt:    so("suggestionPrompt"),
        // Extra scalar fields to push the model past the ~34-field threshold
        field24: s("field24"),
        field25: so("field25"),
        field26: s("field26"),
        field27: so("field27"),
        field28: i("field28", 0),
        field29: so("field29"),
        field30: s("field30"),
        field31: so("field31"),
        field32: s("field32"),
        field33: so("field33"),
        field34: b("field34", false),
        // Self-relation: BigModel → BigModel (like Agent → Agent parent)
        // This means the INCLUDED model in a nested select is also large (35 fields)
        parentId: { name: "parentId", type: "String" as const, optional: true as const, foreignKeyFor: ["parent"] as const },
        parent: {
          name: "parent", type: "BigModel" as const, optional: true as const,
          relation: { opposite: "children" as const, fields: ["parentId"] as const, references: ["id"] as const },
          attributes: [{ name: "@relation", args: [{ name: "fields", value: ExpressionUtils.array("String", [ExpressionUtils.field("parentId")]) }, { name: "references", value: ExpressionUtils.array("String", [ExpressionUtils.field("id")]) }] }] as const,
        },
        children: { name: "children", type: "BigModel" as const, array: true as const, relation: { opposite: "parent" as const } },
        ownerId: { name: "ownerId", type: "String" as const, foreignKeyFor: ["owner"] as const },
        categoryId: { name: "categoryId", type: "String" as const, optional: true as const, foreignKeyFor: ["category"] as const },
        owner: {
          name: "owner", type: "OwnerModel" as const,
          relation: { opposite: "bigModels" as const, fields: ["ownerId"] as const, references: ["id"] as const },
          attributes: [{ name: "@relation", args: [{ name: "fields", value: ExpressionUtils.array("String", [ExpressionUtils.field("ownerId")]) }, { name: "references", value: ExpressionUtils.array("String", [ExpressionUtils.field("id")]) }] }] as const,
        },
        category: {
          name: "category", type: "CategoryModel" as const, optional: true as const,
          relation: { opposite: "categorised" as const, fields: ["categoryId"] as const, references: ["id"] as const },
          attributes: [{ name: "@relation", args: [{ name: "fields", value: ExpressionUtils.array("String", [ExpressionUtils.field("categoryId")]) }, { name: "references", value: ExpressionUtils.array("String", [ExpressionUtils.field("id")]) }] }] as const,
        },
        items:   { name: "items",   type: "ItemModel"   as const, array: true as const, relation: { opposite: "parent"    as const } },
        tags:    { name: "tags",    type: "TagModel"    as const, array: true as const, relation: { opposite: "bigModels" as const } },
        reviews: { name: "reviews", type: "ReviewModel" as const, array: true as const, relation: { opposite: "subject"   as const } },
        logs:    { name: "logs",    type: "LogModel"    as const, array: true as const, relation: { opposite: "bigModel"  as const } },
      },
      idFields: ["id"] as const,
      uniqueFields: { id: { type: "String" }, slug: { type: "String" } },
    },

    OwnerModel: {
      name: "OwnerModel",
      fields: {
        id:        idF(),
        name:      s("name"),
        bigModels: { name: "bigModels", type: "BigModel" as const, array: true as const, relation: { opposite: "owner" as const } },
      },
      idFields: ["id"] as const,
      uniqueFields: { id: { type: "String" } },
    },

    CategoryModel: {
      name: "CategoryModel",
      fields: {
        id:          idF(),
        name:        s("name"),
        categorised: { name: "categorised", type: "BigModel" as const, array: true as const, relation: { opposite: "category" as const } },
      },
      idFields: ["id"] as const,
      uniqueFields: { id: { type: "String" } },
    },

    ItemModel: {
      name: "ItemModel",
      fields: {
        id:       idF(),
        title:    s("title"),
        parentId: { name: "parentId", type: "String" as const, foreignKeyFor: ["parent"] as const },
        parent: {
          name: "parent", type: "BigModel" as const,
          relation: { opposite: "items" as const, fields: ["parentId"] as const, references: ["id"] as const },
          attributes: [{ name: "@relation", args: [{ name: "fields", value: ExpressionUtils.array("String", [ExpressionUtils.field("parentId")]) }, { name: "references", value: ExpressionUtils.array("String", [ExpressionUtils.field("id")]) }] }] as const,
        },
      },
      idFields: ["id"] as const,
      uniqueFields: { id: { type: "String" } },
    },

    TagModel: {
      name: "TagModel",
      fields: {
        id:        idF(),
        label:     s("label"),
        bigModels: { name: "bigModels", type: "BigModel" as const, array: true as const, relation: { opposite: "tags" as const } },
      },
      idFields: ["id"] as const,
      uniqueFields: { id: { type: "String" } },
    },

    ReviewModel: {
      name: "ReviewModel",
      fields: {
        id:        idF(),
        body:      s("body"),
        rating:    i("rating", 0),
        subjectId: { name: "subjectId", type: "String" as const, foreignKeyFor: ["subject"] as const },
        subject: {
          name: "subject", type: "BigModel" as const,
          relation: { opposite: "reviews" as const, fields: ["subjectId"] as const, references: ["id"] as const },
          attributes: [{ name: "@relation", args: [{ name: "fields", value: ExpressionUtils.array("String", [ExpressionUtils.field("subjectId")]) }, { name: "references", value: ExpressionUtils.array("String", [ExpressionUtils.field("id")]) }] }] as const,
        },
      },
      idFields: ["id"] as const,
      uniqueFields: { id: { type: "String" } },
    },

    LogModel: {
      name: "LogModel",
      fields: {
        id:         idF(),
        message:    s("message"),
        level:      s("level"),
        bigModelId: { name: "bigModelId", type: "String" as const, foreignKeyFor: ["bigModel"] as const },
        bigModel: {
          name: "bigModel", type: "BigModel" as const,
          relation: { opposite: "logs" as const, fields: ["bigModelId"] as const, references: ["id"] as const },
          attributes: [{ name: "@relation", args: [{ name: "fields", value: ExpressionUtils.array("String", [ExpressionUtils.field("bigModelId")]) }, { name: "references", value: ExpressionUtils.array("String", [ExpressionUtils.field("id")]) }] }] as const,
        },
      },
      idFields: ["id"] as const,
      uniqueFields: { id: { type: "String" } },
    },

    // 46 stub models — inflate the schema so inferRouterOutputs resolves ~700+ procedure types total
    StubA: stubModel("StubA"),   StubB: stubModel("StubB"),   StubC: stubModel("StubC"),
    StubD: stubModel("StubD"),   StubE: stubModel("StubE"),   StubF: stubModel("StubF"),
    StubG: stubModel("StubG"),   StubH: stubModel("StubH"),   StubI: stubModel("StubI"),
    StubJ: stubModel("StubJ"),   StubK: stubModel("StubK"),   StubL: stubModel("StubL"),
    StubM: stubModel("StubM"),   StubN: stubModel("StubN"),   StubO: stubModel("StubO"),
    StubP: stubModel("StubP"),   StubQ: stubModel("StubQ"),   StubR: stubModel("StubR"),
    StubS: stubModel("StubS"),   StubT: stubModel("StubT"),   StubU: stubModel("StubU"),
    StubV: stubModel("StubV"),   StubW: stubModel("StubW"),   StubX: stubModel("StubX"),
    StubY: stubModel("StubY"),   StubZ: stubModel("StubZ"),
    Stub1: stubModel("Stub1"),   Stub2: stubModel("Stub2"),   Stub3: stubModel("Stub3"),
    Stub4: stubModel("Stub4"),   Stub5: stubModel("Stub5"),   Stub6: stubModel("Stub6"),
    Stub7: stubModel("Stub7"),   Stub8: stubModel("Stub8"),   Stub9: stubModel("Stub9"),
    Stub10: stubModel("Stub10"), Stub11: stubModel("Stub11"), Stub12: stubModel("Stub12"),
    Stub13: stubModel("Stub13"), Stub14: stubModel("Stub14"), Stub15: stubModel("Stub15"),
    Stub16: stubModel("Stub16"), Stub17: stubModel("Stub17"), Stub18: stubModel("Stub18"),
    Stub19: stubModel("Stub19"), Stub20: stubModel("Stub20"),
    Stub21: stubModel("Stub21"), Stub22: stubModel("Stub22"), Stub23: stubModel("Stub23"),
    Stub24: stubModel("Stub24"), Stub25: stubModel("Stub25"), Stub26: stubModel("Stub26"),
    Stub27: stubModel("Stub27"), Stub28: stubModel("Stub28"), Stub29: stubModel("Stub29"),
    Stub30: stubModel("Stub30"), Stub31: stubModel("Stub31"), Stub32: stubModel("Stub32"),
    Stub33: stubModel("Stub33"), Stub34: stubModel("Stub34"), Stub35: stubModel("Stub35"),
    Stub36: stubModel("Stub36"), Stub37: stubModel("Stub37"), Stub38: stubModel("Stub38"),
    Stub39: stubModel("Stub39"), Stub40: stubModel("Stub40"), Stub41: stubModel("Stub41"),
    Stub42: stubModel("Stub42"), Stub43: stubModel("Stub43"), Stub44: stubModel("Stub44"),
    Stub45: stubModel("Stub45"), Stub46: stubModel("Stub46"), Stub47: stubModel("Stub47"),
    Stub48: stubModel("Stub48"), Stub49: stubModel("Stub49"), Stub50: stubModel("Stub50"),
    Stub51: stubModel("Stub51"), Stub52: stubModel("Stub52"), Stub53: stubModel("Stub53"),
    Stub54: stubModel("Stub54"), Stub55: stubModel("Stub55"), Stub56: stubModel("Stub56"),
    Stub57: stubModel("Stub57"), Stub58: stubModel("Stub58"), Stub59: stubModel("Stub59"),
    Stub60: stubModel("Stub60"), Stub61: stubModel("Stub61"), Stub62: stubModel("Stub62"),
    Stub63: stubModel("Stub63"), Stub64: stubModel("Stub64"), Stub65: stubModel("Stub65"),
  } as const;

  authType = undefined as any;
  plugins = {};
}

export const largeSchema = new LargeSchemaType();
