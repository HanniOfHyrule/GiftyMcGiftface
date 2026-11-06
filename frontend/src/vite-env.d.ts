/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Basis-URL der API, Standard: /api (Proxy in Vite-Dev-Server und nginx) */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
