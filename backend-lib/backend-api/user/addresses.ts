// bitewise/server/api/user/addresses.ts
import { randomUUID } from "crypto";
import { z } from "zod";
import { getFirestore } from "firebase-admin/firestore";
import { Router } from "express";
import logger from "../../lib/logger";

const log = logger.child({ module: "user-addresses" });

/**
 * Payload we accept from frontend.
 * We allow optional id for "Make active" updates.
 */
const router = Router();

const AddressInput = z.object({
  id: z.string().optional(), // upsert
  label: z.string().min(1),
  addressLine: z.string().optional().default(""),
  lat: z.number(),
  lng: z.number(),
  active: z.boolean().optional().default(false),
});

/**
 * Shape we RETURN to the frontend.
 * (Frontend expects "active", not "is_active")
 */
export type AddressDoc = {
  id: string;
  user_id: string;
  label: string;
  addressLine: string;
  lat: number;
  lng: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

function col() {
  // Match Firestore security rules + indexes.
  return getFirestore().collection("saved_addresses");
}

/**
 * Internal Firestore representation will ALSO include `is_active`
 * for index queries, but we'll map it back to { active } on read.
 */
function fireToClient(data: any): AddressDoc {
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
export async function getAddresses(
  uid: string
): Promise<{ ok: true; list: AddressDoc[] }> {
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
export async function saveAddress(
  uid: string,
  raw: unknown
): Promise<{ ok: true; list: AddressDoc[] }> {
  const parsed = AddressInput.parse(raw);
  const db = getFirestore();
  const now = new Date().toISOString();
  const id = parsed.id || randomUUID();

  await db.runTransaction(async (tx) => {
    const coll = col();

    // ---- READS FIRST (only reads here) ----
    // 1) Read ALL existing addresses for the user once
    const allSnap = await tx.get(
      coll.where("user_id", "==", uid).orderBy("created_at", "desc")
    );
    const all = allSnap.docs.map((d) => ({ id: d.id, ref: d.ref, data: d.data() as any }));

    // 2) Locate existing row for this id (if any)
    const existingIdx = all.findIndex((d) => d.id === id);
    const existing = existingIdx >= 0 ? all[existingIdx] : null;

    // ---- Decide next state entirely in memory ----
    // a) Start from current list → plain objects we’ll write back
    const nextList: Array<{
      id: string;
      label: string;
      addressLine: string;
      lat: number;
      lng: number;
      active: boolean;
      created_at: string;
      updated_at: string;
    }> = all.map((d) => ({
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
    } else {
      nextList.unshift(upserted); // newest first
    }

    // c) Enforce exactly one active if requested
    if (parsed.active) {
      for (const a of nextList) a.active = a.id === id;
    } else {
      // keep whatever was active among others (if none set, none active)
      const hadActive =
        !parsed.active && nextList.some((a) => a.id !== id && a.active);
      if (!hadActive) {
        // nothing to do; do not force active
      }
    }

    // d) Keep at most 3 addresses: drop oldest *non-active* first
    if (nextList.length > 3) {
      const keep: string[] = [];
      // Always keep active one(s) first
      for (const a of nextList) if (a.active) keep.push(a.id);
      // Then add newest others until 3 total
      for (const a of nextList) {
        if (keep.length >= 3) break;
        if (!keep.includes(a.id)) keep.push(a.id);
      }
      // Filter
      for (let i = nextList.length - 1; i >= 0; i--) {
        if (!keep.includes(nextList[i].id)) nextList.splice(i, 1);
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
      tx.set(
        ref,
        {
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
        },
        { merge: true }
      );
    }
  });

  // return fresh list
  return await getAddresses(uid);
}

/**
 * Find nearest saved address to a given point (simple haversine).
 * Used to decide whether to nag the user to "Update address".
 */
export async function nearestFor(
  uid: string,
  lat: number,
  lng: number
): Promise<{ nearest?: { id: string; label: string; distance_m: number } }> {
  const { list } = await getAddresses(uid);
  if (!list.length) return {};

  let best:
    | { id: string; label: string; distance_m: number }
    | undefined = undefined;

  for (const a of list) {
    const d = haversineMeters(lat, lng, a.lat, a.lng);
    if (!best || d < best.distance_m) {
      best = { id: a.id, label: a.label, distance_m: d };
    }
  }

  return best ? { nearest: best } : {};
}

/** Local utility for distance in meters */
function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371e3;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
router.get("/", async (req: any, res) => {
  try {
    const uid = req.user?.uid || req.uid;
    if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
    const result = await getAddresses(uid);
    res.json(result);
  } catch (err: any) {
    log.error({ err }, "GET /user/addresses failed");
    res.status(500).json({ ok: false, error: "internal error" });
  }
});

router.post("/", async (req: any, res) => {
  try {
    const uid = req.user?.uid || req.uid;
    if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
    const result = await saveAddress(uid, req.body);
    res.json(result);
  } catch (err: any) {
    log.error({ err }, "POST /user/addresses failed");
    const status = err?.name === "ZodError" ? 400 : 500;
    res.status(status).json({ ok: false, error: err?.message || "internal error" });
  }
});

router.get("/nearest", async (req: any, res) => {
  try {
    const uid = req.user?.uid || req.uid;
    if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
    const lat = Number(req.query?.lat);
    const lng = Number(req.query?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ ok: false, error: "lat/lng required" });
    }
    const result = await nearestFor(uid, lat, lng);
    res.json({ ok: true, ...result });
  } catch (err: any) {
    log.error({ err }, "GET /user/nearest failed");
    res.status(500).json({ ok: false, error: "internal error" });
  }
});

export default router;
