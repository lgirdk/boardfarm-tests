/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set to "1" to use the real FastAPI backend instead of the in-browser mocks. */
  readonly VITE_USE_BACKEND?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
