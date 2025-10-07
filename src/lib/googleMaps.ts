// src/lib/googleMaps.ts
import { Loader } from '@googlemaps/js-api-loader';

let loader: Loader | null = null;
let loadPromise: Promise<typeof google> | null = null;

export function loadGoogleMaps(): Promise<typeof google> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error('VITE_GOOGLE_MAPS_API_KEY is missing');

  if (!loader) {
    loader = new Loader({
      apiKey,
      version: 'weekly',
      libraries: ['places'],
    });
  }
  if (!loadPromise) loadPromise = loader.load();
  return loadPromise;
}

