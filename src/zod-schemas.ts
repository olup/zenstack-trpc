import { z } from "zod";
import type { SchemaDef } from "@zenstackhq/orm/schema";

/**
 * Maps ZenStack field types to Zod schemas
 */
function getZodTypeForField(
  fieldType: string,
  isOptional: boolean,
  isArray: boolean
): z.ZodTypeAny {
  let baseSchema: z.ZodTypeAny;

  switch (fieldType) {
    case "String":
      baseSchema = z.string();
      break;
    case "Int":
    case "Float":
      baseSchema = z.number();
      break;
    case "BigInt":
      baseSchema = z.bigint();
      break;
    case "Boolean":
      baseSchema = z.boolean();
      break;
    case "DateTime":
      baseSchema = z.union([z.date(), z.string().datetime()]);
      break;
    case "Json":
      baseSchema = z.any();
      break;
    case "Bytes":
      baseSchema = z.instanceof(Uint8Array);
      break;
    case "Decimal":
      baseSchema = z.union([z.number(), z.string()]);
      break;
    default:
      // For relation types or unknown types, use any
      baseSchema = z.any();
  }

  if (isArray) {
    baseSchema = z.array(baseSchema);
  }

  if (isOptional) {
    baseSchema = baseSchema.optional().nullable();
  }

  return baseSchema;
}

/**
 * Creates a Zod schema for a model's where input
 */
export function createWhereSchema<Schema extends SchemaDef>(
  schema: Schema,
  modelName: keyof Schema["models"]
): z.ZodTypeAny {
  const model = schema.models[modelName as string];
  if (!model) {
    return z.object({}).passthrough();
  }

  const fields = model.fields as Record<string, any>;
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [fieldName, fieldDef] of Object.entries(fields)) {
    const isRelation = fieldDef.relation !== undefined;

    if (isRelation) {
      // For relations, allow nested where clauses
      shape[fieldName] = z.any().optional();
    } else {
      // For scalar fields, allow direct value, null, or filter object
      const fieldType = fieldDef.type as string;
      const baseType = getZodTypeForField(fieldType, false, false);
      const nullableBaseType = baseType.nullable();

      shape[fieldName] = z
        .union([
          baseType,
          z.null(),
          z.object({
            equals: nullableBaseType.optional(),
            not: nullableBaseType.optional(),
            in: z.array(baseType).optional(),
            notIn: z.array(baseType).optional(),
            lt: baseType.optional(),
            lte: baseType.optional(),
            gt: baseType.optional(),
            gte: baseType.optional(),
            contains: z.string().optional(),
            startsWith: z.string().optional(),
            endsWith: z.string().optional(),
          }).passthrough(),
        ])
        .optional();
    }
  }

  // Add logical operators
  const baseSchema = z.object(shape).passthrough();
  return z
    .object({
      AND: z.union([baseSchema, z.array(baseSchema)]).optional(),
      OR: z.array(baseSchema).optional(),
      NOT: z.union([baseSchema, z.array(baseSchema)]).optional(),
    })
    .merge(baseSchema)
    .partial();
}

/**
 * Creates a Zod schema for a model's create data input
 */
export function createCreateDataSchema<Schema extends SchemaDef>(
  schema: Schema,
  modelName: keyof Schema["models"]
): z.ZodTypeAny {
  const model = schema.models[modelName as string];
  if (!model) {
    return z.object({}).passthrough();
  }

  const fields = model.fields as Record<string, any>;
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [fieldName, fieldDef] of Object.entries(fields)) {
    const isRelation = fieldDef.relation !== undefined;
    const hasDefault = fieldDef.default !== undefined;
    const isId = fieldDef.id === true;
    const isUpdatedAt = fieldDef.updatedAt === true;
    const isOptional = fieldDef.optional === true || hasDefault || isId || isUpdatedAt;
    const isForeignKey = fieldDef.foreignKeyFor !== undefined;

    if (isRelation) {
      // For relations, allow create/connect/connectOrCreate
      shape[fieldName] = z
        .object({
          create: z.any().optional(),
          connect: z.any().optional(),
          connectOrCreate: z.any().optional(),
        })
        .passthrough()
        .optional();
    } else {
      // Regular fields including foreign keys
      const fieldType = fieldDef.type as string;
      // Foreign keys are optional if a relation is used instead
      const isFkOptional = isForeignKey ? true : isOptional;
      shape[fieldName] = getZodTypeForField(
        fieldType,
        isFkOptional,
        fieldDef.array === true
      );
    }
  }

  return z.object(shape).passthrough();
}

