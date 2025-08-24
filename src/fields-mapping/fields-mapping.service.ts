// src/common/mapping/mapping.service.ts
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

/** Registry of safe transforms (keep in sync with your TransformMethod enum) */
const TransformRegistry: Readonly<Record<TransformMethod, TransformFn>> = {
  [TransformMethod.ToNumber]: (value: unknown): number | null => {
    if (value === '' || value === null || value === undefined) return null;
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
  },
  [TransformMethod.ToString]: (value: unknown): string | null => {
    if (value === null || value === undefined) return null;
    return String(value);
  },
  [TransformMethod.NullIfEmpty]: (value: unknown): unknown => {
    return value === '' ? null : value;
  },
  [TransformMethod.DefaultIfNull]: (
    value: unknown,
    def?: JSONValue,
  ): JSONValue | unknown => {
    return value === null || value === undefined ? (def ?? null) : value;
  },
};

/** Safe dot-path getters/setters without any */
function getByPath(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined) return undefined;
  if (!path) return undefined;
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (typeof cur !== 'object' || cur === null) return undefined;
    const rec = cur as Record<string, unknown>;
    cur = rec[p];
    if (cur === undefined) return undefined;
  }
  return cur;
}

/** Returns true iff the final segment exists own-property on its parent */
function hasOwnByPath(obj: unknown, path: string): boolean {
  if (obj === null || obj === undefined) return false;
  if (!path) return false;
  const parts = path.split('.');
  let parent: unknown = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof parent !== 'object' || parent === null) return false;
    parent = (parent as Record<string, unknown>)[parts[i]];
  }
  if (typeof parent !== 'object' || parent === null) return false;
  return Object.prototype.hasOwnProperty.call(parent, parts[parts.length - 1]);
}

function setByPath(target: PlainOutput, path: string, value: unknown): void {
  if (!path) return;
  const parts = path.split('.');
  let cur: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const next = cur[key];
    if (typeof next !== 'object' || next === null) {
      const newObj: Record<string, unknown> = {};
      cur[key] = newObj;
      cur = newObj;
    } else {
      cur = next as Record<string, unknown>;
    }
  }
  cur[parts[parts.length - 1]] = value;
}

@Injectable()
export class FieldsMappingService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    @InjectRepository(FieldMapping)
    private readonly mappingsRepo: Repository<FieldMapping>,
  ) {}

  async toZoho(
    entity: MappingEntity,
    sourceObj: unknown,
    opts?: MapOptions,
  ): Promise<PlainOutput> {
    const { toZoho, version } = await this.load(entity, opts?.version);
    const input = this.toPlain(sourceObj);
    return this.applyMappings({
      rows: toZoho,
      entity,
      version,
      direction: MappingDirection.ToZoho,
      input,
      sparse: opts?.sparse ?? false,
    });
  }

  async toEntity(
    entity: MappingEntity,
    externalObj: unknown,
    opts?: Pick<MapOptions, 'version'>,
  ): Promise<PlainOutput> {
    const { toEntity, version } = await this.load(entity, opts?.version);
    const input = this.toPlain(externalObj);
    return this.applyMappings({
      rows: toEntity,
      entity,
      version,
      direction: MappingDirection.ToEntity,
      input,
      sparse: false,
    });
  }

  private toPlain(input: unknown): Record<string, unknown> {
    // handles class instances nicely
    const maybePlain = instanceToPlain(input, { exposeUnsetFields: false });
    if (maybePlain && typeof maybePlain === 'object') {
      return maybePlain as Record<string, unknown>;
    }
    return {};
  }

  /** Resolve the latest version for an entity (throws if none) */
  async getLatestVersion(entity: MappingEntity): Promise<number> {
    const row = await this.mappingsRepo
      .createQueryBuilder('m')
      .select('MAX(m.version)', 'max')
      .where('m.entity = :entity', { entity })
      .getRawOne<{ max: number | null }>();
    if (!row || row.max === null) {
      throw new BadRequestException(`No mappings found for entity=${entity}`);
    }
    return Number(row.max);
  }

  /** Invalidate in-memory cache for an entity/version */
  invalidate(entity: MappingEntity, version?: number): void {
    this.cache.delete(this.cacheKey(entity, version));

    if (version === undefined) {
      // drop the 'latest' key too
      this.cache.delete(this.cacheKey(entity, undefined));
    }
  }

  /** -------- Internal: load & apply -------- */

  private cacheKey(entity: MappingEntity, version?: number): string {
    return `${entity}:${version ?? 'latest'}`;
  }

  private async load(
    entity: MappingEntity,
    version?: number,
  ): Promise<CacheEntry> {
    const key = this.cacheKey(entity, version);
    const cached = this.cache.get(key);
    if (cached) return cached;

    const useVersion = version ?? (await this.getLatestVersion(entity));
    const rows = await this.mappingsRepo.find({
      where: { entity, version: useVersion },
      order: { source: 'ASC', target: 'ASC' },
    });

    if (rows.length === 0) {
      throw new BadRequestException(
        `No mapping rows found for entity=${entity}, version=${useVersion}`,
      );
    }

    const toZoho = rows.filter((r) => r.direction === MappingDirection.ToZoho);
    const toEntity = rows.filter(
      (r) => r.direction === MappingDirection.ToEntity,
    );

    const entry: CacheEntry = {
      version: useVersion,
      toZoho,
      toEntity,
      loadedAt: Date.now(),
    };
    this.cache.set(key, entry);
    return entry;
  }

  private applyMappings(args: {
    rows: ReadonlyArray<FieldMapping>;
    entity: MappingEntity;
    version: number;
    direction: MappingDirection;
    input: PlainInput;
    sparse: boolean;
  }): PlainOutput {
    const { rows, entity, version, direction, input, sparse } = args;
    const output: PlainOutput = {};

    for (const row of rows) {
      if (sparse && !hasOwnByPath(input, row.source)) {
        // PATCH-style: skip fields not present on input
        continue;
      }

      let value: unknown = getByPath(input, row.source);

      if (row.transformMethod) {
        const fn: TransformFn | undefined =
          TransformRegistry[row.transformMethod];
        if (!fn) {
          throw new BadRequestException(
            `Unknown transform '${row.transformMethod}' for ${entity} v${version} ${direction} ${row.source}→${row.target}`,
          );
        }
        value = fn(value, row.defaultValue as JSONValue | undefined);
      }

      if (
        (value === null || value === undefined) &&
        row.defaultValue !== null &&
        row.defaultValue !== undefined
      ) {
        value = row.defaultValue;
      }

      if (
        row.isRequired &&
        (value === undefined || value === null || value === '')
      ) {
        throw new BadRequestException(
          `Required mapping produced empty value for ${entity} v${version} ${direction} ${row.source}→${row.target}`,
        );
      }

      if (value !== undefined) {
        setByPath(output, row.target, value);
      }
    }

    return output;
  }
}
