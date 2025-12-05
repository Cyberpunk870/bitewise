"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAddresses = getAddresses;
exports.saveAddress = saveAddress;
exports.nearestFor = nearestFor;
// bitewise/server/api/user/addresses.ts
const crypto_1 = require("crypto");
const zod_1 = require("zod");
const firestore_1 = require("firebase-admin/firestore");
const express_1 = require("express");
const logger_1 = __importDefault(require("../../lib/logger"));
const log = logger_1.default.child({ module: "user-addresses" });
/**
 * Payload we accept from frontend.
 * We allow optional id for "Make active" updates.
 */
const router = (0, express_1.Router)();
const AddressInput = zod_1.z.object({
    id: zod_1.z.string().optional(), // upsert
    label: zod_1.z.string().min(1),
    addressLine: zod_1.z.string().optional().default(""),
    lat: zod_1.z.number(),
    lng: zod_1.z.number(),
    active: zod_1.z.boolean().optional().default(false),
});
function col() {
    // Match Firestore security rules + indexes.
    return (0, firestore_1.getFirestore)().collection("saved_addresses");
}
/**
 * Internal Firestore representation will ALSO include `is_active`
 * for index queries, but we'll map it back to { active } on read.
 */
function fireToClient(data) {
    return {
        id: String(data.id),
        user_id: String(data.user_id),
        label: String(data.label || ""),
        addressLine: String(data.addressLine || ""),
        lat: Number(data.lat),
        lng: Number(data.lng),
        active: Boolean(data.active ?? data.is_active ?? false),
        created_at: String(data.created_at || ""),
        updated_at: String(data.updated_at || ""),
    };
}
/**
 * List addresses for a user, newest first.
 */
async function getAddresses(uid) {
    const snap = await col()
        .where("user_id", "==", uid)
        .orderBy("created_at", "desc")
        .get();
    const list = snap.docs.map((d) => fireToClient(d.data()));
    return { ok: true, list };
}
/**
 * Create or update an address; enforce single-active per user.
 * - If active=true, deactivate all others for that uid.
 * - Upsert by id if provided.
 */
// bitewise/server/api/user/addresses.ts (replace saveAddress only)
async function saveAddress(uid, raw) {
    const parsed = AddressInput.parse(raw);
    const db = (0, firestore_1.getFirestore)();
    const now = new Date().toISOString();
    const id = parsed.id || (0, crypto_1.randomUUID)();
    await db.runTransaction(async (tx) => {
        const coll = col();
        // ---- READS FIRST (only reads here) ----
        // 1) Read ALL existing addresses for the user once
        const allSnap = await tx.get(coll.where("user_id", "==", uid).orderBy("created_at", "desc"));
        const all = allSnap.docs.map((d) => ({ id: d.id, ref: d.ref, data: d.data() }));
        // 2) Locate existing row for this id (if any)
        const existingIdx = all.findIndex((d) => d.id === id);
        const existing = existingIdx >= 0 ? all[existingIdx] : null;
        // ---- Decide next state entirely in memory ----
        // a) Start from current list → plain objects we’ll write back
        const nextList = all.map((d) => ({
            id: d.id,
            label: String(d.data.label || ""),
            addressLine: String(d.data.addressLine || ""),
            lat: Number(d.data.lat),
            lng: Number(d.data.lng),
            active: Boolean(d.data.active ?? d.data.is_active ?? false),
            created_at: String(d.data.created_at || now),
            updated_at: now,
        }));
        // b) Upsert current address into nextList
        const upserted = {
            id,
            label: parsed.label,
            addressLine: parsed.addressLine || "",
            lat: parsed.lat,
            lng: parsed.lng,
            active: !!parsed.active, // we'll enforce single-active below
            created_at: existing ? String(existing.data.created_at || now) : now,
            updated_at: now,
        };
        if (existing) {
            nextList[existingIdx] = upserted;
        }
        else {
            nextList.unshift(upserted); // newest first
        }
        // c) Enforce exactly one active if requested
        if (parsed.active) {
            for (const a of nextList)
                a.active = a.id === id;
        }
        else {
            // keep whatever was active among others (if none set, none active)
            const hadActive = !parsed.active && nextList.some((a) => a.id !== id && a.active);
            if (!hadActive) {
                // nothing to do; do not force active
            }
        }
        // d) Keep at most 3 addresses: drop oldest *non-active* first
        if (nextList.length > 3) {
            const keep = [];
            // Always keep active one(s) first
            for (const a of nextList)
                if (a.active)
                    keep.push(a.id);
            // Then add newest others until 3 total
            for (const a of nextList) {
                if (keep.length >= 3)
                    break;
                if (!keep.includes(a.id))
                    keep.push(a.id);
            }
            // Filter
            for (let i = nextList.length - 1; i >= 0; i--) {
                if (!keep.includes(nextList[i].id))
                    nextList.splice(i, 1);
            }
        }
        // ---- WRITES AFTER ALL READS ----
        const idsNext = new Set(nextList.map((a) => a.id));
        // delete removed
        for (const d of all) {
            if (!idsNext.has(d.id)) {
                tx.delete(d.ref);
            }
        }
        // upsert remaining
        for (const a of nextList) {
            const ref = coll.doc(a.id);
            tx.set(ref, {
                id: a.id,
                user_id: uid,
                label: a.label,
                addressLine: a.addressLine,
                lat: a.lat,
                lng: a.lng,
                active: a.active,
                is_active: a.active, // indexed mirror
                created_at: a.created_at,
                updated_at: a.updated_at,
            }, { merge: true });
        }
    });
    // return fresh list
    return await getAddresses(uid);
}
/**
 * Find nearest saved address to a given point (simple haversine).
 * Used to decide whether to nag the user to "Update address".
 */
