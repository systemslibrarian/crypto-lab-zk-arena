import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		// Only Vitest specs live in src/. The e2e/ folder uses Playwright's
		// runner and must not be auto-discovered here.
		include: ['src/**/*.{test,spec}.{ts,tsx,js,mjs}'],
		environment: 'node',
	},
});
