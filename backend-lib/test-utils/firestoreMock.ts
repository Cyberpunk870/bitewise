type DocData = Record<string, any>;

class IncrementOp {
  constructor(public amount: number) {}
}

function clone<T>(value: T): T {
  return value && typeof value === "object" ? JSON.parse(JSON.stringify(value)) : value;
}

function applyValue(target: DocData, key: string, value: any) {
  if (value instanceof IncrementOp) {
    const current = Number(target[key] ?? 0);
    target[key] = current + value.amount;
    return;
  }
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  ) {
    target[key] = { ...(target[key] ?? {}), ...clone(value) };
    return;
  }
  target[key] = clone(value);
}

class MockDocumentSnapshot {
  constructor(private payload: { id: string; data: DocData | undefined }) {}
  get id() {
    return this.payload.id;
  }
  get exists() {
    return Boolean(this.payload.data);
  }
  data() {
    return clone(this.payload.data || {});
  }
}

class MockQuerySnapshot {
  constructor(private docsList: MockDocumentSnapshot[]) {}
  get docs() {
    return this.docsList;
  }
  get size() {
    return this.docsList.length;
  }
  get empty() {
    return this.docsList.length === 0;
  }
}

class MockDocRef {
  constructor(private parentCollection: MockCollection, public id: string) {}

  private get storage() {
    return this.parentCollection.storage;
  }

  async get() {
    const payload = this.storage.get(this.id);
    return {
      exists: Boolean(payload),
      data: () => clone(payload || {}),
    };
  }

  async set(value: DocData, opts?: { merge?: boolean }) {
    const existing = this.storage.get(this.id);
    if (opts?.merge && existing) {
      const next = { ...existing };
      for (const key of Object.keys(value)) {
        applyValue(next, key, value[key]);
      }
      this.storage.set(this.id, next);
    } else {
      const fresh: DocData = {};
      for (const key of Object.keys(value)) {
        applyValue(fresh, key, value[key]);
      }
      if (!fresh.id) fresh.id = this.id;
      this.storage.set(this.id, fresh);
    }
  }

  async update(value: DocData) {
    const existing = this.storage.get(this.id);
    if (!existing) throw new Error("not-found");
    const next = { ...existing };
    for (const key of Object.keys(value)) {
      applyValue(next, key, value[key]);
    }
    this.storage.set(this.id, next);
  }

  collection(name: string) {
    const nested = `${this.parentCollection.name}/${this.id}/${name}`;
    return this.parentCollection.root.collection(nested);
  }
}

type Filter = { field: string; op: string; value: any };
type Order = { field: string; direction: "asc" | "desc" };

class MockQuery {
  constructor(
    private collection: MockCollection,
    private filters: Filter[] = [],
    private orderByClause?: Order,
    private limitValue?: number
  ) {}

  where(field: string, op: string, value: any) {
    return new MockQuery(
      this.collection,
      [...this.filters, { field, op, value }],
      this.orderByClause,
      this.limitValue
    );
  }

  orderBy(field: string, direction: "asc" | "desc" = "asc") {
    return new MockQuery(this.collection, this.filters, { field, direction }, this.limitValue);
  }

  limit(value: number) {
    return new MockQuery(this.collection, this.filters, this.orderByClause, value);
  }

  async get() {
    let results = this.collection.listDocs();
    for (const filter of this.filters) {
      if (filter.op === "==") {
        results = results.filter((doc) => doc.data[filter.field] === filter.value);
      } else {
        throw new Error(`Unsupported filter op ${filter.op}`);
      }
    }
    if (this.orderByClause) {
      const { field, direction } = this.orderByClause;
      results = results.sort((a, b) => {
        const av = a.data[field];
        const bv = b.data[field];
        if (av === bv) return 0;
        if (av === undefined) return 1;
        if (bv === undefined) return -1;
        return direction === "asc" ? (av > bv ? 1 : -1) : av > bv ? -1 : 1;
      });
    }
    if (typeof this.limitValue === "number") {
      results = results.slice(0, this.limitValue);
    }
    return new MockQuerySnapshot(
      results.map((doc) => new MockDocumentSnapshot({ id: doc.id, data: doc.data }))
    );
  }
}

let counter = 0;

class MockCollection {
  public storage = new Map<string, DocData>();
  constructor(public name: string, public root: MockFirestore) {}

  doc(id?: string) {
    const docId = id || `mock-${++counter}`;
    if (!this.storage.has(docId)) {
      this.storage.set(docId, undefined as any);
    }
    return new MockDocRef(this, docId);
  }

  where(field: string, op: string, value: any) {
    return new MockQuery(this).where(field, op, value);
  }

  orderBy(field: string, direction?: "asc" | "desc") {
    return new MockQuery(this).orderBy(field, direction);
  }

  limit(value: number) {
    return new MockQuery(this).limit(value);
  }

  listDocs() {
    const docs: { id: string; data: DocData }[] = [];
    for (const [id, data] of this.storage.entries()) {
      if (data) docs.push({ id, data });
    }
    return docs;
  }
}

class MockTransaction {
  async get(ref: MockDocRef) {
    return ref.get();
  }
  set(ref: MockDocRef, data: DocData, opts?: { merge?: boolean }) {
    return ref.set(data, opts);
  }
  update(ref: MockDocRef, data: DocData) {
    return ref.update(data);
  }
}

class MockFirestore {
  private collections = new Map<string, MockCollection>();

  collection(name: string) {
    if (!this.collections.has(name)) {
      this.collections.set(name, new MockCollection(name, this));
    }
    return this.collections.get(name)!;
  }

  runTransaction<T>(fn: (tx: MockTransaction) => Promise<T>) {
    const tx = new MockTransaction();
    return fn(tx);
  }

  reset() {
    this.collections.clear();
  }

  dumpCollection(name: string) {
    const col = this.collections.get(name);
    if (!col) return [];
    return col.listDocs().map((doc) => ({ id: doc.id, data: clone(doc.data) }));
  }

  getDoc(collection: string, id: string) {
    const col = this.collections.get(collection);
    if (!col) return undefined;
    const data = col.storage.get(id);
    return data ? clone(data) : undefined;
  }
}

export const firestoreMock = new MockFirestore();

export function resetFirestoreMock() {
  firestoreMock.reset();
  counter = 0;
}

export const FieldValueStub = {
  increment(amount: number) {
    return new IncrementOp(amount);
  },
};
