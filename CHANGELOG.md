# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Changed

- Build each procedure's input schema lazily, on its first call, instead of building every model × operation schema when the router is created. On a 105-model schema the eager build held ~1.3GB of heap at startup, most of it for procedures never called.

### Added

- `zodFactory` option on `createZenStackRouter` to reuse an existing ZenStack schema factory (for example the ORM client's `$zod`), so the router and the ORM's input validation share one schema cache.

### Removed

- The `z.any()` fallback for an operation missing from the schema map. It was unreachable and would have silently accepted any input; a missing operation now throws on first call.

## [0.2.5] - 2026-05-22

### Fixed

- Reject unknown keys in nested relation `select` inputs, including `select: { relation: { select: ... } }`.

## [0.2.4] - 2026-05-21

### Fixed

- Reject unknown keys in typed client `select`, `include`, and `omit` query inputs while preserving dynamic result inference.
- Add CI checks for test type assertions and the TypeScript native preview compiler.

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
