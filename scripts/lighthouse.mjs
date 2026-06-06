// scripts/lighthouse.mjs — one-shot Lighthouse run against a local preview.
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

const URL = process.env.LIGHTHOUSE_URL || 'http://localhost:4179/crypto-lab-zk-arena/';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const chrome = await chromeLauncher.launch({
	chromePath: EDGE,
	chromeFlags: ['--headless=new', '--no-sandbox'],
});

const opts = {
	logLevel: 'error',
	output: 'json',
	onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
	port: chrome.port,
};

console.log(`Auditing ${URL}…`);
const runner = await lighthouse(URL, opts);
try {
	await chrome.kill();
} catch {
	// Windows temp-cleanup race; the run already completed.
}

const c = runner.lhr.categories;
const score = (k) => Math.round(c[k].score * 100);

const out = {
	performance: score('performance'),
	accessibility: score('accessibility'),
	bestPractices: score('best-practices'),
	seo: score('seo'),
	metrics: {
		fcp: Math.round(runner.lhr.audits['first-contentful-paint'].numericValue),
		lcp: Math.round(runner.lhr.audits['largest-contentful-paint'].numericValue),
		cls: Number(runner.lhr.audits['cumulative-layout-shift'].numericValue.toFixed(3)),
		tbt: Math.round(runner.lhr.audits['total-blocking-time'].numericValue),
		speedIndex: Math.round(runner.lhr.audits['speed-index'].numericValue),
	},
};
console.log(JSON.stringify(out, null, 2));
