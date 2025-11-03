// src/screens/leaderboard/Leaderboard.tsx

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";
import { getLeaderboard, getUserProfile } from "../../lib/api";

type Frame = "week" | "month" | "all";

type LeaderboardEntry = {
  uid: string;
  name: string;
  coins: number;
  savingsThisFrame: number; // rupees saved in the frame (week for now)
  isYou: boolean;
};

function Medal({ rank }: { rank: number }) {
  const className =
    rank === 1
      ? "bg-yellow-400"
      : rank === 2
      ? "bg-gray-300"
      : "bg-amber-700";
  return (
    <span
      className={`inline-block w-3 h-3 rounded-full ${className}`}
      aria-hidden
    />
  );
}

export default function Leaderboard() {
  const nav = useNavigate();

  const [frame, setFrame] = useState<Frame>("week"); // default "This Week"
  const [loading, setLoading] = useState<boolean>(true);
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // helper: load data for "This Week"
  async function loadWeek() {
    setLoading(true);
    setErrorMsg("");

    try {
      // 1. who am I? (from Firebase + /api/users/profile)
      const auth = getAuth();
      const uid = auth.currentUser?.uid || "guest";

      // server already knows who you are via bearer token
      const meProfileResp = await getUserProfile();
      // meProfileResp.profile = { name?, total_coins?, ... }
      const myName =
        (meProfileResp?.profile?.name as string | undefined) || "You";
      const myCoins = Number(meProfileResp?.profile?.total_coins || 0);

      // 2. leaderboard rows from backend (current week)
      //    backend returns something like:
      //    { ok: true, region: "global", data: [ { user_id, score }, ... ] }
      const lbResp = await getLeaderboard();
      const rawList: any[] = Array.isArray(lbResp?.data)
        ? lbResp.data
        : [];

      // 3. hydrate each row
      //    We USED TO do N extra getUserProfile(rowUid) calls,
      //    but now getUserProfile() takes no args (server uses bearer token).
      //    We'll skip per-row name lookup for OTHER users.
      //    We'll infer:
      //      - if it's you  -> use your name + coins
      //      - otherwise    -> fallback to "User" or short uid, coins = 0
      const hydrated: LeaderboardEntry[] = [];
      for (const item of rawList) {
        const rowUid = String(item.user_id || "");
        const rowScore = Number(item.score || 0); // "₹ saved this week"

        let rowName = "User";
        let rowCoins = 0;
        const isYou = rowUid === uid;

        if (isYou) {
          rowName = myName;
          rowCoins = myCoins;
        } else {
          // fallback display for others:
          // show short uid for a tiny bit more personality
          const shortUid = rowUid ? rowUid.slice(0, 6) : "user";
          rowName = `User ${shortUid}`;
          rowCoins = 0;
        }

        hydrated.push({
          uid: rowUid,
          name: rowName,
          coins: rowCoins,
          savingsThisFrame: rowScore,
          isYou,
        });
      }

      // 4. ensure "you" appear even if not top N
      const alreadyHasMe = hydrated.some((r) => r.isYou);
      if (!alreadyHasMe) {
        hydrated.push({
          uid,
          name: myName,
          coins: myCoins,
          savingsThisFrame: 0,
          isYou: true,
        });
      }

      // 5. sort by savings desc, then coins desc
      hydrated.sort(
        (a, b) =>
          b.savingsThisFrame - a.savingsThisFrame ||
          b.coins - a.coins
      );

      // 6. compute my rank
      const idx = hydrated.findIndex((r) => r.isYou);
      setMyRank(idx >= 0 ? idx + 1 : null);
      setRows(hydrated);
    } catch (err: any) {
      console.error("Leaderboard load failed", err);
      setErrorMsg(
        err?.message || "Could not load leaderboard."
      );
      setRows([]);
      setMyRank(null);
    } finally {
      setLoading(false);
    }
  }

  // whenever frame changes, load appropriate data
  useEffect(() => {
    if (frame === "week") {
      loadWeek();
    } else {
      // month / all not wired yet -> just show placeholder
      setRows([]);
      setMyRank(null);
      setLoading(false);
      setErrorMsg("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame]);

  // friendly label for frame UI
  const frameLabel = (f: Frame) =>
    f === "week"
      ? "This Week"
      : f === "month"
      ? "This Month"
      : "All Time";

  // table body (memo mainly for cleanliness)
  const tableBody = useMemo(() => {
    if (loading) {
      return (
        <tr className="border-t">
          <td
            colSpan={4}
            className="py-6 text-center text-sm text-gray-500"
          >
            Loading…
          </td>
        </tr>
      );
    }

    if (frame !== "week") {
      // future frames
      return (
        <tr className="border-t">
          <td
            colSpan={4}
            className="py-6 text-center text-sm text-gray-500"
          >
            Coming soon
          </td>
        </tr>
      );
    }

    if (errorMsg) {
      return (
        <tr className="border-t">
          <td
            colSpan={4}
            className="py-6 text-center text-sm text-red-600"
          >
            {errorMsg}
          </td>
        </tr>
      );
    }

    if (!rows.length) {
      return (
        <tr className="border-t">
          <td
            colSpan={4}
            className="py-6 text-center text-sm text-gray-500"
          >
            No savers yet. Be the first this week 👑
          </td>
        </tr>
      );
    }

    return rows.map((r, i) => (
      <tr
        key={r.uid + "-" + i}
        className={`border-t ${r.isYou ? "bg-yellow-50" : ""}`}
      >
        <td className="py-2 px-3">
          {i < 3 ? <Medal rank={i + 1} /> : i + 1}
        </td>
        <td className="py-2 px-3">
          {r.name}
          {r.isYou ? " (you)" : ""}
        </td>
        <td className="py-2 px-3">
          {r.coins.toLocaleString("en-IN")}
        </td>
        <td className="py-2 px-3">
          ₹{r.savingsThisFrame.toFixed(0)}
        </td>
      </tr>
    ));
  }, [rows, loading, frame, errorMsg]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-pink-500 to-orange-400">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* header */}
        <header className="flex items-center justify-between mb-4">
          <button
            className="px-3 py-1.5 text-sm rounded-full border bg-white/80"
            onClick={() => nav(-1)}
          >
            ← Back
          </button>
          <h1 className="text-lg font-semibold text-white drop-shadow">
            Leaderboard
          </h1>
          <div className="w-16" />
        </header>

        {/* timeframe selector + rank pill */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {(["week", "month", "all"] as Frame[]).map((f) => (
            <button
              key={f}
              onClick={() => setFrame(f)}
              className={`px-3 py-1.5 rounded-full text-sm border ${
                frame === f
                  ? "bg-black text-white border-black"
                  : "bg-white/80"
              }`}
            >
              {frameLabel(f)}
            </button>
          ))}

          <div className="ml-auto text-white/90 text-sm">
            Your rank:{" "}
            <b>{myRank !== null ? `#${myRank}` : "—"}</b>
          </div>
        </div>

        {/* table */}
        <div className="rounded-xl overflow-hidden bg-white shadow">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-black/5 text-left">
                <th className="py-2 px-3">Rank</th>
                <th className="py-2 px-3">User</th>
                <th className="py-2 px-3">Tokens</th>
                <th className="py-2 px-3">Savings (₹)</th>
              </tr>
            </thead>
            <tbody>{tableBody}</tbody>
          </table>
        </div>

        <p className="text-xs text-white/90 mt-3">
          Savings = money you kept in your pocket by ordering on
          the cheaper platform.
        </p>
      </div>
    </main>
  );
}