/**
 * Creates a Zod schema for a model's update data input
 */
export function createUpdateDataSchema<Schema extends SchemaDef>(
  schema: Schema,
  modelName: keyof Schema["models"]
): z.ZodTypeAny {
  const model = schema.models[modelName as string];
  if (!model) {
    return z.object({}).passthrough();
  }

  const fields = model.fields as Record<string, any>;
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [fieldName, fieldDef] of Object.entries(fields)) {
    const isRelation = fieldDef.relation !== undefined;
    const isId = fieldDef.id === true;

    if (isId) continue; // Skip id fields for updates

    if (isRelation) {
      // For relations, allow full nested operations
      shape[fieldName] = z
        .object({
          create: z.any().optional(),
          connect: z.any().optional(),
          connectOrCreate: z.any().optional(),
          disconnect: z.any().optional(),
          delete: z.any().optional(),
          update: z.any().optional(),
          updateMany: z.any().optional(),
          deleteMany: z.any().optional(),
          set: z.any().optional(),
          upsert: z.any().optional(),
        })
        .passthrough()
        .optional();
    } else {
      const fieldType = fieldDef.type as string;
      shape[fieldName] = getZodTypeForField(fieldType, true, fieldDef.array === true);
    }
  }

  return z.object(shape).passthrough();
}

/**
 * Creates a Zod schema for unique where input (id or unique fields)
 */
export function createUniqueWhereSchema<Schema extends SchemaDef>(
  schema: Schema,
  modelName: keyof Schema["models"]
): z.ZodTypeAny {
  const model = schema.models[modelName as string];
  if (!model) {
    return z.object({}).passthrough();
  }

  const uniqueFields = model.uniqueFields as Record<string, any>;
  const fields = model.fields as Record<string, any>;
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [fieldName, fieldDef] of Object.entries(uniqueFields)) {
    const compoundFields = Array.isArray((fieldDef as any).fields)
      ? ((fieldDef as any).fields as string[])
      : null;

    if (compoundFields) {
      const compoundShape: Record<string, z.ZodTypeAny> = {};
      for (const compoundField of compoundFields) {
        const fieldInfo = fields[compoundField];
        if (fieldInfo) {
          compoundShape[compoundField] = getZodTypeForField(
            fieldInfo.type as string,
            false,
            fieldInfo.array === true
          );
        } else {
          compoundShape[compoundField] = z.any();
        }
      }
      shape[fieldName] = z.object(compoundShape).passthrough().optional();
      continue;
    }

    const fieldType = (fieldDef as any).type as string;
    shape[fieldName] = getZodTypeForField(fieldType, true, false);
  }

  return z.object(shape).passthrough();
}

/**
 * Creates a Zod schema for select input
 */
export function createSelectSchema<Schema extends SchemaDef>(
  schema: Schema,
  modelName: keyof Schema["models"]
): z.ZodTypeAny {
  const model = schema.models[modelName as string];
  if (!model) {
    return z.object({}).passthrough();
  }

  const fields = model.fields as Record<string, any>;
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const fieldName of Object.keys(fields)) {
    shape[fieldName] = z.union([z.boolean(), z.any()]).optional();
  }

  return z.object(shape).passthrough().optional();
}

/**
 * Creates a Zod schema for include input
 */
export function createIncludeSchema<Schema extends SchemaDef>(
  schema: Schema,
  modelName: keyof Schema["models"]
): z.ZodTypeAny {
  const model = schema.models[modelName as string];
  if (!model) {
    return z.object({}).passthrough();
  }

  const fields = model.fields as Record<string, any>;
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [fieldName, fieldDef] of Object.entries(fields)) {
    const isRelation = fieldDef.relation !== undefined;
    if (isRelation) {
      shape[fieldName] = z.union([z.boolean(), z.any()]).optional();
    }
  }

  return z.object(shape).passthrough().optional();
}

/**
 * Creates a Zod schema for orderBy input
 */
