import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	reporter: process.env.CI ? [['github'], ['list']] : 'list',
	use: {
		baseURL: 'http://localhost:4712/crypto-lab-zk-arena/',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
	},
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
	],
	webServer: {
		// `npm run build &&` is load-bearing. `preview` serves whatever is already
		// in dist/, so without it the suite tests the last successful build: a
		// source change appears to have no effect, and — worse — a mutation that
		// breaks the build passes green against the stale bundle, which is how a
		// gate certifies code that no longer compiles. This was hit live while
		// adding the [hidden] test below: the fix was in the stylesheet and the
		// test failed anyway, because dist/ predated it.
		command: 'npm run build && npm run preview -- --port 4712 --strictPort',
		port: 4712,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
});
