import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A just-enough in-memory stand-in for the Supabase client, for unit tests of
 * code that takes the client as a dependency.
 *
 * It implements the exact calls the manual-payment code makes — select /
 * insert / update with eq / neq / in filters, maybeSingle / single, and the
 * storage upload / remove pair — and the two behaviours the tests are about:
 * a unique index (so a duplicate idempotency key fails with 23505) and
 * conditional updates (so "set paid where not already paid" can lose a race).
 *
 * It is deliberately not a general mock. A call it does not understand throws,
 * so a test never passes by accident on a query the fake silently ignored.
 */

type Row = Record<string, unknown>;
type Result = { data: unknown; error: { code?: string; message: string } | null };
type Filter = (row: Row) => boolean;

export interface FakeDbOptions {
  /** Columns that must be unique (ignoring null), per table. */
  unique?: Record<string, string[]>;
}

export class FakeDb {
  tables: Record<string, Row[]> = { donations: [] };
  unique: Record<string, string[]>;

  /** Runs just before each insert — lets a test play "the other request". */
  beforeInsert?: (table: string, row: Row) => void;
  /** If set, the next insert fails with this error instead of inserting. */
  failNextInsert?: { code?: string; message: string };

  storage = {
    objects: new Set<string>(),
    uploads: [] as { bucket: string; path: string; contentType?: string; size: number }[],
    removed: [] as string[],
    failUpload: false,
  };

  private nextId = 1;

  constructor(options: FakeDbOptions = {}) {
    this.unique = options.unique ?? {
      donations: ["reference", "idempotency_key"],
    };
  }

  insertRow(table: string, row: Row): Row {
    const full = { id: `id-${this.nextId++}`, created_at: new Date().toISOString(), ...row };
    (this.tables[table] ??= []).push(full);
    return full;
  }

  client(): SupabaseClient {
    // Arrow functions capture `this` lexically, so the fake needs no alias.
    return {
      from: (table: string) => new FakeQuery(this, table),
      storage: {
        from: (bucket: string) => ({
          upload: async (
            path: string,
            body: Uint8Array,
            opts?: { contentType?: string }
          ) => {
            if (this.storage.failUpload) {
              return { data: null, error: { message: "upload failed" } };
            }
            this.storage.objects.add(`${bucket}/${path}`);
            this.storage.uploads.push({
              bucket,
              path,
              contentType: opts?.contentType,
              size: body.byteLength,
            });
            return { data: { path }, error: null };
          },
          remove: async (paths: string[]) => {
            for (const p of paths) {
              this.storage.objects.delete(`${bucket}/${p}`);
              this.storage.removed.push(p);
            }
            return { data: [], error: null };
          },
        }),
      },
    } as unknown as SupabaseClient;
  }
}

class FakeQuery implements PromiseLike<Result> {
  private op: "select" | "insert" | "update" = "select";
  private payload: Row = {};
  private filters: Filter[] = [];
  private returning = false;
  private mode: "many" | "maybe" | "single" = "many";

  constructor(private db: FakeDb, private table: string) {}

  // Column lists and count options are accepted by the real client and
  // irrelevant here: this always returns whole rows.
  select() {
    if (this.op !== "select") this.returning = true;
    return this;
  }
  insert(row: Row) {
    this.op = "insert";
    this.payload = row;
    return this;
  }
  update(patch: Row) {
    this.op = "update";
    this.payload = patch;
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push((r) => r[col] === val);
    return this;
  }
  neq(col: string, val: unknown) {
    this.filters.push((r) => r[col] !== val);
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.filters.push((r) => vals.includes(r[col]));
    return this;
  }
  maybeSingle<T = unknown>() {
    this.mode = "maybe";
    return this as unknown as PromiseLike<{ data: T | null; error: Result["error"] }>;
  }
  single<T = unknown>() {
    this.mode = "single";
    return this as unknown as PromiseLike<{ data: T | null; error: Result["error"] }>;
  }

  then<A = Result, B = never>(
    onfulfilled?: ((v: Result) => A | PromiseLike<A>) | null,
    onrejected?: ((e: unknown) => B | PromiseLike<B>) | null
  ): PromiseLike<A | B> {
    return Promise.resolve(this.exec()).then(onfulfilled, onrejected);
  }

  private matching(): Row[] {
    const rows = this.db.tables[this.table] ?? [];
    return rows.filter((r) => this.filters.every((f) => f(r)));
  }

  /**
   * Rows are returned as copies. A real database hands back what it read at
   * that moment; returning the stored object itself would let a later update
   * change a value the caller is still holding, and hide (or invent) bugs.
   */
  private shape(rows: Row[]): Result {
    const copies = rows.map((r) => ({ ...r }));
    if (this.mode === "many") return { data: copies, error: null };
    if (this.mode === "maybe") return { data: copies[0] ?? null, error: null };
    return copies[0]
      ? { data: copies[0], error: null }
      : { data: null, error: { code: "PGRST116", message: "no rows" } };
  }

  private exec(): Result {
    if (this.op === "select") return this.shape(this.matching());

    if (this.op === "insert") {
      this.db.beforeInsert?.(this.table, this.payload);
      if (this.db.failNextInsert) {
        const error = this.db.failNextInsert;
        this.db.failNextInsert = undefined;
        return { data: null, error };
      }
      for (const col of this.db.unique[this.table] ?? []) {
        const v = this.payload[col];
        if (v != null && (this.db.tables[this.table] ?? []).some((r) => r[col] === v)) {
          return {
            data: null,
            error: {
              code: "23505",
              message: `duplicate key value violates unique constraint "${this.table}_${col}_key"`,
            },
          };
        }
      }
      const row = this.db.insertRow(this.table, this.payload);
      return this.returning ? this.shape([row]) : { data: null, error: null };
    }

    // update
    const hit = this.matching();
    for (const r of hit) Object.assign(r, this.payload);
    return this.returning ? this.shape(hit) : { data: null, error: null };
  }
}
