import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
	page.on('pageerror', (e) => {
		throw new Error(`Uncaught page error: ${e.message}`);
	});
	page.on('console', (msg) => {
		if (msg.type() === 'error') {
			throw new Error(`Console error: ${msg.text()}`);
		}
	});
	await page.goto('/', { waitUntil: 'networkidle' });
	await page.waitForSelector('.hero-panel');
});

test('hero renders with scorecard', async ({ page }) => {
	await expect(page.locator('.hero-panel h1')).toHaveText('zk-Arena');
	await expect(page.locator('.hero-metric-card dd').first()).toHaveText(/\d+/);
});

test('Arena tab list is keyboard navigable', async ({ page }) => {
	await page.locator('.dim-row').first().focus();
	await page.keyboard.press('ArrowDown');
	const sel = await page.evaluate(() =>
		Array.from(document.querySelectorAll('.dim-row')).findIndex(
			(b) => b.getAttribute('aria-selected') === 'true',
		),
	);
	expect(sel).toBe(1);
});

test('Number shortcut jumps Arena dimension', async ({ page }) => {
	await page.locator('body').click();
	await page.keyboard.press('5');
	const sel = await page.evaluate(() =>
		Array.from(document.querySelectorAll('.dim-row')).findIndex(
			(b) => b.getAttribute('aria-selected') === 'true',
		),
	);
	expect(sel).toBe(4);
});

test('Visualizer renders both canvases and updates on slider', async ({ page }) => {
	await page.locator('#viz-circuit').fill('20');
	await page.locator('#viz-circuit').dispatchEvent('input');
	const dims = await page.evaluate(() => ({
		snark: { w: document.getElementById('viz-snark').width },
		stark: { w: document.getElementById('viz-stark').width },
	}));
	expect(dims.stark.w).toBeGreaterThan(dims.snark.w * 5);
	await expect(page.locator('#viz-stark-size')).toContainText(/KB|MB/);
});

test('Schnorr protocol completes honest verification', async ({ page }) => {
	for (let n = 1; n <= 4; n++) {
		await page.locator(`.proto-go[data-go="${n}"]`).click();
	}
	await expect(page.locator('.proto-verdict.is-ok')).toBeVisible();
});

test('Forged Schnorr proof is rejected', async ({ page }) => {
	await page.locator('[data-honest="false"]').click();
	for (let n = 1; n <= 4; n++) {
		await page.locator(`.proto-go[data-go="${n}"]`).click();
	}
	await expect(page.locator('.proto-verdict.is-bad')).toBeVisible();
});

test('Fiat-Shamir mode also verifies', async ({ page }) => {
	await page.locator('[data-mode="fiat-shamir"]').click();
	for (let n = 1; n <= 4; n++) {
		await page.locator(`.proto-go[data-go="${n}"]`).click();
	}
	await expect(page.locator('.proto-verdict.is-ok')).toBeVisible();
});

test('Recommender writes answers to URL hash', async ({ page }) => {
	const firstOpts = page.locator('.quiz-opt[data-i="0"]');
	const count = await firstOpts.count();
	for (let i = 0; i < count; i++) {
		await firstOpts.nth(i).click();
	}
	expect(page.url()).toContain('#q=');
});

test('Keyboard shortcut "?" opens the help modal', async ({ page }) => {
	await page.locator('body').click();
	await page.keyboard.press('?');
	await expect(page.locator('#kbd-overlay')).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.locator('#kbd-overlay')).toBeHidden();
});

test('axe-core: 0 violations across whole page', async ({ page }) => {
	const res = await new AxeBuilder({ page })
		.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
		.analyze();
	expect(res.violations, JSON.stringify(res.violations, null, 2)).toEqual([]);
});

test('axe-core: 0 violations in light theme', async ({ page }) => {
	await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
	const res = await new AxeBuilder({ page })
		.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
		.analyze();
	expect(res.violations, JSON.stringify(res.violations, null, 2)).toEqual([]);
});