export function createOrderBySchema<Schema extends SchemaDef>(
  schema: Schema,
  modelName: keyof Schema["models"]
): z.ZodTypeAny {
  const model = schema.models[modelName as string];
  if (!model) {
    return z.any();
  }

  const fields = model.fields as Record<string, any>;
  const shape: Record<string, z.ZodTypeAny> = {};
  const sortOrder = z.enum(["asc", "desc"]);

  for (const [fieldName, fieldDef] of Object.entries(fields)) {
    const isRelation = fieldDef.relation !== undefined;
    if (!isRelation) {
      shape[fieldName] = sortOrder.optional();
    }
  }

  return z.union([z.object(shape).passthrough(), z.array(z.object(shape).passthrough())]).optional();
}

/**
 * Creates all Zod schemas for a model's CRUD operations
 */
export function createModelSchemas<Schema extends SchemaDef>(
  schema: Schema,
  modelName: keyof Schema["models"]
) {
  const whereSchema = createWhereSchema(schema, modelName);
  const uniqueWhereSchema = createUniqueWhereSchema(schema, modelName);
  const createDataSchema = createCreateDataSchema(schema, modelName);
  const updateDataSchema = createUpdateDataSchema(schema, modelName);
  const selectSchema = createSelectSchema(schema, modelName);
  const includeSchema = createIncludeSchema(schema, modelName);
  const orderBySchema = createOrderBySchema(schema, modelName);

  return {
    findMany: z
      .object({
        where: whereSchema.optional(),
        select: selectSchema,
        include: includeSchema,
        orderBy: orderBySchema,
        skip: z.number().optional(),
        take: z.number().optional(),
        cursor: uniqueWhereSchema.optional(),
        distinct: z.array(z.string()).optional(),
      })
      .passthrough()
      .optional(),

    findUnique: z.object({
      where: uniqueWhereSchema,
      select: selectSchema,
      include: includeSchema,
    }).passthrough(),

    findFirst: z
      .object({
        where: whereSchema.optional(),
        select: selectSchema,
        include: includeSchema,
        orderBy: orderBySchema,
        skip: z.number().optional(),
        cursor: uniqueWhereSchema.optional(),
      })
      .passthrough()
      .optional(),

    create: z.object({
      data: createDataSchema,
      select: selectSchema,
      include: includeSchema,
    }).passthrough(),

    createMany: z
      .object({
        data: z.union([createDataSchema, z.array(createDataSchema)]),
        skipDuplicates: z.boolean().optional(),
      })
      .passthrough(),

    update: z.object({
      where: uniqueWhereSchema,
      data: updateDataSchema,
      select: selectSchema,
      include: includeSchema,
    }).passthrough(),

    updateMany: z.object({
      where: whereSchema.optional(),
      data: updateDataSchema,
      limit: z.number().optional(),
    }).passthrough(),

    upsert: z.object({
      where: uniqueWhereSchema,
      create: createDataSchema,
      update: updateDataSchema,
      select: selectSchema,
      include: includeSchema,
    }).passthrough(),

    delete: z.object({
      where: uniqueWhereSchema,
      select: selectSchema,
      include: includeSchema,
    }).passthrough(),

    deleteMany: z
      .object({
        where: whereSchema.optional(),
        limit: z.number().optional(),
      })
      .passthrough()
      .optional(),

    count: z
      .object({
        where: whereSchema.optional(),
        select: z.any().optional(),
        cursor: uniqueWhereSchema.optional(),
        skip: z.number().optional(),
        take: z.number().optional(),
        orderBy: orderBySchema,
      })
      .passthrough()
      .optional(),

    aggregate: z.object({
      where: whereSchema.optional(),
      cursor: uniqueWhereSchema.optional(),
      skip: z.number().optional(),
      take: z.number().optional(),
      orderBy: orderBySchema,
      _count: z.any().optional(),
      _avg: z.any().optional(),
      _sum: z.any().optional(),
      _min: z.any().optional(),
      _max: z.any().optional(),
    }).passthrough(),

    groupBy: z.object({
      by: z.union([z.string(), z.array(z.string())]),
      where: whereSchema.optional(),
      having: z.any().optional(),
      orderBy: orderBySchema,
      skip: z.number().optional(),
      take: z.number().optional(),
      _count: z.any().optional(),
      _avg: z.any().optional(),
      _sum: z.any().optional(),
      _min: z.any().optional(),
      _max: z.any().optional(),
    }).passthrough(),
  };
}
