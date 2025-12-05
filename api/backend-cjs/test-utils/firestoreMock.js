"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FieldValueStub = exports.firestoreMock = void 0;
exports.resetFirestoreMock = resetFirestoreMock;
class IncrementOp {
    constructor(amount) {
        this.amount = amount;
    }
}
function clone(value) {
    return value && typeof value === "object" ? JSON.parse(JSON.stringify(value)) : value;
}
function applyValue(target, key, value) {
    if (value instanceof IncrementOp) {
        const current = Number(target[key] ?? 0);
        target[key] = current + value.amount;
        return;
    }
    if (value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        !(value instanceof Date)) {
        target[key] = { ...(target[key] ?? {}), ...clone(value) };
        return;
    }
    target[key] = clone(value);
}
class MockDocumentSnapshot {
    constructor(payload) {
        this.payload = payload;
    }
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
    constructor(docsList) {
        this.docsList = docsList;
    }
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
    constructor(parentCollection, id) {
        this.parentCollection = parentCollection;
        this.id = id;
    }
    get storage() {
        return this.parentCollection.storage;
    }
    async get() {
        const payload = this.storage.get(this.id);
        return {
            exists: Boolean(payload),
            data: () => clone(payload || {}),
        };
    }
    async set(value, opts) {
        const existing = this.storage.get(this.id);
        if (opts?.merge && existing) {
            const next = { ...existing };
            for (const key of Object.keys(value)) {
                applyValue(next, key, value[key]);
            }
            this.storage.set(this.id, next);
        }
        else {
            const fresh = {};
            for (const key of Object.keys(value)) {
                applyValue(fresh, key, value[key]);
            }
            if (!fresh.id)
                fresh.id = this.id;
            this.storage.set(this.id, fresh);
        }
    }
    async update(value) {
        const existing = this.storage.get(this.id);
        if (!existing)
            throw new Error("not-found");
        const next = { ...existing };
        for (const key of Object.keys(value)) {
            applyValue(next, key, value[key]);
        }
        this.storage.set(this.id, next);
    }
    collection(name) {
        const nested = `${this.parentCollection.name}/${this.id}/${name}`;
        return this.parentCollection.root.collection(nested);
    }
}
class MockQuery {
    constructor(collection, filters = [], orderByClause, limitValue) {
        this.collection = collection;
        this.filters = filters;
        this.orderByClause = orderByClause;
        this.limitValue = limitValue;
    }
    where(field, op, value) {
        return new MockQuery(this.collection, [...this.filters, { field, op, value }], this.orderByClause, this.limitValue);
    }
    orderBy(field, direction = "asc") {
        return new MockQuery(this.collection, this.filters, { field, direction }, this.limitValue);
    }
    limit(value) {
        return new MockQuery(this.collection, this.filters, this.orderByClause, value);
    }
    async get() {
        let results = this.collection.listDocs();
        for (const filter of this.filters) {
            if (filter.op === "==") {
                results = results.filter((doc) => doc.data[filter.field] === filter.value);
            }
            else {
                throw new Error(`Unsupported filter op ${filter.op}`);
            }
        }
        if (this.orderByClause) {
            const { field, direction } = this.orderByClause;
            results = results.sort((a, b) => {
                const av = a.data[field];
                const bv = b.data[field];
                if (av === bv)
                    return 0;
                if (av === undefined)
                    return 1;
                if (bv === undefined)
                    return -1;
                return direction === "asc" ? (av > bv ? 1 : -1) : av > bv ? -1 : 1;
            });
        }
        if (typeof this.limitValue === "number") {
            results = results.slice(0, this.limitValue);
        }
        return new MockQuerySnapshot(results.map((doc) => new MockDocumentSnapshot({ id: doc.id, data: doc.data })));
    }
}
let counter = 0;
class MockCollection {
    constructor(name, root) {
        this.name = name;
        this.root = root;
        this.storage = new Map();
    }
    doc(id) {
        const docId = id || `mock-${++counter}`;
        if (!this.storage.has(docId)) {
            this.storage.set(docId, undefined);
        }
        return new MockDocRef(this, docId);
    }
    where(field, op, value) {
        return new MockQuery(this).where(field, op, value);
    }
    orderBy(field, direction) {
        return new MockQuery(this).orderBy(field, direction);
    }
    limit(value) {
        return new MockQuery(this).limit(value);
    }
    listDocs() {
        const docs = [];
        for (const [id, data] of this.storage.entries()) {
            if (data)
                docs.push({ id, data });
        }
        return docs;
    }
}
class MockTransaction {
    async get(ref) {
        return ref.get();
    }
    set(ref, data, opts) {
        return ref.set(data, opts);
    }
    update(ref, data) {
        return ref.update(data);
    }
}
class MockFirestore {
    constructor() {
        this.collections = new Map();
    }
    collection(name) {
        if (!this.collections.has(name)) {
            this.collections.set(name, new MockCollection(name, this));
        }
        return this.collections.get(name);
    }
    runTransaction(fn) {
        const tx = new MockTransaction();
        return fn(tx);
    }
    reset() {
        this.collections.clear();
    }
    dumpCollection(name) {
        const col = this.collections.get(name);
        if (!col)
            return [];
        return col.listDocs().map((doc) => ({ id: doc.id, data: clone(doc.data) }));
    }
    getDoc(collection, id) {
        const col = this.collections.get(collection);
        if (!col)
            return undefined;
        const data = col.storage.get(id);
        return data ? clone(data) : undefined;
    }
}
exports.firestoreMock = new MockFirestore();
function resetFirestoreMock() {
    exports.firestoreMock.reset();
    counter = 0;
}
exports.FieldValueStub = {
    increment(amount) {
        return new IncrementOp(amount);
    },
};
