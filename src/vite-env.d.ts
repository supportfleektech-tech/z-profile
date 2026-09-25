/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO_API_KEY: string;
  readonly VITE_BACKEND_ORIGIN?: string;
  readonly VITE_APP_TITLE?: string;
  readonly VITE_APP_ENV?: 'development' | 'staging' | 'production';
  readonly VITE_DEMO_BANNER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
