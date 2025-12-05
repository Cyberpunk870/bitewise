import { Router } from "express";
import { ensureAdmin } from "../lib/firebaseAdmin";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

type MenuSnapshot = {
  type: "menu_snapshot";
  platform: string;
  scraped_at: number;
  restaurant: {
    restaurant_id: string;
    restaurant_name: string;
    rating?: number | string;
    rating_count?: number | string;
    delivery_sla?: string;
    lat?: number | string | null;
    lng?: number | string | null;
    city?: string;
    locality?: string;
    areaName?: string;
    image?: string;
  };
  items: {
    menu_id: string | number;
    name: string;
    price?: number;
    mrp?: number;
    isVeg?: boolean;
    image?: string;
    offers?: { title?: string; code?: string; description?: string }[];
  }[];
  fees?: Record<string, any>;
};

const router = Router();

// Basic shared-secret auth (dashboard env: MENU_INGEST_SECRET)
function checkAuth(req: any) {
  const secret = process.env.MENU_INGEST_SECRET || "";
  if (!secret) return false;
  const provided =
    (req.headers["x-bitewise-menu-secret"] as string | undefined) ||
    (typeof req.body?.secret === "string" ? req.body.secret : "");
  return provided === secret;
}

router.post("/", async (req, res) => {
  try {
    if (!checkAuth(req)) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    const payload = req.body as { items?: MenuSnapshot[] };
    if (!payload?.items || !Array.isArray(payload.items)) {
      return res.status(400).json({ ok: false, error: "items[] required" });
    }

    ensureAdmin();
    const db = getFirestore();
    const msg = getMessaging();

    const now = Date.now();
    const updates: any[] = [];
    const pushes: any[] = [];

    for (const snap of payload.items as MenuSnapshot[]) {
      if (!snap || snap.type !== "menu_snapshot") continue;
      const r = snap.restaurant || ({} as any);
      const rid = String(r.restaurant_id || "").trim();
      if (!rid) continue;

      const docRef = db.collection("menu_snapshots").doc(rid);
      const prev = await docRef.get();
      const prevData = prev.exists ? (prev.data() as any) : null;

      updates.push({
        ref: docRef,
        data: {
          platform: snap.platform || "unknown",
          scraped_at: snap.scraped_at || now,
          restaurant: {
            id: rid,
            name: r.restaurant_name || "",
            rating: r.rating ?? null,
            rating_count: r.rating_count ?? null,
            delivery_sla: r.delivery_sla ?? null,
            lat: r.lat ?? null,
            lng: r.lng ?? null,
            city: r.city ?? null,
            locality: r.locality ?? r.areaName ?? null,
            image: r.image ?? null,
          },
          items: (snap.items || []).map((it) => ({
            id: String(it.menu_id),
            name: it.name || "",
            price: typeof it.price === "number" ? it.price : null,
            mrp: typeof it.mrp === "number" ? it.mrp : null,
            isVeg: it.isVeg ?? null,
            image: it.image ?? null,
            offers: Array.isArray(it.offers) ? it.offers : [],
          })),
          fees: snap.fees || {},
          updated_at: now,
        },
      });

      // Push hook: notify on meaningful price drops
      if (prevData && Array.isArray(prevData.items)) {
        const prevIndex = new Map<string, any>();
        prevData.items.forEach((p: any) => prevIndex.set(String(p.id), p));
        const drops: { name: string; old: number; now: number }[] = [];
        for (const it of snap.items || []) {
          const prevItem = prevIndex.get(String(it.menu_id));
          const oldPrice = typeof prevItem?.price === "number" ? prevItem.price : null;
          const newPrice = typeof it.price === "number" ? it.price : null;
          if (oldPrice != null && newPrice != null && newPrice < oldPrice) {
            drops.push({ name: it.name || "Dish", old: oldPrice, now: newPrice });
          }
        }
        if (drops.length) {
          pushes.push({
            restaurant: r.restaurant_name || "Restaurant",
            drops,
          });
        }
      }
    }

    // Commit writes
    if (updates.length) {
      const batch = db.batch();
      updates.forEach((u) => batch.set(u.ref, u.data, { merge: true }));
      await batch.commit();
    }

    // Send push notifications (best-effort)
    if (pushes.length && process.env.VAPID_PUBLIC_KEY) {
      for (const p of pushes) {
        try {
          await msg.send({
            topic: "price-drops",
            data: {
              type: "price_drop",
              restaurant: p.restaurant,
              drops: JSON.stringify(p.drops.slice(0, 3)),
            },
            notification: {
              title: `Price drop at ${p.restaurant}`,
              body: `${p.drops[0].name} dropped to ₹${p.drops[0].now}`,
            },
          });
        } catch {
          /* ignore push failures */
        }
      }
    }

    return res.json({ ok: true, updated: updates.length, pushes: pushes.length });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || "ingest failed" });
  }
});

export default router;
