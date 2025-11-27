"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insert = insert;
exports.getAll = getAll;
exports.upsert = upsert;
exports.clear = clear;
const store = {
    events: [],
    tasks: [],
    achievements: [],
    leaderboard: [],
    addresses: [],
};
function insert(table, data) {
    store[table].push(data);
    return data;
}
function getAll(table) {
    return store[table];
}
function upsert(table, data) {
    const list = store[table];
    const idx = list.findIndex((x) => x.id === data.id);
    if (idx >= 0)
        list[idx] = data;
    else
        list.push(data);
}
function clear(table) {
    store[table] = [];
}
