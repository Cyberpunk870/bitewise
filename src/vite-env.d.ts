/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  // Add any other VITE_ variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