async function nearestFor(uid, lat, lng) {
    const { list } = await getAddresses(uid);
    if (!list.length)
        return {};
    let best = undefined;
    for (const a of list) {
        const d = haversineMeters(lat, lng, a.lat, a.lng);
        if (!best || d < best.distance_m) {
            best = { id: a.id, label: a.label, distance_m: d };
        }
    }
    return best ? { nearest: best } : {};
}
/** Local utility for distance in meters */
function haversineMeters(lat1, lon1, lat2, lon2) {
    const toRad = (x) => (x * Math.PI) / 180;
    const R = 6371e3;
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lon2 - lon1);
    const a = Math.sin(Δφ / 2) ** 2 +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
router.get("/", async (req, res) => {
    try {
        const uid = req.user?.uid || req.uid;
        if (!uid)
            return res.status(401).json({ ok: false, error: "unauthorized" });
        const result = await getAddresses(uid);
        res.json(result);
    }
    catch (err) {
        log.error({ err }, "GET /user/addresses failed");
        res.status(500).json({ ok: false, error: "internal error" });
    }
});
router.post("/", async (req, res) => {
    try {
        const uid = req.user?.uid || req.uid;
        if (!uid)
            return res.status(401).json({ ok: false, error: "unauthorized" });
        const result = await saveAddress(uid, req.body);
        res.json(result);
    }
    catch (err) {
        log.error({ err }, "POST /user/addresses failed");
        const status = err?.name === "ZodError" ? 400 : 500;
        res.status(status).json({ ok: false, error: err?.message || "internal error" });
    }
});
router.get("/nearest", async (req, res) => {
    try {
        const uid = req.user?.uid || req.uid;
        if (!uid)
            return res.status(401).json({ ok: false, error: "unauthorized" });
        const lat = Number(req.query?.lat);
        const lng = Number(req.query?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return res.status(400).json({ ok: false, error: "lat/lng required" });
        }
        const result = await nearestFor(uid, lat, lng);
        res.json({ ok: true, ...result });
    }
    catch (err) {
        log.error({ err }, "GET /user/nearest failed");
        res.status(500).json({ ok: false, error: "internal error" });
    }
});
exports.default = router;
