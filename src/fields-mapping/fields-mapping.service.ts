import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MappingDirection,
  MappingEntity,
  TransformMethod,
} from 'src/common/enums/field-mapping.enums';
import { FieldMapping } from './entities/fields-mapping.entity';
import {
  JSONValue,
  PlainOutput,
  PlainInput,
  TransformFn,
  CacheEntry,
  MapOptions,
} from 'src/common/types/field-mapping.types';
import { instanceToPlain } from 'class-transformer';

/**
 * Runtime guard for plain object records.
 *
 * @example
 * ```ts
 * isRecord({ a: 1 }); // true
 * isRecord(null); // false
 * isRecord('text'); // false
 * ```
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Split a dot-delimited path into normalized segments.
 * Trims whitespace and removes empty segments.
 *
 * @example
 * ```ts
 * splitPath(' address . street '); // ['address', 'street']
 * splitPath('profile..email'); // ['profile', 'email']
 * ```
 */
function splitPath(path: string): string[] {
  return path
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

/**
 * Safe dot-path getter that never throws.
 * Returns `undefined` if the path cannot be fully resolved.
 *
 * @example
 * ```ts
 * const source = { address: { city: 'Cairo' } };
 * getByPath(source, 'address.city'); // 'Cairo'
 * getByPath(source, 'address.country'); // undefined
 * getByPath(null, 'address.city'); // undefined
 * ```
 */
function getByPath(sourceObject: unknown, path: string): unknown {
  if (sourceObject == null || !path) return undefined;
  let currentValue: unknown = sourceObject;
  for (const key of splitPath(path)) {
    if (!isRecord(currentValue)) return undefined;
    currentValue = currentValue[key];
    if (currentValue === undefined) return undefined;
  }
  return currentValue;
}

/**
 * Returns true if and only if the final segment exists as an own-property
 * on its parent object. This helps implement PATCH-like "sparse" semantics.
 *
 * @example
 * ```ts
 * const input = { profile: { email: 'a@b.com' } };
 * hasOwnByPath(input, 'profile.email'); // true
 * hasOwnByPath(input, 'profile.phone'); // false
 * ```
 */
function hasOwnByPath(sourceObject: unknown, path: string): boolean {
  if (sourceObject == null || !path) return false;
  const parts = splitPath(path);
  let parentValue: unknown = sourceObject;

  for (let index = 0; index < parts.length - 1; index++) {
    if (!isRecord(parentValue)) return false;
    parentValue = parentValue[parts[index]];
  }

  return isRecord(parentValue)
    ? Object.prototype.hasOwnProperty.call(parentValue, parts.at(-1)!)
    : false;
}

/**
 * Safe dot-path setter on a plain output object.
 * Creates intermediate objects as needed.
 *
 * @example
 * ```ts
 * const target: Record<string, unknown> = {};
 * setByPath(target, 'billing.address.city', 'Alexandria');
 * // target === { billing: { address: { city: 'Alexandria' } } }
 * ```
 */
function setByPath(
  targetObject: PlainOutput,
  path: string,
  value: unknown,
): void {
  if (!path) return;
  const parts = splitPath(path);
  let currentContainer: Record<string, unknown> = targetObject;

  for (let index = 0; index < parts.length - 1; index++) {
    const key = parts[index];
    const nextContainer = currentContainer[key];
    if (!isRecord(nextContainer)) {
      const newContainer: Record<string, unknown> = {};
      currentContainer[key] = newContainer;
      currentContainer = newContainer;
    } else {
      currentContainer = nextContainer;
    }
  }

  currentContainer[parts.at(-1)!] = value;
}

/** ------------------------------------------------------------------------- */
/** Transform registry                                                         */
/** ------------------------------------------------------------------------- */

/**
 * Registry of safe transforms (keep in sync with your `TransformMethod` enum).
 * All functions are pure and null-safe.
 *
 * @example
 * ```ts
 * TRANSFORM_REGISTRY[TransformMethod.ToNumber]('42'); // 42
 * TRANSFORM_REGISTRY[TransformMethod.ToNumber]('x');  // null
 * TRANSFORM_REGISTRY;  // '123'
 * TRANSFORM_REGISTRY[TransformMethod.NullIfEmpty](''); // null
 * TRANSFORM_REGISTRY[TransformMethod.DefaultIfNull](null, 'N/A'); // 'N/A'
 * ```
 */
const TRANSFORM_REGISTRY: Readonly<Record<TransformMethod, TransformFn>> = {
  [TransformMethod.ToNumber]: (inputValue: unknown): number | null => {
    if (inputValue === '' || inputValue === null || inputValue === undefined)
      return null;
    const numericValue = Number(inputValue);
    return Number.isNaN(numericValue) ? null : numericValue;
  },

  [TransformMethod.ToString]: (inputValue: unknown): string | null => {
    if (inputValue === null || inputValue === undefined) return null;
    return String(inputValue);
  },

  [TransformMethod.NullIfEmpty]: (inputValue: unknown): unknown => {
    return inputValue === '' ? null : inputValue;
  },

  [TransformMethod.DefaultIfNull]: (
    inputValue: unknown,
    defaultValue?: JSONValue,
  ) => {
    return inputValue === null || inputValue === undefined
      ? (defaultValue ?? null)
      : inputValue;
  },
};

/** ------------------------------------------------------------------------- */
/** Service                                                                   */
/** ------------------------------------------------------------------------- */

@Injectable()
export class FieldsMappingService {
  /**
   * In-memory cache keyed by `${entity}:${version|latest}`.
   *
   * @example
   * ```ts
   * // Internally used to avoid repeated DB round-trips for the same entity/version.
   * ```
   */
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    @InjectRepository(FieldMapping)
    private readonly mappingsRepository: Repository<FieldMapping>,
  ) {}

  /**
   * Map an internal domain entity into a Zoho-compatible plain object.
   *
   * @example
   * ```ts
   * // Example: mapping a Contact domain object to Zoho fields
   * const zohoPayload = await fieldsMappingService.toZoho(
   *   MappingEntity.Contact,
   *   {
   *     id: 42,
   *     firstName: 'Alice',
   *     lastName: 'Doe',
   *     phone: '123456789',
   *     metadata: { source: 'referral' }
   *   },
   *   { sparse: false } // include all mapped fields regardless of presence
   * );
   *
   * // Example result (depends on your DB mapping rows):
   * // {
   * //   ContactID: 42,
   * //   First_Name: 'Alice',
   * //   Last_Name: 'Doe',
   * //   Phone: '123456789',
   * //   Source: 'referral'
   * // }
   *
   * // Sparse example (PATCH-like):
   * const zohoSparse = await fieldsMappingService.toZoho(
   *   MappingEntity.Contact,
   *   { phone: '987654321' },
   *   { sparse: true }
   * );
   * // Only mappings whose `source` exists as own-property on input are emitted.
   * ```
   *
   * @param entity - Logical entity type for which mappings are defined.
   * @param sourceObject - The source entity object (class instance or plain).
   * @param options.sparse - If `true`, skips fields not present as own-properties on the input object (PATCH semantics).
   * @param options.version - Specific mapping version. Defaults to latest version found for the entity.
   * @returns A plain object shaped for Zoho API consumption.
   * @throws BadRequestException if no mapping exists or a required field evaluates to an empty value.
   */
  async toZoho(
    entity: MappingEntity,
    sourceObject: unknown,
    options?: MapOptions,
  ): Promise<PlainOutput> {
    const { toZoho: mappingRows, version } = await this.loadMappings(
      entity,
      options?.version,
    );
    const plainInput = this.toPlainObject(sourceObject);

    return this.applyMappingRows({
      rows: mappingRows,
      entity,
      version,
      direction: MappingDirection.ToZoho,
      input: plainInput,
      sparse: options?.sparse ?? false,
    });
  }

  /**
   * Map an external Zoho object into an internal entity-shaped plain object.
   *
   * @example
   * ```ts
   * // Example: mapping Zoho fields back to your internal Invoice representation
   * const entityObject = await fieldsMappingService.toEntity(
   *   MappingEntity.Invoice,
   *   {
   *     Invoice_ID: 100,
   *     Total: 250.5,
   *     Date_Issued: '2024-02-01'
   *   }
   * );
   *
   * // Example result (depends on your DB mapping rows):
   * // {
   * //   id: 100,
   * //   total: 250.5,
   * //   issuedAt: '2024-02-01'
   * // }
   * ```
   *
   * @param entity - Logical entity type for which mappings are defined.
   * @param externalObject - Object returned by Zoho or another external system.
   * @param options.version - Specific mapping version. Defaults to latest version found for the entity.
   * @returns A plain object shaped for internal use.
   * @throws BadRequestException if no mapping exists or a required field evaluates to an empty value.
   */
  async toEntity(
    entity: MappingEntity,
    externalObject: unknown,
    options?: Pick<MapOptions, 'version'>,
  ): Promise<PlainOutput> {
    const { toEntity: mappingRows, version } = await this.loadMappings(
      entity,
      options?.version,
    );
    const plainInput = this.toPlainObject(externalObject);

    return this.applyMappingRows({
      rows: mappingRows,
      entity,
      version,
      direction: MappingDirection.ToEntity,
      input: plainInput,
      sparse: false,
    });
  }

  /**
   * Resolve the latest mapping version for a given entity.
   *
   * @example
   * ```ts
   * const latestVersion = await fieldsMappingService.getLatestVersion(MappingEntity.Contact);
   * console.log(latestVersion); // e.g. 3
   * ```
   *
   * @param entity - Logical entity type.
   * @returns Latest version number for the given entity.
   * @throws BadRequestException if no mappings exist for the entity.
   */
  async getLatestVersion(entity: MappingEntity): Promise<number> {
    const aggregateRow = await this.mappingsRepository
      .createQueryBuilder('mapping')
      .select('MAX(mapping.version)', 'max')
      .where('mapping.entity = :entity', { entity })
      .getRawOne<{ max: number | null }>();

    if (!aggregateRow || aggregateRow.max === null) {
      throw new BadRequestException(`No mappings found for entity=${entity}`);
    }
    return Number(aggregateRow.max);
  }

  /**
   * Invalidate the in-memory cache for a given entity and optional version.
   * If `version` is omitted, both the "latest" key and any specific version cache lines are cleared.
   *
   * @example
   * ```ts
   * // Clears cache for both latest and specific versions of "Contact"
   * fieldsMappingService.invalidate(MappingEntity.Contact);
   *
   * // Clears only the cached entry for version 2 of "Invoice"
   * fieldsMappingService.invalidate(MappingEntity.Invoice, 2);
   * ```
   */
  invalidate(entity: MappingEntity, version?: number): void {
    this.cache.delete(this.cacheKey(entity, version));

    if (version === undefined) {
      // Drop the 'latest' key too
      this.cache.delete(this.cacheKey(entity, undefined));
    }
  }

  /* ----------------------------------------------------------------------- */
  /* Internals                                                               */
  /* ----------------------------------------------------------------------- */

  /**
   * Convert an input (possibly a class instance) into a plain object
   * using class-transformer. Falls back to `{}` if the result is not an object.
   *
   * @example
   * ```ts
   * class User {
   *   constructor(public id: number, public name: string) {}
   * }
   * const plain = (fieldsMappingService as any).toPlainObject(new User(1, 'Sam'));
   * // { id: 1, name: 'Sam' }
   * ```
   */
  private toPlainObject(inputValue: unknown): Record<string, unknown> {
    const maybePlain = instanceToPlain(inputValue, {
      exposeUnsetFields: false,
    });
    return isRecord(maybePlain) ? maybePlain : {};
  }

  /**
   * Build a deterministic cache key for an entity and optional version.
   *
   * @example
   * ```ts
   * (fieldsMappingService as any).cacheKey(MappingEntity.Contact, 2); // "Contact:2"
   * (fieldsMappingService as any).cacheKey(MappingEntity.Contact);    // "Contact:latest"
   * ```
   */
  private cacheKey(entity: MappingEntity, version?: number): string {
    return `${entity}:${version ?? 'latest'}`;
  }

  /**
   * Load mapping rows for an entity/version, using an in-memory cache.
   * When `version` is omitted, the latest version is resolved and cached under `latest`.
   *
   * @example
   * ```ts
   * const cacheEntry = await (fieldsMappingService as any).loadMappings(
   *   MappingEntity.Contact
   * );
   * // cacheEntry.toZoho / cacheEntry.toEntity contain the relevant rows
   * ```
   *
   * @throws BadRequestException if no rows are found for the resolved version.
   */
  private async loadMappings(
    entity: MappingEntity,
    version?: number,
  ): Promise<CacheEntry> {
    const cacheKey = this.cacheKey(entity, version);
    const cachedEntry = this.cache.get(cacheKey);
    if (cachedEntry) return cachedEntry;

    const resolvedVersion = version ?? (await this.getLatestVersion(entity));
    const mappingRows = await this.mappingsRepository.find({
      where: { entity, version: resolvedVersion },
      order: { source: 'ASC', target: 'ASC' },
    });

    if (mappingRows.length === 0) {
      throw new BadRequestException(
        `No mapping rows found for entity=${entity}, version=${resolvedVersion}`,
      );
    }

    const rowsToZoho = mappingRows.filter(
      (mappingRow) => mappingRow.direction === MappingDirection.ToZoho,
    );
    const rowsToEntity = mappingRows.filter(
      (mappingRow) => mappingRow.direction === MappingDirection.ToEntity,
    );

    const newCacheEntry: CacheEntry = {
      version: resolvedVersion,
      toZoho: rowsToZoho,
      toEntity: rowsToEntity,
      loadedAt: Date.now(),
    };

    this.cache.set(cacheKey, newCacheEntry);
    return newCacheEntry;
  }

  /**
   * Apply a set of mapping rows to an input object to produce a plain output.
   * - Honors `sparse` mode (PATCH semantics) via `hasOwnByPath` on source.
   * - Applies declared transform (if any) and default value fallbacks.
   * - Enforces `isRequired`.
   *
   * @example
   * ```ts
   * // This method is internal; example demonstrates structure:
   * const output = (fieldsMappingService as any).applyMappingRows({
   *   rows: [
   *     {
   *       id: 1, entity: MappingEntity.Contact, version: 1,
   *       source: 'firstName', target: 'First_Name',
   *       direction: MappingDirection.ToZoho, isRequired: true,
   *       transformMethod: TransformMethod.ToString,
   *       defaultValue: null,
   *     } as FieldMapping
   *   ],
   *   entity: MappingEntity.Contact,
   *   version: 1,
   *   direction: MappingDirection.ToZoho,
   *   input: { firstName: 'Alice' },
   *   sparse: false,
   * });
   * // => { First_Name: 'Alice' }
   * ```
   *
   * @throws BadRequestException on unknown transform or missing required values.
   */
  private applyMappingRows(args: {
    rows: ReadonlyArray<FieldMapping>;
    entity: MappingEntity;
    version: number;
    direction: MappingDirection;
    input: PlainInput;
    sparse: boolean;
  }): PlainOutput {
    const { rows, entity, version, direction, input, sparse } = args;
    const outputObject: PlainOutput = {};

    for (const mappingRow of rows) {
      if (sparse && !hasOwnByPath(input, mappingRow.source)) {
        // PATCH-style: skip fields not present as own properties on input
        continue;
      }

      let transformedValue: unknown = getByPath(input, mappingRow.source);

      if (mappingRow.transformMethod != null) {
        const transformFunction: TransformFn | undefined =
          TRANSFORM_REGISTRY[mappingRow.transformMethod];

        if (!transformFunction) {
          throw new BadRequestException(
            `Unknown transform '${mappingRow.transformMethod}' for ${entity} v${version} ${direction} ${mappingRow.source}→${mappingRow.target}`,
          );
        }
        transformedValue = transformFunction(
          transformedValue,
          mappingRow.defaultValue as JSONValue | undefined,
        );
      }

      // Default fallback (applies only if current value is nullish)
      if (
        (transformedValue === null || transformedValue === undefined) &&
        mappingRow.defaultValue !== null &&
        mappingRow.defaultValue !== undefined
      ) {
        transformedValue = mappingRow.defaultValue;
      }

      // Required guard
      if (
        mappingRow.isRequired &&
        (transformedValue === undefined ||
          transformedValue === null ||
          transformedValue === '')
      ) {
        throw new BadRequestException(
          `Required mapping produced empty value for ${entity} v${version} ${direction} ${mappingRow.source}→${mappingRow.target}`,
        );
      }

      if (transformedValue !== undefined) {
        setByPath(outputObject, mappingRow.target, transformedValue);
      }
    }

    return outputObject;
  }
}
