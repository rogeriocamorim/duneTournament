// The shared engine reads import.meta.env (Vite) in browser-only helpers.
interface ImportMetaEnv {
  readonly [key: string]: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
