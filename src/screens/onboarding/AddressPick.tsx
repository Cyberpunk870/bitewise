/// src/screens/onboarding/AddressPick.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardFrame from '../../components/OnboardFrame';
import useOnboarding from '../../store/onboarding';
import { loadGoogleMaps } from '../../lib/googleMaps';

type Coords = { lat: number; lng: number };

export default function AddressPick() {
  const nav = useNavigate();
  const {
    addressLine: storedLine,
    lat: storedLat,
    lng: storedLng,
    setGeocode,
    setStep,
  } = useOnboarding();

  // ✅ read pre-seeded live address (from Home “Use current”)
  let seedLine = storedLine ?? '';
  let seedCoords: Coords | null =
    typeof storedLat === 'number' && typeof storedLng === 'number'
      ? { lat: storedLat, lng: storedLng }
      : null;

  try {
    const pending = sessionStorage.getItem('bw.pending.liveAddress');
    if (pending) {
      const p = JSON.parse(pending);
      if (typeof p?.lat === 'number' && typeof p?.lng === 'number') {
        seedCoords = { lat: p.lat, lng: p.lng };
      }
      if (typeof p?.addressLine === 'string' && p.addressLine) {
        seedLine = p.addressLine;
      }
    }
  } catch {}

  // Input + coords (seed)
  const [input, setInput] = useState(seedLine);
  const [coords, setCoords] = useState<Coords | null>(seedCoords);
  const [busy, setBusy] = useState(false);

  // progress
  useEffect(() => {
    setStep('addressPick');
  }, [setStep]);

  // Google refs
  const mapEl = useRef<HTMLDivElement | null>(null);
  const inputEl = useRef<HTMLInputElement | null>(null);

  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  // readiness + queued action
  const mapReady = useRef(false);
  const pendingLoc = useRef<null | (() => void)>(null);

  const reverseGeocode = useCallback(async (p: Coords) => {
    const g = await loadGoogleMaps();
    const geo = geocoderRef.current ?? new g.maps.Geocoder();
    return new Promise<string | undefined>((resolve) => {
      geo.geocode({ location: p }, (results, status) => {
        if (status === 'OK' && results && results[0]) resolve(results[0].formatted_address);
        else resolve(undefined);
      });
    });
  }, []);

  const movePin = useCallback(
    async (p: Coords, doReverse: boolean) => {
      setCoords(p);
      const map = mapRef.current;
      const marker = markerRef.current;
      if (map) map.panTo(p);
      if (marker) marker.setPosition(p);

      if (doReverse) {
        setBusy(true);
        const line = (await reverseGeocode(p)) ?? '';
        setInput(line);
        setBusy(false);
      }
    },
    [reverseGeocode]
  );

  // Init Google Map once
  useEffect(() => {
    let mounted = true;
    let clickListener: google.maps.MapsEventListener | null = null;
    let dragEndListener: google.maps.MapsEventListener | null = null;

    (async () => {
      const g = await loadGoogleMaps();
      if (!mounted || !mapEl.current) return;

      const center: Coords = coords ?? { lat: 28.6139, lng: 77.209 };
      const map = new g.maps.Map(mapEl.current, {
        center,
        zoom: coords ? 16 : 12,
        disableDefaultUI: true,
        clickableIcons: false,
      });
      mapRef.current = map;

      const marker = new g.maps.Marker({
        map,
        position: center,
        draggable: true,
      });
      markerRef.current = marker;

      geocoderRef.current = new g.maps.Geocoder();

      dragEndListener = marker.addListener('dragend', async () => {
        const pos = marker.getPosition()?.toJSON();
        if (!pos) return;
        await movePin(pos, true);
      });

      clickListener = map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        const p = { lat: e.latLng.lat(), lng: e.latLng.lng() };
        movePin(p, true);
      });

      if (inputEl.current) {
        const ac = new g.maps.places.Autocomplete(inputEl.current, {
          fields: ['formatted_address', 'geometry'],
        });
        autocompleteRef.current = ac;
        ac.addListener('place_changed', () => {
          const place = ac.getPlace();
          const p = place?.geometry?.location;
          if (!p) return;
          const np = { lat: p.lat(), lng: p.lng() };
          setInput(place?.formatted_address ?? inputEl.current!.value ?? '');
          movePin(np, false);
        });
      }

      mapReady.current = true;
      if (pendingLoc.current) {
        const run = pendingLoc.current;
        pendingLoc.current = null;
        run();
      }

      // seed existing coords
      if (coords) movePin(coords, false);
    })();

    return () => {
      mounted = false;
      mapReady.current = false;
      if (markerRef.current) {
        google.maps.event.clearInstanceListeners(markerRef.current);
        markerRef.current.setMap(null);
      }
      clickListener?.remove();
      dragEndListener?.remove();
      markerRef.current = null;
      mapRef.current = null;
      autocompleteRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // init once

  // SINGLE-CLICK “Use my location”
  const useMyLocation = useCallback(() => {
    if (busy) return;

    const run = () => {
      setBusy(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          await movePin(p, true);
          setBusy(false);
        },
        (err) => {
          setBusy(false);
          alert(err?.message || 'Could not fetch your location. Please try again.');
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    };

    if (!mapReady.current) {
      pendingLoc.current = run;
      return;
    }
    run();
  }, [busy, movePin]);

  const canConfirm =
    Boolean(input.trim()) &&
    typeof coords?.lat === 'number' &&
    typeof coords?.lng === 'number';

  const handleConfirm = () => {
    if (!canConfirm || !coords) return;
    setGeocode({ addressLine: input.trim(), lat: coords.lat, lng: coords.lng });

    // clear pending live cache (we used it)
    try { sessionStorage.removeItem('bw.pending.liveAddress'); } catch {}

    nav('/onboarding/address/label', { replace: true });
  };

  return (
    <OnboardFrame
      step="addressPick"
      backTo="/onboarding/dob"
      title="Choose your address"
      subtitle="Search or drop a pin, then confirm."
      nextLabel="Confirm address"
      nextDisabled={!canConfirm || busy}
      onNext={handleConfirm}
    >
      <div className="w-full max-w-md mx-auto space-y-3">
        <input
          ref={inputEl}
          className="w-full rounded-xl border px-4 py-2 bg-white"
          placeholder="Start typing an address…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoComplete="off"
        />

        <button
          type="button"
          onClick={useMyLocation}
          disabled={busy}
          className={`w-full px-3 py-2 rounded-xl border ${busy ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {busy ? 'Finding your location…' : 'Use my location'}
        </button>

        <div ref={mapEl} className="h-72 w-full rounded-xl bg-white/50" />
      </div>
    </OnboardFrame>
  );
}
