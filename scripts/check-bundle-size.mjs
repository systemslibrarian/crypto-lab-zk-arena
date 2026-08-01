// scripts/check-bundle-size.mjs — fail CI if the built bundle grows past budget.
// Run after `npm run build`. Sizes are gzipped (the bytes the user actually pays for).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, '..', 'dist');

const BUDGETS = {
	// Raised from 20 KB (which had itself been raised from 16 KB, for the
	// plain-language primer, the first-use glossary, and the interactive
	// trusted-setup exhibit).
	//
	// What forced this raise: the safe-parameter-set feature — src/groups.ts,
	// src/pohlig.ts, and the group toggle + leak lab in src/ui.ts. The lab had
	// been demonstrating zero knowledge in a group whose composite order leaks
	// ~19 bits of the secret from the public key alone; the fix is a second,
	// real parameter set (RFC 3526 MODP Group 14) plus a live Pohlig-Hellman
	// attack that shows the toy group giving those bits up and the safe group
	// refusing to. That put JS at 23.88 KB gz.
	//
	// Cheaper options were looked for first, and mostly weren't there. The one
	// real win was dropping Vite's modulePreload polyfill (see vite.config.ts):
	// dead code in a single-entry build with no dynamic imports, worth
	// 24.15 KB -> 23.88 KB. Beyond that: no dead code (tsc runs with
	// noUnusedLocals), no duplicated strings, every data.ts export reachable,
	// and the 2048-bit prime is already in its most compact auditable form (the
	// RFC's own hex, ~0.3 KB gz). About 0.4 KB gz sits in the leading
	// indentation of the HTML template literals, recoverable only by adding a
	// build-time source rewrite — not worth the correctness surface for 1.6%,
	// and it would not have reached 20 KB anyway.
	//
	// 25 KB leaves ~1.1 KB over the real figure: enough that a copy edit won't
	// redden CI, tight enough that the next exhibit has to come back here and
	// justify itself.
	js: 25 * 1024,
	css: 8 * 1024,
	// Raised from 2 KB: the mandated shared crypto-lab header (self-contained
	// inline styles + markup) is ~2.5 KB gz on its own, so 2 KB is no longer
	// achievable. 6 KB keeps a meaningful ceiling with headroom for content.
	html: 6 * 1024,
};

function fmt(n) {
	return (n / 1024).toFixed(2) + ' KB';
}

function walk(dir) {
	const out = [];
	for (const name of readdirSync(dir)) {
		const p = path.join(dir, name);
		if (statSync(p).isDirectory()) out.push(...walk(p));
		else out.push(p);
	}
	return out;
}

const files = walk(DIST);
const totals = { js: 0, css: 0, html: 0 };
const detail = [];

for (const f of files) {
	const ext = path.extname(f).slice(1);
	if (!(ext in totals)) continue;
	const raw = readFileSync(f);
	const gz = gzipSync(raw).length;
	totals[ext] += gz;
	detail.push({ file: path.relative(DIST, f), ext, raw: raw.length, gz });
}

console.log('Bundle size (gzipped):');
for (const d of detail.sort((a, b) => b.gz - a.gz)) {
	console.log(`  ${d.file.padEnd(38)} ${fmt(d.raw).padStart(10)}  →  gz ${fmt(d.gz).padStart(10)}`);
}
console.log('');

let fail = false;
for (const [ext, budget] of Object.entries(BUDGETS)) {
	const used = totals[ext];
	const pct = ((used / budget) * 100).toFixed(0);
	const status = used > budget ? '❌ FAIL' : '✅ OK   ';
	console.log(`  ${status} ${ext.toUpperCase().padEnd(5)} gz total: ${fmt(used).padStart(10)}  /  budget ${fmt(budget)}  (${pct}%)`);
	if (used > budget) fail = true;
}

if (fail) {
	console.error('\nOne or more bundles exceeded the budget. Tighten or raise the limit deliberately.');
	process.exit(1);
}
console.log('\nAll bundles within budget.');
