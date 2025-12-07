// src/screens/leaderboard/Leaderboard.tsx

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";
import { getLeaderboard, getUserProfile } from "../../lib/api";
import { addNotice } from "../../lib/notifications";
import { logError } from "../../lib/logger";
import { emit } from "../../lib/events";

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
  const [authReady, setAuthReady] = useState<"loading" | "ready" | "needsLogin">("loading");

  useEffect(() => {
    const hasVerified = !!(sessionStorage.getItem("bw.session.phoneVerified") || "");
    if (!hasVerified) {
      setAuthReady("needsLogin");
      setLoading(false);
      return;
    }
    let unsub: (() => void) | null = null;
    const auth = getAuth();
    unsub = auth.onAuthStateChanged((user) => {
      setAuthReady(user ? "ready" : "needsLogin");
    });
    return () => { unsub?.(); };
  }, []);

  // helper: load data for "This Week"
  async function loadWeek() {
    setLoading(true);
    setErrorMsg("");

    try {
      // 1. who am I? (from Firebase + /api/users/profile)
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        setAuthReady("needsLogin");
        setLoading(false);
        return;
      }
      const uid = user.uid;

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
      logError("Leaderboard load failed", { err: String(err) }, { toast: true });
      setErrorMsg(err?.message || "Could not load leaderboard.");
      setRows([]);
      setMyRank(null);
      addNotice({
        kind: "system",
        title: "Leaderboard unavailable",
        body: "Please try again later.",
      });
    } finally {
      setLoading(false);
    }
  }

  // whenever frame changes, load appropriate data
  useEffect(() => {
    // mark mission: open_leaderboard
    try { emit('bw:open:leaderboard', null as any); } catch {}

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
      return <div className="py-6 text-center text-sm text-white/70">No savers yet. Be the first this week 👑</div>;
    }

    return rows.map((r, i) => (
      <div
        key={r.uid + "-" + i}
        className={[
          "flex items-center justify-between rounded-2xl border border-white/10 px-3 py-3",
          r.isYou ? "bg-white/15 shadow-lg shadow-indigo-500/20" : "bg-white/5",
        ].join(" ")}
      >
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-white/10 grid place-items-center text-sm font-semibold">
            {i + 1}
          </div>
          <div>
            <div className="font-semibold text-white flex items-center gap-2">
              {r.name}
              {r.isYou && (
                <span className="text-[10px] uppercase tracking-[0.2em] text-white/70">
                  YOU
                </span>
              )}
            </div>
            <div className="text-xs text-white/60">₹{r.savingsThisFrame.toFixed(0)} saved</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold text-amber-200">{r.coins.toLocaleString("en-IN")} Bites</div>
          <div className="text-xs text-white/60 flex items-center justify-end gap-2">
            <Medal rank={i + 1} /> {frameLabel(frame)}
          </div>
        </div>
      </div>
    ));
  }, [rows, loading, frame, errorMsg]);

  return (
    <main className="min-h-screen px-4 py-6 text-white">
      <div className="max-w-4xl mx-auto space-y-5">
        {authReady === "needsLogin" && (
          <div className="text-sm text-white/80">
            Please log in with your phone number to view the leaderboard.
          </div>
        )}
        {authReady === "loading" && (
          <div className="text-sm text-white/60">Loading…</div>
        )}
        <header className="flex items-center justify-between">
          <button
            className="px-3 py-1.5 text-sm rounded-full border border-white/20 bg-white/10 hover:bg-white/15 transition"
            onClick={() => nav(-1)}
          >
            ← Back
          </button>
          <h1 className="text-lg font-semibold">Leaderboard</h1>
          <div className="text-sm text-white/70">
            Your rank: <b>{myRank !== null ? `#${myRank}` : "—"}</b>
          </div>
        </header>

        <div className="glass-card p-5 border border-white/10">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {(["week", "month", "all"] as Frame[]).map((f) => (
              <button
                key={f}
                onClick={() => setFrame(f)}
                className={[
                  "px-3 py-1.5 rounded-full text-sm border transition",
                  frame === f
                    ? "bg-white text-black border-white"
                    : "bg-white/5 text-white/70 border-white/10",
                ].join(" ")}
              >
                {frameLabel(f)}
              </button>
            ))}
          </div>
          <div className="space-y-3">{tableBody}</div>
          <p className="text-[11px] text-white/60 mt-4">
            Savings = money you kept in your pocket by ordering on the cheaper platform.
          </p>
        </div>
      </div>
    </main>
  );
}
