// src/components/Map.tsx
/// <reference types="google.maps" />
import { useEffect, useRef } from 'react';
import { loadGoogleMaps } from '../lib/googleMaps';

type Props = {
  center: google.maps.LatLngLiteral;
  zoom?: number;
  className?: string;
  onReady?: (map: google.maps.Map, g: typeof google) => void;
  onError?: (err: unknown) => void;
};

export default function Map({ center, zoom = 14, className, onReady, onError }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const initialized = useRef(false); // WHY: prevent double-init in dev
  const mapRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    let cancelled = false;

    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !containerRef.current) return;
        // create map once per mount
        mapRef.current = new g.maps.Map(containerRef.current, {
          center,
          zoom,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        onReady?.(mapRef.current, g);
      })
      .catch((err) => {
        console.error('Maps load error:', err);
        onError?.(err);
      });

    return () => {
      // WHY: StrictMode mounts → unmounts → mounts; reset so next mount re-inits
      cancelled = true;
      mapRef.current = null;
      initialized.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // init strictly once per mount

  return <div ref={containerRef} className={className} />;
}
