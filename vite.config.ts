import { defineConfig } from 'vite';

export default defineConfig({
  base: '/crypto-lab-zk-arena/',
  build: {
    // Single entry, no dynamic imports, no split chunks — nothing in this build
    // ever emits a <link rel="modulepreload">, so Vite's polyfill for browsers
    // that lack it is ~1.2 KB of code that can never run. Turning it off is
    // pure dead-weight removal, not a compatibility trade.
    modulePreload: { polyfill: false },
  },
});
