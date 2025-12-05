"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ok = ok;
exports.fail = fail;
function ok(data) {
    return { ok: true, data };
}
function fail(msg) {
    return { ok: false, error: msg };
}
