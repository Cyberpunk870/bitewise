const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.bitewise.app';
const FALLBACK_DELAY = 1600;

export function openNativeApp(path: string = '/') {
  if (typeof window === 'undefined') return;
  const schemeUrl = `bitewise://app${path}`;
  const started = Date.now();
  const redirect = () => {
    const delta = Date.now() - started;
    if (delta < FALLBACK_DELAY + 200) {
      window.location.href = PLAY_STORE_URL;
    }
  };

  try {
    window.location.href = schemeUrl;
    setTimeout(redirect, FALLBACK_DELAY);
  } catch {
    window.location.href = PLAY_STORE_URL;
  }
}
