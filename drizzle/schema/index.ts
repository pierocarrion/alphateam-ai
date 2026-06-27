// Barrel for all Drizzle tables. Imported as `@/drizzle/schema` and passed to
// drizzle() so relational query API (db.table.findMany with `with`) works.

export * from "./_shared";

export * from "./auth";
export * from "./workspace";
export * from "./messaging";
export * from "./tasks";
export * from "./project";
export * from "./insights";
export * from "./alpha";
export * from "./feedback";
export * from "./knowledge";
