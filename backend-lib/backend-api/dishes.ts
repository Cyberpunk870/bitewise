import express, { Request, Response, NextFunction } from "express";
import logger from "../lib/logger";

const log = logger.child({ module: "dishes" });
const router = express.Router();

const PROVIDER_BASE = process.env.SWIGGY_PROVIDER_BASE || "http://15.235.85.18:7147";
const PROVIDER_KEY = process.env.SWIGGY_PROVIDER_KEY || process.env.SWIGGY_API_KEY || "N00717005PXY";

type AnyObj = Record<string, any>;

function normalizeList(raw: any): AnyObj[] {
  if (Array.isArray(raw)) return raw;
  const candidates =
    raw?.dishes ||
    raw?.results ||
    raw?.items ||
    raw?.data?.dishes ||
    raw?.data?.results ||
    raw?.data?.items ||
    raw?.data?.list ||
    raw?.list ||
    raw?.data;
  return Array.isArray(candidates) ? candidates : [];
}

function normalizeDish(it: AnyObj, idx: number) {
  const platform = "swiggy";
  const restaurantId = it.restaurant_id || it.restaurantId || it.store_id || "r";
  const id =
    it.id ||
    it.dish_id ||
    it.dishId ||
    it.menu_id ||
    `${platform}-${restaurantId}-${idx}`;
  const name = it.dishName || it.dish_name || it.name || "Dish";
  const restaurantName =
    it.restaurantName || it.restaurant_name || it.store_name || it.restaurant || "";
  const priceRaw =
    it.price ||
    it.final_price ||
    it.discounted_price ||
    it.cost ||
    it.defaultPrice ||
    it.offer_price;
  const price = typeof priceRaw === "number" ? priceRaw : Number(priceRaw);
  const ratingRaw = it.rating || it.avgRating || it.ratings;
  const rating = typeof ratingRaw === "number" ? ratingRaw : Number(ratingRaw);
  const tags: string[] = [];
  if (it.bestseller || it.isBestseller) tags.push("bestseller");
  if (it.top_ordered || it.topOrdered) tags.push("top_ordered");
  if (it.pureVeg || it.isVeg) tags.push("pure_veg");
  const etaMins =
    typeof it.sla === "number"
      ? it.sla
      : typeof it.eta === "number"
      ? it.eta
      : typeof it.deliveryTime === "number"
      ? it.deliveryTime
      : undefined;
  const imageUrl = it.imageUrl || it.image_url || it.img;

  return {
    id: String(id),
    name,
    restaurantName,
    price: Number.isFinite(price) ? price : undefined,
    rating: Number.isFinite(rating) ? rating : undefined,
    tags,
    etaMins,
    imageUrl,
    platform,
  };
}

router.get("/home", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const keyword = String(req.query.keyword || "popular").trim();
    const city = String(req.query.city || "").trim();
    const pincode = String(req.query.pincode || "").trim();
    const address = String(req.query.address || "").trim();
    const limitRaw = Number(req.query.limit || 0);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : 0;
    const fallbackPincode = process.env.DEFAULT_PINCODE || "560001";

    if (!keyword) return res.status(400).json({ ok: false, error: "keyword required" });
    const hasLoc = pincode || city || address || fallbackPincode;

    const params = new URLSearchParams();
    params.set("platform", "swiggy");
    params.set("keyword", keyword);
    params.set("key", PROVIDER_KEY);
    if (pincode) params.set("pincode", pincode);
    else if (address) params.set("address", address);
    else if (city) params.set("address", city);
    else if (!pincode && !address && !city && fallbackPincode) params.set("pincode", fallbackPincode);

    const url = `${PROVIDER_BASE.replace(/\/$/, "")}/search?${params.toString()}`;
    const resp = await fetch(url);
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = (data as any)?.error || resp.statusText;
      return res.status(resp.status).json({ ok: false, error: msg || "provider error" });
    }

    let list = normalizeList(data).map(normalizeDish);
    if (limit > 0) {
      list = list.slice(0, limit);
    }
    if (!list.length) {
      return res.status(503).json({ ok: false, error: "no dishes returned" });
    }

    res.json({ ok: true, dishes: list });
  } catch (err) {
    log.error({ err }, "/dishes/home failed");
    next(err);
  }
});

export default router;
