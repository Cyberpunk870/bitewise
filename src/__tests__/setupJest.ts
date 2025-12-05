import '@testing-library/jest-dom';

// Shared test helpers for both frontend smoke and DOM-based tests.
beforeEach(() => {
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
});

if (typeof window !== 'undefined') {
  // Minimal mocks for browser APIs used by onboarding + push flows.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      media: query,
      matches: false,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });

  // Avoid crashes when components call scrollTo.
  (window as any).scrollTo = () => {};

  // Geolocation + media mocks for permission screens.
  (navigator as any).geolocation = {
    getCurrentPosition: (cb: any) =>
      cb({ coords: { latitude: 0, longitude: 0 } }),
    watchPosition: () => 1,
    clearWatch: () => {},
  };

  (navigator as any).mediaDevices = {
    getUserMedia: jest.fn().mockResolvedValue({
      getTracks: () => [{ stop: () => {} }],
    }),
  };

  if (!(window as any).requestIdleCallback) {
    (window as any).requestIdleCallback = (cb: any) => window.setTimeout(cb, 1);
  }
  if (!(window as any).cancelIdleCallback) {
    (window as any).cancelIdleCallback = (id: number) => window.clearTimeout(id);
  }

  (window as any).Notification = {
    permission: 'granted',
    requestPermission: () => Promise.resolve('granted'),
  };
}
