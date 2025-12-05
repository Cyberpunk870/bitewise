import React, { useEffect, useState } from 'react';

function fire<T>(name: string, detail: T) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export default function FilterPanel() {
  const [priceMax, setPriceMax] = useState(1500);
  const [ratingMin, setRatingMin] = useState(0);
  const [distanceMax, setDistanceMax] = useState(20);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('bw.filters');
      if (!raw) return;
      const f = JSON.parse(raw) || {};
      if (typeof f.priceMax === 'number') setPriceMax(f.priceMax);
      if (typeof f.ratingMin === 'number') setRatingMin(f.ratingMin);
      if (typeof f.distanceMax === 'number') setDistanceMax(f.distanceMax);
    } catch {}
  }, []);

  function apply() {
    const payload = { priceMax, ratingMin, distanceMax };
    try { localStorage.setItem('bw.filters', JSON.stringify(payload)); } catch {}
    fire('bw:filters:update', payload);
  }

  function reset() {
    setPriceMax(1500); setRatingMin(0); setDistanceMax(20);
    const payload = { priceMax: 1500, ratingMin: 0, distanceMax: 20 };
    try { localStorage.setItem('bw.filters', JSON.stringify(payload)); } catch {}
    fire('bw:filters:update', payload);
  }

  return (
    <div className="rounded-2xl border bg-white/95 p-3 shadow">
      <p className="font-medium mb-2">Filter</p>

      <div className="mb-4">
        <div className="flex items-center justify-between">
          <p>Price</p>
          <p className="text-xs opacity-70">≤ ₹{priceMax}</p>
        </div>
        <input type="range" min={50} max={1500} step={10} value={priceMax}
               className="w-full" onChange={e=>setPriceMax(Number(e.target.value))}/>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between">
          <p>Rating</p>
          <p className="text-xs opacity-70">≥ {ratingMin.toFixed(1)}</p>
        </div>
        <input type="range" min={0} max={5} step={0.1} value={ratingMin}
               className="w-full" onChange={e=>setRatingMin(Number(e.target.value))}/>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between">
          <p>Distance</p>
          <p className="text-xs opacity-70">≤ {distanceMax} km</p>
        </div>
        <input type="range" min={0} max={20} step={1} value={distanceMax}
               className="w-full" onChange={e=>setDistanceMax(Number(e.target.value))}/>
      </div>

      <div className="flex items-center justify-between">
        <button className="px-3 py-2 rounded border" onClick={reset}>Reset</button>
        <button className="px-4 py-2 rounded-xl bg-black text-white" onClick={apply}>Apply</button>
      </div>
    </div>
  );
}
