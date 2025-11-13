"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestEvents = ingestEvents;
// server/api/ingest.ts
const db_1 = require("../lib/db");
const response_1 = require("../lib/response");
async function ingestEvents(events) {
    try {
        events.forEach((ev) => (0, db_1.insert)('events', ev));
        return (0, response_1.ok)({ count: events.length });
    }
    catch (err) {
        return (0, response_1.fail)(err?.message || 'Failed to ingest events');
    }
}
