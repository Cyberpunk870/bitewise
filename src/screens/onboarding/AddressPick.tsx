// src/screens/onboarding/AddressPick.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import OnboardFrame from '../../components/OnboardFrame';
import useOnboarding from '../../store/onboarding';
import { setActiveProfileFields } from '../../lib/profileStore';
import { pushActiveToCloud } from '../../lib/cloudProfile';
import { getAuth } from 'firebase/auth';                    // ✅ NEW
import { addAddress as apiAddAddress } from '../../lib/api'; // ✅ NEW

type Coords = { lat: number; lng: number };
type SuggestionEntry = {
  suggestion: google.maps.places.AutocompleteSuggestion;
  prediction: google.maps.places.PlacePrediction;
};

export default function AddressPick() {
  const nav = useNavigate();
  const location = useLocation();
  const {
    addressLine: storedLine,
    lat: storedLat,
    lng: storedLng,
    setGeocode,
    setStep,
  } = useOnboarding();

  // Detect if this address-pick is a “lite” update (from Settings or live updater)
  const params = new URLSearchParams(location.search);
  const fromSettings = params.get('from') === 'settings';
  const liveFlowFlag = sessionStorage.getItem('bw.liveAddress.flow');
  const fromLiveUpdate = liveFlowFlag === 'live';
  const isLiteAddressUpdate = fromSettings && !fromLiveUpdate;

  // Seed from pending live address if present
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

  const [input, setInput] = useState(seedLine);
  const [coords, setCoords] = useState<Coords | null>(seedCoords);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStep('addressPick');
  }, [setStep]);

  // Google refs
  const mapEl = useRef<HTMLDivElement | null>(null);
  const inputEl = useRef<HTMLInputElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const placesLibRef = useRef<google.maps.PlacesLibrary | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const mapsRef = useRef<typeof google | null>(null);
  const mapReady = useRef(false);
  const pendingLoc = useRef<null | (() => void)>(null);
  const [predictions, setPredictions] = useState<SuggestionEntry[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    const lib = placesLibRef.current;
    if (!lib || !input.trim()) {
      setPredictions([]);
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const { AutocompleteSuggestion, AutocompleteSessionToken } = lib;
        if (!AutocompleteSuggestion || !AutocompleteSessionToken) return;
        const token = sessionTokenRef.current || new AutocompleteSessionToken();
        sessionTokenRef.current = token;
        const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input,
          sessionToken: token,
        });
        const entries: SuggestionEntry[] = (suggestions || []).reduce((acc, suggestion) => {
          if (suggestion.placePrediction) {
            acc.push({ suggestion, prediction: suggestion.placePrediction });
          }
          return acc;
        }, [] as SuggestionEntry[]);
        setPredictions(entries);
      } catch (err) {
        console.warn('[places] autocomplete failed', err);
        setPredictions([]);
      }
    }, 220);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [input]);

  const reverseGeocode = useCallback(async (p: Coords) => {
    const { loadGoogleMaps } = await import('../../lib/googleMaps');
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
      if (marker) marker.position = p;
      if (doReverse) {
        setBusy(true);
        const line = (await reverseGeocode(p)) ?? '';
        setInput(line);
        setBusy(false);
      }
    },
    [reverseGeocode]
  );

  const handlePredictionSelect = useCallback(
    async (entry: SuggestionEntry) => {
      const lib = placesLibRef.current;
      if (!lib) return;
      const { Place, AutocompleteSessionToken } = lib;
      if (!Place) return;
      const placeId = entry.prediction.placeId;
      if (!placeId) return;
      try {
        const place = new Place({ id: placeId });
        const { place: fetched } = await place.fetchFields({
          fields: ['location', 'formattedAddress', 'displayName'],
        });
        const loc = fetched.location
          ? fetched.location.toJSON
            ? fetched.location.toJSON()
            : { lat: fetched.location.lat(), lng: fetched.location.lng() }
          : null;
        if (!loc) return;
        const label =
          fetched.formattedAddress ||
          entry.prediction.text?.text ||
          entry.prediction.mainText?.text ||
          '';
        setInput(label);
        await movePin({ lat: loc.lat, lng: loc.lng }, false);
        setPredictions([]);
        setShowPredictions(false);
        if (AutocompleteSessionToken) {
          sessionTokenRef.current = new AutocompleteSessionToken();
        }
      } catch (err) {
        console.warn('[places] fetchFields failed', err);
      }
    },
    [movePin]
  );

  // Init Google Map once
  useEffect(() => {
    let mounted = true;
    let clickListener: google.maps.MapsEventListener | null = null;
    let dragEndListener: google.maps.MapsEventListener | null = null;

    (async () => {
      const { loadGoogleMaps } = await import('../../lib/googleMaps');
      const g = await loadGoogleMaps();
      mapsRef.current = g;
      if (!mounted || !mapEl.current) return;

      const center: Coords = coords ?? { lat: 28.6139, lng: 77.209 };
      const mapOptions: google.maps.MapOptions = {
        center,
        zoom: coords ? 16 : 12,
        disableDefaultUI: true,
        clickableIcons: false,
      };
      const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID;
      if (mapId) (mapOptions as any).mapId = mapId;
      const map = new g.maps.Map(mapEl.current, mapOptions);
      mapRef.current = map;

      const marker = new g.maps.marker.AdvancedMarkerElement({
        map,
        position: center,
        gmpDraggable: true,
      });
      markerRef.current = marker;

      geocoderRef.current = new g.maps.Geocoder();
      const placesLib = (await g.maps.importLibrary('places')) as google.maps.PlacesLibrary;
      placesLibRef.current = placesLib;
      const { AutocompleteSessionToken } = placesLib;
      if (AutocompleteSessionToken) {
        sessionTokenRef.current = new AutocompleteSessionToken();
      }

      dragEndListener = marker.addListener('dragend', async (event: google.maps.MapMouseEvent) => {
        const pos = event.latLng?.toJSON();
        if (!pos) return;
        await movePin(pos, true);
      });

      clickListener = map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        const p = { lat: e.latLng.lat(), lng: e.latLng.lng() };
        movePin(p, true);
      });

      mapReady.current = true;
      if (pendingLoc.current) {
        const run = pendingLoc.current;
        pendingLoc.current = null;
        run();
      }

      if (coords) movePin(coords, false);
    })();

    return () => {
      mounted = false;
      mapReady.current = false;
      if (markerRef.current) {
        google.maps.event.clearInstanceListeners(markerRef.current);
        markerRef.current.map = null;
      }
      clickListener?.remove();
      dragEndListener?.remove();
      markerRef.current = null;
      mapRef.current = null;
      sessionTokenRef.current = null;
      mapsRef.current = null;
      placesLibRef.current = null;
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

  const handleConfirm = async () => {
    if (!canConfirm || !coords) return;

    // Save into onboarding state
    setGeocode({ addressLine: input.trim(), lat: coords.lat, lng: coords.lng });

    // Reflect into local active profile (so UI updates immediately)
    setActiveProfileFields({
      addressLine: input.trim(),
      lat: coords.lat,
      lng: coords.lng,
    });

    // Debounced cloud push (this only upserts name/phone — addresses remain in saved_addresses)
    await pushActiveToCloud();

    try { sessionStorage.removeItem('bw.pending.liveAddress'); } catch {}

    // ✅ If this was a “lite” update (from Settings/live), also persist to backend now
    if (isLiteAddressUpdate) {
      try {
        const uid = getAuth().currentUser?.uid;
        if (uid) {
          await apiAddAddress({
            label: 'Home',               // safe default when skipping label step
            addressLine: input.trim(),
            lat: coords.lat,
            lng: coords.lng,
            active: true,                // make this the active one
          });
        }
      } catch {} // non-blocking
      try { sessionStorage.removeItem('bw.liveAddress.flow'); } catch {}
      nav('/home', { replace: true });
      return;
    }

    if (fromLiveUpdate) {
      try { sessionStorage.setItem('bw.liveAddress.flow', 'label'); } catch {}
      nav('/onboarding/address/label', { replace: true });
      return;
    }

    // Otherwise continue to the standard label step
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
        <div className="relative">
          <input
            ref={inputEl}
            className="w-full rounded-xl border px-4 py-2 bg-white"
            placeholder="Start typing an address…"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setShowPredictions(true);
            }}
            autoComplete="off"
            onFocus={() => setShowPredictions(true)}
            onBlur={() => setTimeout(() => setShowPredictions(false), 150)}
          />
          {showPredictions && predictions.length > 0 && (
            <div className="absolute z-20 mt-1 w-full rounded-xl border border-black/10 bg-white shadow-lg">
              {predictions.map((entry) => {
                const primary =
                  entry.prediction.mainText?.text ||
                  entry.prediction.text?.text ||
                  '';
                const secondary = entry.prediction.secondaryText?.text || '';
                return (
                  <button
                    key={entry.prediction.placeId}
                    type="button"
                    className="w-full text-left px-4 py-2 text-sm hover:bg-black/5"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handlePredictionSelect(entry)}
                  >
                    {primary || 'Unknown place'}
                    {secondary && (
                      <span className="block text-xs text-black/60">{secondary}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
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
