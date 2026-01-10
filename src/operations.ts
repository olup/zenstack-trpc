import type { SchemaDef, GetModels } from "@zenstackhq/orm/schema";
import type {
  FindManyArgs,
  FindUniqueArgs,
  FindFirstArgs,
  CreateArgs,
  CreateManyArgs,
  UpdateArgs,
  UpdateManyArgs,
  UpsertArgs,
  DeleteArgs,
  DeleteManyArgs,
  CountArgs,
  AggregateArgs,
  GroupByArgs,
} from "@zenstackhq/orm";

export type OperationArgs<
  Schema extends SchemaDef,
  Model extends GetModels<Schema>
> = {
  findMany: FindManyArgs<Schema, Model>;
  findUnique: FindUniqueArgs<Schema, Model>;
  findFirst: FindFirstArgs<Schema, Model>;
  create: CreateArgs<Schema, Model>;
  createMany: CreateManyArgs<Schema, Model>;
  update: UpdateArgs<Schema, Model>;
  updateMany: UpdateManyArgs<Schema, Model>;
  upsert: UpsertArgs<Schema, Model>;
  delete: DeleteArgs<Schema, Model>;
  deleteMany: DeleteManyArgs<Schema, Model>;
  count: CountArgs<Schema, Model>;
  aggregate: AggregateArgs<Schema, Model>;
  groupBy: GroupByArgs<Schema, Model>;
};

export type ArrayOps = "findMany" | "groupBy";
export type CountResultOps = "createMany" | "updateMany" | "deleteMany";
export type NumberResultOps = "count";
export type AnyResultOps = "aggregate";
export type NullableOps = "findUnique" | "findFirst";
export type MutationOps =
  | "create"
  | "createMany"
  | "update"
  | "updateMany"
  | "upsert"
  | "delete"
  | "deleteMany";
