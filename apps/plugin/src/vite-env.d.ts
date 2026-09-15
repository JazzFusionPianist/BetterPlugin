/// <reference types="vite/client" />

/** Short commit hash of this build, injected by vite.config.ts. */
declare const __BUILD_ID__: string

/** package.json version — the web bundle's own number; the plug-in's
 *  native build passes its version on the URL (?ver=) and wins. */
declare const __APP_VERSION__: string
