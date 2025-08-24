import { FieldMapping } from 'src/fields-mapping/entities/fields-mapping.entity';

/** JSON-safe types */
export type JSONPrimitive = string | number | boolean | null;
export type JSONValue = JSONPrimitive | JSONObject | JSONArray;
export interface JSONObject {
  [k: string]: JSONValue;
}
export interface JSONArray extends Array<JSONValue> {}

/** Input/output object types */
export type PlainInput = Record<string, unknown>;
export type PlainOutput = Record<string, unknown>;

export type CacheEntry = {
  version: number;
  toZoho: ReadonlyArray<FieldMapping>;
  toEntity: ReadonlyArray<FieldMapping>;
  loadedAt: number;
};

export type MapOptions = {
  version?: number;
  /** When true, only maps fields that are explicitly present on the source object (PATCH behavior). */
  sparse?: boolean;
};

/** Transform signature — takes a value (unknown) and optional defaultValue, returns unknown */
export type TransformFn = (value: unknown, defaultValue?: JSONValue) => unknown;
