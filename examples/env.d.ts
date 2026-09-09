interface ImportMetaEnv {
  readonly PROD: boolean;
  readonly MODE: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_APP_RELEASE?: string;
  readonly NUXT_PUBLIC_SENTRY_DSN?: string;
  readonly NUXT_PUBLIC_SENTRY_RELEASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
