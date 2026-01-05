# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2024

### Added

- Initial release
- `createTRPC()` - Creates a tRPC instance with typed context
- `createZenStackRouter()` - Generates tRPC router from ZenStack schema
- `TypedRouterCaller<Schema>` - Type helper for fully typed router caller
- `TypedModelProcedures<Schema, Model>` - Type helper for model procedures
- Full CRUD operations: findMany, findUnique, findFirst, create, createMany, update, updateMany, upsert, delete, deleteMany, count, aggregate, groupBy
- Dynamic result typing based on include/select options
- Zod schema generators for runtime input validation
- Support for all ZenStack field types
- Support for relations, optional fields, and defaults
