/// <reference types="vite/client" />

type ImportMetaEnv = {
  readonly VITE_STACK_URL: string;
  readonly VITE_STORAGE_TOKEN: string;
};

type ImportMeta = {
  readonly env: ImportMetaEnv;
};
