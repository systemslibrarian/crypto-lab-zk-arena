// ui.ts — zk-SNARK vs zk-STARK head-to-head UI.
import {
	DIMENSIONS,
	SYSTEMS,
	QUESTIONS,
	SHARED,
	MILESTONES,
	type Dimension,
	type Winner,
} from './data.ts';
import { decodeAnswers, encodeAnswers, isAllEmpty } from './hashcodec.ts';
import {
	G,
	P,
	commit as schnorrCommit,
	fiatShamirChallenge,
	fullHex,
	modpow,
	newKeypair,
	randBig,
	respond as schnorrRespond,
	shortHex,
	verify as schnorrVerify,
	Q,
	type Keypair,
	type Proof,
} from './schnorr.ts';
import {
	commitValue,
	forgeOpening,
	runCeremony,
	verifyOpening,
	type Commitment,
	type Crs,
} from './trustedsetup.ts';

function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	className?: string,
	html?: string,
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (html !== undefined) node.innerHTML = html;
	return node;
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

// First-use glossary. Each term is the actual mechanism behind a tradeoff the
// demo compares, so a one-line "why it matters" travels with the definition.
// Rendered as a keyboard-focusable inline term with a hover/focus popover and
// an aria-label so assistive tech reads the full definition.
const GLOSSARY: Record<string, string> = {
	fri: 'FRI (Fast Reed–Solomon IOP of Proximity): a hash-based test that a committed polynomial has low degree. It gives STARKs their transparency (no trusted setup) but makes proofs larger — the source of the STARK size penalty.',
	merkle: 'Merkle authentication path: the list of sibling hashes proving one leaf belongs to a hash tree with a known root. STARK proofs are mostly these paths, which is why their size grows with the computation.',
	pairing: 'Pairing: a special bilinear map on an elliptic curve, e(g^a, g^b) = e(g,g)^{ab}. It lets a SNARK verifier check a relation in a tiny constant-size proof — but pairings break under a quantum computer, so pairing-based SNARKs are not post-quantum.',
	ipa: 'IPA (inner-product argument): a way to prove an inner product relation without a pairing or a trusted setup (used by Halo2, Bulletproofs). It removes the ceremony at the cost of slower, logarithmic-size verification.',
	recursion: 'Recursive composition: a proof that verifies another proof. It lets systems compress an unbounded computation into one small final proof — the trick behind rollups and Plonky2.',
	pcp: 'PCP theorem (1992): proved that any NP statement has a proof you can be convinced of by spot-checking a few random bits. Every modern succinct proof is a practical descendant of this idea.',
	gas: 'Gas: Ethereum charges a fee ("gas") for every byte of data a transaction stores on-chain — roughly 16 gas per byte. A bigger proof costs proportionally more gas to post, which is why proof size directly drives on-chain cost.',
};

function gloss(term: keyof typeof GLOSSARY | string, display: string): string {
	const def = GLOSSARY[term as string];
	if (!def) return escapeHtml(display);
	return `<span class="gloss" tabindex="0" role="note" aria-label="${escapeHtml(def)}">${escapeHtml(display)}<span class="gloss__pop" aria-hidden="true">${escapeHtml(def)}</span></span>`;
}

// Escape a plain-text string, then wrap the FIRST occurrence of each known
// jargon term in a glossary popover. Matching is on the escaped text so we
// never break markup; only whole-word, first-use hits are decorated.
const GLOSS_PATTERNS: { key: keyof typeof GLOSSARY; re: RegExp }[] = [
	{ key: 'fri', re: /\bFRI\b/ },
	{ key: 'merkle', re: /\bMerkle(?: authentication)?(?: paths?)?\b/ },
	{ key: 'pairing', re: /\bpairing(?:-based|s)?\b/i },
	{ key: 'ipa', re: /\binner-product arguments?\b/i },
	{ key: 'recursion', re: /\brecursive(?:ly)?(?: composition)?\b/i },
	{ key: 'pcp', re: /\bprobabilistically checkable proofs\b/i },
];

function glossifyText(raw: string): string {
	let html = escapeHtml(raw);
	for (const { key, re } of GLOSS_PATTERNS) {
		const m = html.match(re);
		if (!m) continue;
		const matched = m[0];
		html = html.replace(
			re,
			`<span class="gloss" tabindex="0" role="note" aria-label="${escapeHtml(GLOSSARY[key])}">${matched}<span class="gloss__pop" aria-hidden="true">${escapeHtml(GLOSSARY[key])}</span></span>`,
		);
	}
	return html;
}

function formatBytes(b: number): string {
	if (b < 1024) return `${b} B`;
	const kb = b / 1024;
	if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
	return `${(kb / 1024).toFixed(2)} MB`;
}

function winnerChip(w: Winner): string {
	if (w === 'snark') return `<span class="vs-chip vs-chip--snark" aria-label="Favours SNARK">SNARK</span>`;
	if (w === 'stark') return `<span class="vs-chip vs-chip--stark" aria-label="Favours STARK">STARK</span>`;
	return `<span class="vs-chip vs-chip--tie" aria-label="Tie">Tie</span>`;
}

function renderHero(): HTMLElement {
	// Fleet cl-hero standard. Rendered as a labeled <section> (a region landmark)
	// rather than a <header> so it does not create a second banner alongside the
	// shared crypto-lab topbar (axe landmark-no-duplicate-banner). The hidden
	// #theme-toggle button stays in the DOM so main.ts's theme wiring keeps
	// working (the shared topbar toggle replaces it visually).
	const hero = el('section', 'cl-hero');
	hero.setAttribute('aria-label', 'zk-Arena overview');
	hero.innerHTML = `
    <button id="theme-toggle" class="theme-toggle" type="button" aria-label="Switch theme" aria-pressed="false">
      <span class="theme-toggle__icon" aria-hidden="true">\u{1F319}</span>
    </button>
    <div class="cl-hero-main">
      <h1 class="cl-hero-title">zk-Arena</h1>
      <p class="cl-hero-sub">zk-SNARK vs zk-STARK · Schnorr Σ-protocol</p>
      <p class="cl-hero-desc">
        Put the two dominant succinct proof families head to head across proof size, trusted
        setup, post-quantum security, and prover cost, then run a live Schnorr sigma-protocol
        that shows how zero-knowledge actually works.
      </p>
    </div>
    <div class="cl-hero-why" role="group" aria-label="Why it matters">
      <span class="cl-hero-why-label">WHY IT MATTERS</span>
      <p class="cl-hero-why-text">
        SNARKs and STARKs sit behind rollups and private ledgers, and the choice locks in
        real costs: a trusted-setup ceremony you must trust forever, on-chain fees that scale
        with proof size, and whether your system survives a future quantum adversary.
      </p>
    </div>
  `;
	return hero;
}

// --- plain-language primer + guided reading path ---------------------------
// The Arena and every card below presuppose four terms. Define them plainly,
// once, up front — so a newcomer meeting SNARKs/STARKs for the first time can
// read the eight-dimension comparison on prepared ground instead of guessing.
function renderPrimer(): HTMLElement {
	const section = el('section', 'lab-section');
	section.setAttribute('aria-labelledby', 'primer-heading');
	section.innerHTML = `
    <div class="section-heading-row">
      <div>
        <p class="section-kicker">Start here</p>
        <h2 id="primer-heading">What even is a SNARK or a STARK?</h2>
        <p class="section-footnote">
          Both are <strong>zero-knowledge succinct proofs</strong>: a way for a <em>prover</em> to
          convince a <em>verifier</em> that some computation was done correctly — revealing nothing
          else and without the verifier re-running the work. A zk-<strong>SNARK</strong> and a
          zk-<strong>STARK</strong> are two different families for building such proofs. Before we
          put them head to head, here are the four words the whole comparison turns on.
        </p>
      </div>
    </div>
    <dl class="primer-grid">
      <div class="primer-term">
        <dt>Proof size</dt>
        <dd>How many bytes the proof takes up. Smaller is cheaper to send and to store — and on a
        blockchain, cheaper to post. SNARK proofs are tiny (hundreds of bytes); STARK proofs are
        far larger (tens to hundreds of KB).</dd>
      </div>
      <div class="primer-term">
        <dt>Prover</dt>
        <dd>The party that <em>builds</em> the proof. Proving is the expensive step: it runs the
        whole computation and does heavy math on top. "Prover time" is how long that takes and how
        well it scales to huge computations.</dd>
      </div>
      <div class="primer-term">
        <dt>Verifier</dt>
        <dd>The party that <em>checks</em> the proof. The whole point of "succinct" is that
        verifying is far cheaper than redoing the computation — often milliseconds regardless of how
        big the original job was.</dd>
      </div>
      <div class="primer-term">
        <dt>Trusted setup</dt>
        <dd>A one-time ceremony some SNARKs need <em>before any proofs exist</em>, which produces
        public parameters from a secret. If that secret (the "toxic waste") is not destroyed, its
        holder can forge proofs of false statements forever. STARKs need no such ceremony — you can
        feel exactly why in the <a href="#setup">Trusted Setup</a> exhibit below.</dd>
      </div>
    </dl>
    <div class="primer-path" role="group" aria-label="Suggested reading order">
      <p class="primer-path__lead">New to this? Follow the exhibits in order:</p>
      <ol class="primer-path__list">
        <li><a href="#arena">Compare the tradeoffs</a> across eight dimensions</li>
        <li><a href="#visualizer">See the size gap</a> drawn to scale</li>
        <li><a href="#protocol"><strong>Run a live zero-knowledge proof</strong></a> — the core idea, hands-on</li>
        <li><a href="#setup">Break a trusted setup</a> yourself with kept toxic waste</li>
        <li><a href="#recommender">Pick the right family</a> for a use case</li>
      </ol>
      <p class="section-footnote primer-path__note">
        The live proof in step 3 is the one section that shows <em>how</em> zero-knowledge actually
        works — everything else compares the two families around it.
      </p>
    </div>
  `;
	return section;
}

// --- dimension explorer ----------------------------------------------------
function renderArena(): HTMLElement {
	const section = el('section', 'lab-section');
	section.setAttribute('aria-labelledby', 'playground-heading');
	section.innerHTML = `
    <div class="section-heading-row">
      <div>
        <p class="section-kicker">Head to head</p>
        <h2 id="playground-heading">The Arena</h2>
        <p class="section-footnote">Select any dimension to see how the two systems compare and who it favours. Use arrow keys to move between dimensions, or press <kbd>1</kbd>–<kbd>${DIMENSIONS.length}</kbd> to jump directly.</p>
      </div>
    </div>
    <div class="arena-grid">
      <div class="dim-list" role="tablist" aria-label="Comparison dimensions" aria-orientation="vertical"></div>
      <div class="dim-detail panel-card" id="dim-panel" role="tabpanel" tabindex="0" aria-live="polite"></div>
    </div>
  `;
	const list = section.querySelector('.dim-list') as HTMLElement;
	const detail = section.querySelector('.dim-detail') as HTMLElement;

	const rows: HTMLButtonElement[] = [];

	function paint(d: Dimension, focus = false): void {
		rows.forEach((r) => {
			const active = r.dataset.id === d.id;
			r.classList.toggle('is-active', active);
			r.setAttribute('aria-selected', active ? 'true' : 'false');
			r.tabIndex = active ? 0 : -1;
			if (active && focus) r.focus();
		});
		detail.setAttribute('aria-labelledby', `tab-${d.id}`);
		detail.innerHTML = `
      <p class="section-kicker">${escapeHtml(d.label)}</p>
      <div class="dim-versus">
        <div class="dim-side dim-side--snark ${d.winner === 'snark' ? 'is-winner' : ''}">
          <p class="dim-side-name">zk-SNARK</p>
          <p class="mono-inline dim-side-val">${escapeHtml(d.snark)}</p>
        </div>
        <div class="dim-vs" aria-hidden="true">vs</div>
        <div class="dim-side dim-side--stark ${d.winner === 'stark' ? 'is-winner' : ''}">
          <p class="dim-side-name">zk-STARK</p>
          <p class="mono-inline dim-side-val">${escapeHtml(d.stark)}</p>
        </div>
      </div>
      <p class="dim-verdict">Generally favours: ${winnerChip(d.winner)}</p>
      <p class="panel-copy">${escapeHtml(d.detail)}</p>
    `;
	}

	DIMENSIONS.forEach((d, i) => {
		const row = el('button', 'dim-row', `<span class="dim-row__label"><span class="dim-row__num" aria-hidden="true">${i + 1}</span>${escapeHtml(d.label)}</span>${winnerChip(d.winner)}`);
		row.type = 'button';
		row.id = `tab-${d.id}`;
		row.setAttribute('role', 'tab');
		row.setAttribute('aria-controls', 'dim-panel');
		row.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
		row.tabIndex = i === 0 ? 0 : -1;
		row.dataset.id = d.id;
		row.dataset.index = String(i);
		row.addEventListener('click', () => paint(d));
		row.addEventListener('keydown', (e) => {
			const idx = Number(row.dataset.index);
			let next = idx;
			if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (idx + 1) % rows.length;
			else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (idx - 1 + rows.length) % rows.length;
			else if (e.key === 'Home') next = 0;
			else if (e.key === 'End') next = rows.length - 1;
			else return;
			e.preventDefault();
			paint(DIMENSIONS[next], true);
		});
		rows.push(row);
		list.appendChild(row);
		if (i === 0) paint(d);
	});

	// expose a global hook so keyboard-shortcut layer can drive it
	(window as unknown as { __arenaJump?: (i: number) => void }).__arenaJump = (i: number) => {
		if (i < 0 || i >= DIMENSIONS.length) return;
		paint(DIMENSIONS[i], true);
	};

	return section;
}

// --- proof-size visualizer -------------------------------------------------
function snarkProofBytes(log2n: number): number {
	// Groth16-ish: ~192 B + small PLONK-ish growth
	return Math.round(192 + 12 * log2n);
}
function starkProofBytes(log2n: number): number {
	// FRI-based: ~40 KB at 2^10, grows polylog with circuit size
	return Math.round(40000 + 6500 * Math.max(0, log2n - 10));
}

function renderProofVisualizer(): HTMLElement {
	const section = el('section', 'lab-section');
	section.setAttribute('aria-labelledby', 'viz-heading');
	section.innerHTML = `
    <div class="section-heading-row">
      <div>
        <p class="section-kicker">Make it visible</p>
        <h2 id="viz-heading">Proof Sizes, To Scale</h2>
        <p class="section-footnote">Every dot is 16 bytes drawn at the same scale across both panels. Slide to change circuit size and watch which proof actually fits on a screen.</p>
      </div>
    </div>
    <div class="viz-controls">
      <label for="viz-circuit" class="viz-control-label">Circuit size</label>
      <input id="viz-circuit" type="range" min="10" max="25" step="1" value="16" />
      <output for="viz-circuit" id="viz-circuit-out" class="viz-circuit-out mono-inline"></output>
    </div>
    <div class="viz-grid">
      <figure class="viz-card viz-card--snark">
        <figcaption class="viz-cap">
          <span class="vs-chip vs-chip--snark">zk-SNARK</span>
          <span class="viz-size mono-inline" id="viz-snark-size"></span>
        </figcaption>
        <div class="viz-canvas-wrap">
          <canvas id="viz-snark" class="viz-canvas" aria-hidden="true"></canvas>
        </div>
        <dl class="viz-stats">
          <div><dt>Verifier</dt><dd class="mono-inline">O(1)</dd></div>
          <div><dt>${gloss('gas', 'On-chain gas')} <span class="viz-stat-unit">@16/byte</span></dt><dd class="mono-inline" id="viz-snark-gas"></dd></div>
        </dl>
      </figure>
      <figure class="viz-card viz-card--stark">
        <figcaption class="viz-cap">
          <span class="vs-chip vs-chip--stark">zk-STARK</span>
          <span class="viz-size mono-inline" id="viz-stark-size"></span>
        </figcaption>
        <div class="viz-canvas-wrap">
          <canvas id="viz-stark" class="viz-canvas" aria-hidden="true"></canvas>
        </div>
        <p class="viz-truncation" id="viz-truncation" hidden></p>
        <dl class="viz-stats">
          <div><dt>Verifier</dt><dd class="mono-inline">O(log² N)</dd></div>
          <div><dt>${gloss('gas', 'On-chain gas')} <span class="viz-stat-unit">@16/byte</span></dt><dd class="mono-inline" id="viz-stark-gas"></dd></div>
        </dl>
      </figure>
    </div>
    <details class="viz-note explanation-details">
      <summary>How these numbers are computed</summary>
      <p>
        Both canvases share a single byte-to-pixel scale (one cell = 16 bytes). The figures are simplified models intended to convey scaling behaviour, not benchmarks:
      </p>
      <ul class="viz-formula-list">
        <li><strong>SNARK</strong>: <code>≈ 192 + 12·log₂N</code> bytes — near-constant, modelled after pairing-based proofs such as <em>Groth16</em> (~128 B) and <em>PLONK</em> (~500 B), where size is dominated by a small number of group elements rather than circuit size.</li>
        <li><strong>STARK</strong>: <code>≈ 40 000 + 6500·(log₂N − 10)</code> bytes — polylogarithmic in circuit size, modelled after <em>FRI</em>-based proofs whose size grows with the number of Merkle authentication paths needed for the FRI low-degree test.</li>
      </ul>
      <p>
        Real proofs vary heavily with the circuit, the field, the security parameter, and any wrapping (e.g. a STARK compressed by a SNARK like Plonky2). Trust the orders of magnitude, not the exact bytes.
      </p>
    </details>
  `;

	const slider = section.querySelector('#viz-circuit') as HTMLInputElement;
	const circuitOut = section.querySelector('#viz-circuit-out') as HTMLOutputElement;
	const snarkSize = section.querySelector('#viz-snark-size') as HTMLElement;
	const starkSize = section.querySelector('#viz-stark-size') as HTMLElement;
	const snarkGas = section.querySelector('#viz-snark-gas') as HTMLElement;
	const starkGas = section.querySelector('#viz-stark-gas') as HTMLElement;
	const snarkCanvas = section.querySelector('#viz-snark') as HTMLCanvasElement;
	const starkCanvas = section.querySelector('#viz-stark') as HTMLCanvasElement;
	const truncationEl = section.querySelector('#viz-truncation') as HTMLElement;

	const CELL = 4; // px per 16-byte cell
	const GAP = 1;
	const BYTES_PER_CELL = 16;
	const SNARK_COLS = 8;
	const STARK_COLS = 60;
	const STARK_MAX_CELLS = STARK_COLS * 70; // cap render at ~67 KB worth of cells

	function paintCanvas(
		canvas: HTMLCanvasElement,
		bytes: number,
		cols: number,
		maxCells: number,
		color: string,
	): { drawnBytes: number; truncated: boolean } {
		const ctx = canvas.getContext('2d');
		if (!ctx) return { drawnBytes: bytes, truncated: false };
		const total = Math.max(1, Math.ceil(bytes / BYTES_PER_CELL));
		const drawn = Math.min(total, maxCells);
		const rows = Math.max(1, Math.ceil(drawn / cols));
		const pxW = cols * (CELL + GAP);
		const pxH = rows * (CELL + GAP);
		const dpr = window.devicePixelRatio || 1;
		canvas.width = Math.round(pxW * dpr);
		canvas.height = Math.round(pxH * dpr);
		canvas.style.width = pxW + 'px';
		canvas.style.height = pxH + 'px';
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, pxW, pxH);
		ctx.fillStyle = color;
		for (let i = 0; i < drawn; i++) {
			const r = Math.floor(i / cols);
			const c = i % cols;
			ctx.fillRect(c * (CELL + GAP), r * (CELL + GAP), CELL, CELL);
		}
		// if truncated, draw a fade overlay on last row to hint at "more"
		if (drawn < total) {
			const lastRowY = (rows - 1) * (CELL + GAP);
			const grad = ctx.createLinearGradient(0, lastRowY, 0, lastRowY + CELL + GAP);
			grad.addColorStop(0, 'rgba(0,0,0,0)');
			grad.addColorStop(1, 'rgba(0,0,0,0.55)');
			ctx.fillStyle = grad;
			ctx.fillRect(0, lastRowY, pxW, CELL + GAP + 2);
		}
		return { drawnBytes: drawn * BYTES_PER_CELL, truncated: drawn < total };
	}

	function readColors(): { snark: string; stark: string } {
		const styles = getComputedStyle(document.documentElement);
		const snark = styles.getPropertyValue('--accent').trim() || '#0a6f96';
		const stark = styles.getPropertyValue('--accent-3').trim() || '#c68b1a';
		return { snark, stark };
	}

	function paint(): void {
		const log2n = Number(slider.value);
		const n = 2 ** log2n;
		circuitOut.innerHTML = `2<sup>${log2n}</sup> = ${n.toLocaleString()} constraints`;
		const sB = snarkProofBytes(log2n);
		const tB = starkProofBytes(log2n);
		snarkSize.textContent = formatBytes(sB);
		starkSize.textContent = formatBytes(tB);
		snarkGas.textContent = '≈ ' + (sB * 16).toLocaleString();
		starkGas.textContent = '≈ ' + (tB * 16).toLocaleString();
		const colors = readColors();
		const snarkDots = Math.max(1, Math.ceil(sB / BYTES_PER_CELL));
		paintCanvas(snarkCanvas, sB, SNARK_COLS, SNARK_COLS * 200, colors.snark);
		const starkPaint = paintCanvas(starkCanvas, tB, STARK_COLS, STARK_MAX_CELLS, colors.stark);
		// Ratio callout: convert the fade-to-truncation into an explicit lesson so
		// the shown grid is never mistaken for the STARK proof's true size.
		if (starkPaint.truncated) {
			truncationEl.hidden = false;
			truncationEl.innerHTML =
				`Showing <strong>${formatBytes(starkPaint.drawnBytes)}</strong> of the full ` +
				`<strong>${formatBytes(tB)}</strong> STARK proof (the fade means "more below"). ` +
				`The entire SNARK proof is the <strong>${snarkDots}</strong> ` +
				`dot${snarkDots === 1 ? '' : 's'} in the other panel — that is the ` +
				`<strong>${Math.round(tB / sB).toLocaleString()}×</strong> size gap, to scale.`;
		} else {
			truncationEl.hidden = false;
			truncationEl.innerHTML =
				`Both grids are complete at the same scale: the STARK proof is ` +
				`<strong>${formatBytes(tB)}</strong> versus the SNARK's <strong>${formatBytes(sB)}</strong> ` +
				`— a <strong>${Math.round(tB / sB).toLocaleString()}×</strong> difference.`;
		}
	}

	slider.addEventListener('input', paint);
	// repaint on theme change so cell colours track the CSS vars
	new MutationObserver(paint).observe(document.documentElement, {
		attributes: true,
		attributeFilter: ['data-theme'],
	});
	// initial paint, deferred to after fonts/css apply
	queueMicrotask(paint);

	return section;
}

// --- live Schnorr ZK protocol ----------------------------------------------
function renderProtocol(): HTMLElement {
	const section = el('section', 'lab-section');
	section.id = 'protocol';
	section.setAttribute('aria-labelledby', 'protocol-heading');

	let keypair: Keypair = newKeypair();
	let r: bigint | null = null;
	let proof: Proof | null = null;
	let progress = 0; // how many steps have been completed (0..4)
	let runEpoch = 0; // bumped on any reset/toggle; in-flight awaits check this
	let mode: 'interactive' | 'fiat-shamir' = 'interactive';
	let honest = true;
	let revealSecret = false;

	section.innerHTML = `
    <div class="section-heading-row">
      <div>
        <p class="section-kicker">Live cryptography</p>
        <h2 id="protocol-heading">Run a Zero-Knowledge Proof</h2>
        <p class="section-footnote">
          Alice proves she knows the secret <code class="proto-code">x</code> behind public
          <code class="proto-code">y = g<sup>x</sup> mod p</code> — without revealing <code class="proto-code">x</code>.
          This is the Schnorr identification protocol: the simplest complete example of the two
          properties every zero-knowledge proof must have — <strong>zero-knowledge</strong> (the
          verifier learns nothing) and <strong>soundness</strong> (you can't fake it). Math runs in
          your browser via <code class="proto-code">BigInt</code> and the Web Crypto API.
        </p>
      </div>
    </div>

    <div class="proto-bridge" role="note">
      <span class="proto-bridge__tag">Read this first</span>
      <p>
        Schnorr is <strong>not</strong> a SNARK. It shows what zero-knowledge and soundness feel
        like, but it is <em>not</em> succinct — the proof is as big as the statement and there is no
        trusted setup. SNARKs and STARKs add <strong>succinctness</strong> on top of this idea using
        machinery Schnorr does not have: <em>arithmetization</em> (turning a program into
        polynomial equations) plus <em>polynomial commitments</em> (pairings and a trusted setup for
        SNARKs; hash-based <span class="gloss" tabindex="0" role="note" aria-label="FRI: Fast Reed–Solomon Interactive Oracle Proof of Proximity — a hash-based low-degree test that lets STARKs prove a committed polynomial has low degree without a trusted setup. It is why STARK proofs are larger but need no ceremony.">FRI<span class="gloss__pop">FRI — a hash-based low-degree test that gives STARKs their transparency (no trusted setup), at the cost of larger proofs.</span></span> for STARKs). Use this panel to learn the
        <em>idea</em>; use the exhibits above and below to learn what makes it <em>succinct</em>.
      </p>
    </div>

    <div class="proto-mode-row" role="group" aria-label="Protocol controls">
      <div class="proto-toggle" role="radiogroup" aria-label="Mode">
        <button class="proto-toggle__btn is-active" type="button" role="radio" aria-checked="true" data-mode="interactive">Interactive (3 messages)</button>
        <button class="proto-toggle__btn" type="button" role="radio" aria-checked="false" data-mode="fiat-shamir">Fiat–Shamir (non-interactive)</button>
      </div>
      <div class="proto-toggle" role="radiogroup" aria-label="Prover honesty">
        <button class="proto-toggle__btn is-active" type="button" role="radio" aria-checked="true" data-honest="true">Honest prover</button>
        <button class="proto-toggle__btn" type="button" role="radio" aria-checked="false" data-honest="false">Forged proof</button>
      </div>
      <button id="proto-reset" type="button" class="ghost-button proto-reset">New keypair</button>
    </div>

    <div class="proto-params panel-card">
      <h3 class="proto-h3">Public parameters &amp; keys</h3>
      <dl class="proto-kv">
        <div><dt>Generator <code>g</code></dt><dd class="mono-inline" title="${fullHex(G)}">${shortHex(G)}</dd></div>
        <div><dt>Prime <code>p</code> (256-bit)</dt><dd class="mono-inline" title="${fullHex(P)}">${shortHex(P)}</dd></div>
        <div><dt>Public key <code>y = g<sup>x</sup> mod p</code></dt><dd class="mono-inline" id="proto-y" title=""></dd></div>
        <div class="proto-secret-row">
          <dt>Secret <code>x</code> <button type="button" class="proto-eye" id="proto-eye" aria-pressed="false">show</button></dt>
          <dd class="mono-inline" id="proto-x"></dd>
        </div>
      </dl>
    </div>

    <ol class="proto-steps" aria-label="Protocol transcript">
      <li class="proto-step" data-step="1">
        <div class="proto-step__head">
          <span class="proto-step__num">1</span>
          <div>
            <h3 class="proto-h3">Commit</h3>
            <p class="proto-step__sub">Alice picks random <code>r</code> and sends <code>t = g<sup>r</sup> mod p</code>.</p>
          </div>
          <button type="button" class="action-button proto-go" data-go="1">Run</button>
        </div>
        <div class="proto-step__body">
          <p class="proto-empty">— waiting —</p>
        </div>
      </li>
      <li class="proto-step" data-step="2">
        <div class="proto-step__head">
          <span class="proto-step__num">2</span>
          <div>
            <h3 class="proto-h3">Challenge</h3>
            <p class="proto-step__sub" id="proto-ch-sub">Bob picks a random challenge <code>c</code>.</p>
          </div>
          <button type="button" class="action-button proto-go" data-go="2" disabled>Run</button>
        </div>
        <div class="proto-step__body">
          <p class="proto-empty">— waiting —</p>
        </div>
      </li>
      <li class="proto-step" data-step="3">
        <div class="proto-step__head">
          <span class="proto-step__num">3</span>
          <div>
            <h3 class="proto-h3">Respond</h3>
            <p class="proto-step__sub">Alice sends <code>s = r + c·x mod q</code>.</p>
          </div>
          <button type="button" class="action-button proto-go" data-go="3" disabled>Run</button>
        </div>
        <div class="proto-step__body">
          <p class="proto-empty">— waiting —</p>
        </div>
      </li>
      <li class="proto-step" data-step="4">
        <div class="proto-step__head">
          <span class="proto-step__num">4</span>
          <div>
            <h3 class="proto-h3">Verify</h3>
            <p class="proto-step__sub">Bob checks <code>g<sup>s</sup> ?= t · y<sup>c</sup> mod p</code>.</p>
          </div>
          <button type="button" class="action-button proto-go" data-go="4" disabled>Run</button>
        </div>
        <div class="proto-step__body">
          <p class="proto-empty">— waiting —</p>
        </div>
      </li>
    </ol>

    <div id="proto-verdict" class="proto-verdict" hidden></div>

    <details class="explanation-details proto-why-zk">
      <summary>Why is this zero-knowledge?</summary>
      <p>
        Bob ends up convinced Alice knows <code>x</code>, yet he learns nothing about <code>x</code>. Why?
        Because <strong>anyone</strong> could have produced a transcript indistinguishable from the real one — provided they got to pick <code>c</code> <em>before</em> committing to <code>t</code>:
      </p>
      <ol class="proto-sim-list">
        <li>Pick a random challenge <code>c</code> and response <code>s</code>.</li>
        <li>Compute <code>t = g<sup>s</sup> · y<sup>−c</sup> mod p</code>.</li>
        <li>Output <code>(t, c, s)</code>. By construction <code>g<sup>s</sup> = t · y<sup>c</sup></code>, so verification accepts.</li>
      </ol>
      <p>
        Bob's view of an honest run is statistically identical to this simulator's output — so anything he could compute from the real transcript he could already compute on his own. The protocol leaks zero bits about <code>x</code>.
      </p>
      <p>
        The reason it's still sound is the order: when <code>t</code> is committed <em>first</em>, the simulator's trick stops working. The real prover has to know <code>x</code> to produce a valid <code>s</code> for <em>any</em> challenge Bob then sends.
      </p>
    </details>
  `;

	const yEl = section.querySelector('#proto-y') as HTMLElement;
	const xEl = section.querySelector('#proto-x') as HTMLElement;
	const eyeBtn = section.querySelector('#proto-eye') as HTMLButtonElement;
	const resetBtn = section.querySelector('#proto-reset') as HTMLButtonElement;
	const chSub = section.querySelector('#proto-ch-sub') as HTMLElement;
	const verdict = section.querySelector('#proto-verdict') as HTMLElement;
	const goBtns = section.querySelectorAll<HTMLButtonElement>('.proto-go');
	const steps = section.querySelectorAll<HTMLElement>('.proto-step');

	function paintKeys(): void {
		yEl.textContent = shortHex(keypair.y);
		yEl.title = fullHex(keypair.y);
		xEl.textContent = revealSecret ? shortHex(keypair.x) : '••••••••';
		xEl.title = revealSecret ? fullHex(keypair.x) : 'hidden';
	}

	function setStepState(step: number, body: string, state: 'pending' | 'done' = 'done'): void {
		const li = steps[step - 1];
		const b = li.querySelector('.proto-step__body') as HTMLElement;
		b.innerHTML = body;
		li.classList.toggle('is-done', state === 'done');
		li.classList.toggle('is-pending', state === 'pending');
	}

	function clearFrom(step: number): void {
		for (let i = step; i <= 4; i++) {
			const li = steps[i - 1];
			li.classList.remove('is-done', 'is-pending');
			(li.querySelector('.proto-step__body') as HTMLElement).innerHTML =
				'<p class="proto-empty">— waiting —</p>';
		}
		if (step <= progress) progress = step - 1;
		verdict.hidden = true;
		updateButtons();
	}

	function updateButtons(): void {
		goBtns.forEach((b) => {
			const n = Number(b.dataset.go);
			// step 1 is always available (acts as restart);
			// step N>=2 is enabled iff step N-1 has been completed.
			const enabled = n === 1 ? true : progress >= n - 1;
			b.disabled = !enabled;
		});
	}

	function fullReset(newKey = false): void {
		if (newKey) keypair = newKeypair();
		r = null;
		proof = null;
		progress = 0;
		runEpoch++;
		clearFrom(1);
		paintKeys();
		updateButtons();
	}

	function timing(ms: number): string {
		const formatted = ms < 1 ? ms.toFixed(2) : ms < 10 ? ms.toFixed(2) : ms.toFixed(1);
		return `<span class="proto-timing" title="Time elapsed in this browser"><span class="proto-timing__dot" aria-hidden="true"></span>${formatted} ms</span>`;
	}

	async function runStep(n: number): Promise<void> {
		if (n === 1) {
			clearFrom(2);
			const t0 = performance.now();
			const out = schnorrCommit();
			const dt = performance.now() - t0;
			r = out.r;
			proof = { t: out.t, c: 0n, s: 0n };
			progress = 1;
			setStepState(
				1,
				`<dl class="proto-kv">
          <div><dt><code>r</code> (secret)</dt><dd class="mono-inline" title="${fullHex(r)}">${shortHex(r)}</dd></div>
          <div><dt><code>t = g<sup>r</sup> mod p</code></dt><dd class="mono-inline" title="${fullHex(out.t)}">${shortHex(out.t)}</dd></div>
        </dl><p class="proto-meta">${timing(dt)} — one 256-bit modular exponentiation.</p>`,
			);
		} else if (n === 2) {
			if (proof === null) return;
			clearFrom(3);
			let c: bigint;
			let detail: string;
			const t0 = performance.now();
			const epoch = runEpoch;
			const tSnap = proof.t;
			const ySnap = keypair.y;
			try {
				if (mode === 'fiat-shamir') {
					c = await fiatShamirChallenge(ySnap, tSnap);
					detail = `Fiat–Shamir: <code>c = SHA-256(g ‖ p ‖ y ‖ t) mod q</code>. No live verifier needed.`;
				} else {
					c = (randBig() % (Q - 1n)) + 1n;
					detail = `Interactive: Bob samples a fresh random <code>c</code>.`;
				}
			} catch (err) {
				setStepState(
					2,
					`<p class="proto-note proto-note--warn">⚠ Could not compute challenge: ${escapeHtml(String((err as Error).message ?? err))}</p>`,
				);
				updateButtons();
				return;
			}
			// If state was reset or mode toggled while the await was in flight,
			// drop this stale result rather than corrupt proof state.
			if (epoch !== runEpoch || proof === null) {
				return;
			}
			const dt = performance.now() - t0;
			proof = { ...proof, c };
			progress = 2;
			setStepState(
				2,
				`<dl class="proto-kv">
          <div><dt><code>c</code></dt><dd class="mono-inline" title="${fullHex(c)}">${shortHex(c)}</dd></div>
        </dl><p class="proto-meta">${timing(dt)} — ${detail}</p>`,
			);
		} else if (n === 3) {
			if (proof === null || r === null) return;
			clearFrom(4);
			const effectiveX = honest ? keypair.x : (keypair.x + 1n) % Q;
			const t0 = performance.now();
			const s = schnorrRespond(r, proof.c, effectiveX);
			const dt = performance.now() - t0;
			proof = { ...proof, s };
			progress = 3;
			const warn = honest
				? ''
				: `<p class="proto-note proto-note--warn">⚠ Using a wrong secret (x+1). The forged response will fail verification.</p>`;
			setStepState(
				3,
				`<dl class="proto-kv">
          <div><dt><code>s = r + c·x mod q</code></dt><dd class="mono-inline" title="${fullHex(s)}">${shortHex(s)}</dd></div>
        </dl><p class="proto-meta">${timing(dt)} — one multiply + one add mod q.</p>${warn}`,
			);
		} else if (n === 4) {
			if (proof === null) return;
			const t0 = performance.now();
			const lhs = modpow(G, proof.s, P);
			const rhs = (proof.t * modpow(keypair.y, proof.c, P)) % P;
			const ok = schnorrVerify(keypair.y, proof);
			const dt = performance.now() - t0;
			progress = 4;
			setStepState(
				4,
				`<dl class="proto-kv">
          <div><dt><code>g<sup>s</sup> mod p</code></dt><dd class="mono-inline" title="${fullHex(lhs)}">${shortHex(lhs)}</dd></div>
          <div><dt><code>t · y<sup>c</sup> mod p</code></dt><dd class="mono-inline" title="${fullHex(rhs)}">${shortHex(rhs)}</dd></div>
        </dl><p class="proto-meta">${timing(dt)} — two 256-bit modular exponentiations and a multiply.</p>`,
			);
			verdict.hidden = false;
			verdict.className = 'proto-verdict ' + (ok ? 'is-ok' : 'is-bad');
			verdict.innerHTML = ok
				? `<span class="proto-verdict__mark" aria-hidden="true">✓</span><div><strong>Proof accepted.</strong> Bob is now convinced Alice knows <code>x</code>, having learned nothing about it.</div>`
				: `<span class="proto-verdict__mark" aria-hidden="true">✗</span><div><strong>Proof rejected.</strong> The two sides do not match — Alice cannot have known the real <code>x</code>.</div>`;
		}
		updateButtons();
	}

	// wire mode toggles
	section.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) => {
		b.addEventListener('click', () => {
			mode = b.dataset.mode as 'interactive' | 'fiat-shamir';
			section.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((x) => {
				const on = x === b;
				x.classList.toggle('is-active', on);
				x.setAttribute('aria-checked', on ? 'true' : 'false');
			});
			chSub.innerHTML =
				mode === 'fiat-shamir'
					? `Fiat–Shamir: the challenge becomes <code>c = SHA-256(g ‖ p ‖ y ‖ t)</code> — no live Bob required.`
					: `Bob picks a random challenge <code>c</code>.`;
			if (progress >= 2) progress = 1;
			runEpoch++;
			clearFrom(2);
			if (proof !== null) proof = { ...proof, c: 0n, s: 0n };
			updateButtons();
		});
	});

	section.querySelectorAll<HTMLButtonElement>('[data-honest]').forEach((b) => {
		b.addEventListener('click', () => {
			honest = b.dataset.honest === 'true';
			section.querySelectorAll<HTMLButtonElement>('[data-honest]').forEach((x) => {
				const on = x === b;
				x.classList.toggle('is-active', on);
				x.setAttribute('aria-checked', on ? 'true' : 'false');
			});
			if (progress >= 3) progress = 2;
			runEpoch++;
			clearFrom(3);
			if (proof !== null) proof = { ...proof, s: 0n };
			updateButtons();
		});
	});

	goBtns.forEach((b) => {
		b.addEventListener('click', () => {
			runStep(Number(b.dataset.go));
		});
	});

	eyeBtn.addEventListener('click', () => {
		revealSecret = !revealSecret;
		eyeBtn.setAttribute('aria-pressed', revealSecret ? 'true' : 'false');
		eyeBtn.textContent = revealSecret ? 'hide' : 'show';
		paintKeys();
	});

	resetBtn.addEventListener('click', () => fullReset(true));

	paintKeys();
	updateButtons();

	return section;
}

// --- interactive trusted setup / toxic waste -------------------------------
// Mirrors the Schnorr honest/forged toggle for the ONE pillar concept the
// learner could previously only read about. A real Pedersen-commitment
// ceremony: keep the trapdoor τ and you can equivocate a commitment to a false
// value (an accepting proof for a false statement); destroy it and you can't.
function renderTrustedSetup(): HTMLElement {
	const section = el('section', 'lab-section');
	section.id = 'setup';
	section.setAttribute('aria-labelledby', 'setup-heading');

	let crs: Crs | null = null;
	let destroyed = false; // whether the operator destroyed the toxic waste
	let commitment: Commitment | null = null;
	const TRUE_VALUE = 42n;
	const FALSE_VALUE = 999n;

	section.innerHTML = `
    <div class="section-heading-row">
      <div>
        <p class="section-kicker">Feel the risk</p>
        <h2 id="setup-heading">Break a Trusted Setup</h2>
        <p class="section-footnote">
          A SNARK's trusted setup runs a ceremony that turns a secret <code class="proto-code">τ</code>
          ("tau", the <strong>toxic waste</strong>) into public parameters, then is supposed to
          <em>destroy</em> <code class="proto-code">τ</code>. Here you play the operator. The public
          commitment below hides the value <code class="proto-code">${TRUE_VALUE}</code>. Try to
          convince a verifier it hides <code class="proto-code">${FALSE_VALUE}</code> instead — you
          can only succeed if you kept the waste.
        </p>
        <p class="section-footnote proto-meta">
          Real primitive: a Pedersen commitment <code>C = g<sup>m</sup>·h<sup>s</sup> mod p</code>
          where <code>h = g<sup>τ</sup></code>. Verified in your browser; the same 256-bit group as
          the live proof above.
        </p>
      </div>
    </div>

    <div class="proto-mode-row" role="group" aria-label="Ceremony controls">
      <div class="proto-toggle" role="radiogroup" aria-label="Toxic waste">
        <button class="proto-toggle__btn is-active" type="button" role="radio" aria-checked="true" data-waste="destroy">Destroy τ (honest)</button>
        <button class="proto-toggle__btn" type="button" role="radio" aria-checked="false" data-waste="keep">Keep τ (malicious)</button>
      </div>
      <button id="setup-reset" type="button" class="ghost-button proto-reset">New ceremony</button>
    </div>

    <ol class="proto-steps" aria-label="Trusted-setup transcript">
      <li class="proto-step" data-step="1">
        <div class="proto-step__head">
          <span class="proto-step__num">1</span>
          <div>
            <h3 class="proto-h3">Run the ceremony</h3>
            <p class="proto-step__sub">Sample secret <code>τ</code>, publish CRS <code>h = g<sup>τ</sup> mod p</code>, then destroy or keep <code>τ</code>.</p>
          </div>
          <button type="button" class="action-button proto-go" data-setup-go="1">Run</button>
        </div>
        <div class="proto-step__body"><p class="proto-empty">— waiting —</p></div>
      </li>
      <li class="proto-step" data-step="2">
        <div class="proto-step__head">
          <span class="proto-step__num">2</span>
          <div>
            <h3 class="proto-h3">Publish a commitment</h3>
            <p class="proto-step__sub">Commit to the true value <code>${TRUE_VALUE}</code>: <code>C = g<sup>${TRUE_VALUE}</sup>·h<sup>s</sup> mod p</code>.</p>
          </div>
          <button type="button" class="action-button proto-go" data-setup-go="2" disabled>Run</button>
        </div>
        <div class="proto-step__body"><p class="proto-empty">— waiting —</p></div>
      </li>
      <li class="proto-step" data-step="3">
        <div class="proto-step__head">
          <span class="proto-step__num">3</span>
          <div>
            <h3 class="proto-h3">Forge a false opening</h3>
            <p class="proto-step__sub">Claim the same <code>C</code> opens to <code>${FALSE_VALUE}</code>, using <code>τ</code> to back-solve the randomness <code>s′</code>.</p>
          </div>
          <button type="button" class="action-button proto-go" data-setup-go="3" disabled>Run</button>
        </div>
        <div class="proto-step__body"><p class="proto-empty">— waiting —</p></div>
      </li>
      <li class="proto-step" data-step="4">
        <div class="proto-step__head">
          <span class="proto-step__num">4</span>
          <div>
            <h3 class="proto-h3">Verify the false claim</h3>
            <p class="proto-step__sub">The verifier checks <code>C ?= g<sup>${FALSE_VALUE}</sup>·h<sup>s′</sup> mod p</code> using only the public CRS.</p>
          </div>
          <button type="button" class="action-button proto-go" data-setup-go="4" disabled>Run</button>
        </div>
        <div class="proto-step__body"><p class="proto-empty">— waiting —</p></div>
      </li>
    </ol>

    <div id="setup-verdict" class="proto-verdict" hidden></div>

    <details class="explanation-details proto-why-zk">
      <summary>Why does keeping τ let you forge — and destroying it stop you?</summary>
      <p>
        The commitment <code>C = g<sup>m</sup>·h<sup>s</sup></code> is <em>binding</em> only because
        nobody knows <code>τ = log<sub>g</sub> h</code>. If you do know <code>τ</code>, then for any
        target <code>m′</code> you can solve <code>s′ = s + (m − m′)·τ<sup>−1</sup> mod q</code>, and
        <code>g<sup>m′</sup>·h<sup>s′</sup></code> collapses back to the exact same <code>C</code> —
        so the verifier accepts a value that was never committed.
      </p>
      <p>
        Destroy <code>τ</code> and that back-solve is impossible: recovering it means computing a
        discrete logarithm, which is infeasible. That is the entire security argument behind a
        trusted setup — and exactly why an undestroyed ceremony is a permanent backdoor. STARKs sidestep
        this by having <strong>no secret to destroy</strong> in the first place.
      </p>
    </details>
  `;

	const wasteBtns = section.querySelectorAll<HTMLButtonElement>('[data-waste]');
	const goBtns = section.querySelectorAll<HTMLButtonElement>('.proto-go');
	const steps = section.querySelectorAll<HTMLElement>('.proto-step');
	const verdict = section.querySelector('#setup-verdict') as HTMLElement;
	const resetBtn = section.querySelector('#setup-reset') as HTMLButtonElement;

	let progress = 0;

	function setBody(step: number, html: string): void {
		const li = steps[step - 1];
		(li.querySelector('.proto-step__body') as HTMLElement).innerHTML = html;
		li.classList.add('is-done');
	}

	function clearFrom(step: number): void {
		for (let i = step; i <= 4; i++) {
			steps[i - 1].classList.remove('is-done');
			(steps[i - 1].querySelector('.proto-step__body') as HTMLElement).innerHTML =
				'<p class="proto-empty">— waiting —</p>';
		}
		if (step <= progress) progress = step - 1;
		verdict.hidden = true;
		updateButtons();
	}

	function updateButtons(): void {
		goBtns.forEach((b) => {
			const n = Number(b.dataset.setupGo);
			b.disabled = n === 1 ? false : progress < n - 1;
		});
	}

	function fullReset(): void {
		crs = null;
		commitment = null;
		progress = 0;
		clearFrom(1);
		updateButtons();
	}

	function runStep(n: number): void {
		if (n === 1) {
			clearFrom(2);
			crs = runCeremony();
			commitment = null;
			progress = 1;
			const wasteLine = destroyed
				? `<p class="proto-note">✓ <code>τ</code> destroyed. Only the public CRS <code>h</code> survives.</p>`
				: `<p class="proto-note proto-note--warn">⚠ <code>τ</code> kept. The operator now holds a permanent backdoor.</p>`;
			setBody(
				1,
				`<dl class="proto-kv">
          <div><dt><code>τ</code> (toxic waste)</dt><dd class="mono-inline" title="${fullHex(crs.tau)}">${destroyed ? '•••••••• (destroyed)' : shortHex(crs.tau)}</dd></div>
          <div><dt><code>h = g<sup>τ</sup> mod p</code></dt><dd class="mono-inline" title="${fullHex(crs.h)}">${shortHex(crs.h)}</dd></div>
        </dl>${wasteLine}`,
			);
		} else if (n === 2) {
			if (!crs) return;
			clearFrom(3);
			commitment = commitValue(crs.h, TRUE_VALUE);
			progress = 2;
			setBody(
				2,
				`<dl class="proto-kv">
          <div><dt>value <code>m</code></dt><dd class="mono-inline">${TRUE_VALUE}</dd></div>
          <div><dt>randomness <code>s</code></dt><dd class="mono-inline" title="${fullHex(commitment.s)}">${shortHex(commitment.s)}</dd></div>
          <div><dt>commitment <code>C</code></dt><dd class="mono-inline" title="${fullHex(commitment.c)}">${shortHex(commitment.c)}</dd></div>
        </dl><p class="proto-meta">This <code>C</code> is the public statement. The verifier will only ever see <code>C</code> and the CRS.</p>`,
			);
		} else if (n === 3) {
			if (!crs || !commitment) return;
			clearFrom(4);
			progress = 3;
			if (destroyed) {
				setBody(
					3,
					`<p class="proto-note proto-note--warn">⚠ <code>τ</code> was destroyed, so <code>s′ = s + (m − m′)·τ<sup>−1</sup></code> cannot be computed. The best you can do is guess randomness for <code>${FALSE_VALUE}</code> — which will not match <code>C</code>.</p>`,
				);
			} else {
				const forgedS = forgeOpening(crs.tau, commitment.m, commitment.s, FALSE_VALUE);
				(commitment as Commitment & { forgedS?: bigint }).forgedS = forgedS;
				setBody(
					3,
					`<dl class="proto-kv">
            <div><dt>claimed <code>m′</code></dt><dd class="mono-inline">${FALSE_VALUE}</dd></div>
            <div><dt>forged <code>s′</code></dt><dd class="mono-inline" title="${fullHex(forgedS)}">${shortHex(forgedS)}</dd></div>
          </dl><p class="proto-meta">Back-solved from <code>τ</code> so that <code>g<sup>${FALSE_VALUE}</sup>·h<sup>s′</sup></code> lands on the exact same <code>C</code>.</p>`,
				);
			}
		} else if (n === 4) {
			if (!crs || !commitment) return;
			progress = 4;
			let sTried: bigint;
			if (destroyed) {
				// No trapdoor: attacker can only guess. Model that as a wrong s; it fails.
				sTried = (commitment.s + 1n) % Q;
			} else {
				sTried = (commitment as Commitment & { forgedS?: bigint }).forgedS ?? commitment.s;
			}
			const accepted = verifyOpening(crs.h, commitment.c, FALSE_VALUE, sTried);
			setBody(
				4,
				`<dl class="proto-kv">
          <div><dt><code>C</code></dt><dd class="mono-inline" title="${fullHex(commitment.c)}">${shortHex(commitment.c)}</dd></div>
          <div><dt><code>g<sup>${FALSE_VALUE}</sup>·h<sup>s${destroyed ? '?' : '′'}</sup> mod p</code></dt><dd class="mono-inline" title="${fullHex((modpow(G, FALSE_VALUE, P) * modpow(crs.h, sTried, P)) % P)}">${shortHex((modpow(G, FALSE_VALUE, P) * modpow(crs.h, sTried, P)) % P)}</dd></div>
        </dl>`,
			);
			verdict.hidden = false;
			verdict.className = 'proto-verdict ' + (accepted ? 'is-bad' : 'is-ok');
			verdict.innerHTML = accepted
				? `<span class="proto-verdict__mark" aria-hidden="true">✗</span><div><strong>False claim ACCEPTED.</strong> The verifier believes <code>C</code> opens to <code>${FALSE_VALUE}</code>. Kept toxic waste just forged a proof of a false statement — this is the trusted-setup backdoor.</div>`
				: `<span class="proto-verdict__mark" aria-hidden="true">✓</span><div><strong>False claim rejected.</strong> With <code>τ</code> destroyed the numbers don't match, so <code>C</code> stays bound to its true value. This is what an honest ceremony buys you.</div>`;
		}
		updateButtons();
	}

	wasteBtns.forEach((b) => {
		b.addEventListener('click', () => {
			destroyed = b.dataset.waste === 'destroy';
			wasteBtns.forEach((x) => {
				const on = x === b;
				x.classList.toggle('is-active', on);
				x.setAttribute('aria-checked', on ? 'true' : 'false');
			});
			// changing the waste decision invalidates the ceremony from step 1
			fullReset();
		});
	});

	goBtns.forEach((b) => {
		b.addEventListener('click', () => runStep(Number(b.dataset.setupGo)));
	});

	resetBtn.addEventListener('click', fullReset);

	updateButtons();
	return section;
}

// --- use-case recommender --------------------------------------------------

function readHashAnswers(): Record<string, number> {
	const m = location.hash.match(/[#&]q=([0-9.]+)/i);
	if (!m) return {};
	return decodeAnswers(QUESTIONS, m[1]);
}

function writeHashAnswers(answers: Record<string, number>): void {
	const compact = encodeAnswers(QUESTIONS, answers);
	const url = isAllEmpty(compact)
		? location.pathname + location.search
		: location.pathname + location.search + '#q=' + compact;
	try {
		history.replaceState(null, '', url);
	} catch {
		// non-fatal
	}
}

function renderRecommender(): HTMLElement {
	const section = el('section', 'lab-section');
	section.setAttribute('aria-labelledby', 'recommender-heading');
	section.innerHTML = `
    <div class="section-heading-row">
      <div>
        <p class="section-kicker">Recommender</p>
        <h2 id="recommender-heading">Pick Your Use Case</h2>
        <p class="section-footnote">Answer a few questions and the arena will score a recommendation. Your answers are saved in the URL — copy the link to share your result.</p>
      </div>
    </div>
    <div class="quiz" role="form" aria-labelledby="recommender-heading"></div>
    <div class="quiz-result" id="quiz-result" role="status" aria-live="polite" hidden></div>
    <div class="quiz-actions">
      <button id="quiz-reset" class="ghost-button" type="button">Reset answers</button>
      <button id="quiz-share" class="ghost-button" type="button" hidden>
        <span class="quiz-share__icon" aria-hidden="true">🔗</span>
        <span class="quiz-share__label">Copy share link</span>
      </button>
    </div>
  `;
	const quiz = section.querySelector('.quiz') as HTMLElement;
	const result = section.querySelector('#quiz-result') as HTMLElement;
	const resetBtn = section.querySelector('#quiz-reset') as HTMLButtonElement;
	const shareBtn = section.querySelector('#quiz-share') as HTMLButtonElement;
	const shareLabel = shareBtn.querySelector('.quiz-share__label') as HTMLElement;

	const answers: Record<string, number> = readHashAnswers();

	function score(): void {
		const totals = { snark: 0, stark: 0 };
		let answered = 0;
		for (const q of QUESTIONS) {
			const idx = answers[q.id];
			if (idx === undefined) continue;
			answered++;
			totals.snark += q.options[idx].weight.snark;
			totals.stark += q.options[idx].weight.stark;
		}
		shareBtn.hidden = answered === 0;
		if (answered === 0) {
			result.hidden = true;
			return;
		}
		result.hidden = false;
		const sum = totals.snark + totals.stark || 1;
		const snarkPct = Math.round((totals.snark / sum) * 100);
		const starkPct = 100 - snarkPct;
		const lead =
			totals.snark === totals.stark
				? 'tie'
				: totals.snark > totals.stark
					? 'snark'
					: 'stark';
		const verdict =
			lead === 'tie'
				? 'It’s a genuine toss-up — your needs pull both ways. Re-weight by what matters most.'
				: lead === 'snark'
					? 'Your priorities point toward a <strong>zk-SNARK</strong> — small proofs and mature tooling outweigh the setup and quantum tradeoffs for you.'
					: 'Your priorities point toward a <strong>zk-STARK</strong> — transparency, post-quantum security, or scale matter more than proof size for you.';
		result.innerHTML = `
      <p class="sr-only">Current recommendation: ${snarkPct}% SNARK, ${starkPct}% STARK.</p>
      <div class="result-bar" role="img" aria-label="Recommendation balance: ${snarkPct}% SNARK, ${starkPct}% STARK">
        <div class="result-fill result-fill--snark" style="width:${snarkPct}%"><span class="result-fill__label">SNARK ${snarkPct}%</span></div>
        <div class="result-fill result-fill--stark" style="width:${starkPct}%"><span class="result-fill__label">STARK ${starkPct}%</span></div>
      </div>
      <p class="result-verdict">${verdict}</p>
      <p class="section-footnote">${answered} of ${QUESTIONS.length} questions answered.</p>
    `;
	}

	QUESTIONS.forEach((q, qi) => {
		const card = el('fieldset', 'quiz-card');
		card.setAttribute('role', 'radiogroup');
		const promptId = `qprompt-${q.id}`;
		card.setAttribute('aria-labelledby', promptId);
		const opts = q.options
			.map(
				(o, i) =>
					`<button class="quiz-opt" type="button" role="radio" aria-checked="false" tabindex="${i === 0 ? 0 : -1}" data-q="${q.id}" data-i="${i}">${escapeHtml(o.label)}</button>`,
			)
			.join('');
		card.innerHTML = `
      <legend class="quiz-legend"><span class="quiz-num" aria-hidden="true">${qi + 1}.</span> <span id="${promptId}" class="quiz-prompt-text">${escapeHtml(q.prompt)}</span></legend>
      <div class="quiz-opts">${opts}</div>
    `;
		quiz.appendChild(card);
	});

	function paintSelection(qid: string): void {
		const group = quiz.querySelectorAll<HTMLButtonElement>(`.quiz-opt[data-q="${qid}"]`);
		const sel = answers[qid];
		group.forEach((b) => {
			const isSel = sel !== undefined && Number(b.dataset.i) === sel;
			b.classList.toggle('is-selected', isSel);
			b.setAttribute('aria-checked', isSel ? 'true' : 'false');
		});
		// ensure exactly one tab-focusable per group
		const focusables = Array.from(group).filter((b) => b.tabIndex === 0);
		if (sel !== undefined) {
			group.forEach((b) => (b.tabIndex = Number(b.dataset.i) === sel ? 0 : -1));
		} else if (focusables.length === 0) {
			group[0].tabIndex = 0;
		}
	}

	function selectOption(qid: string, idx: number, focus = false): void {
		answers[qid] = idx;
		paintSelection(qid);
		if (focus) {
			const btn = quiz.querySelector<HTMLButtonElement>(
				`.quiz-opt[data-q="${qid}"][data-i="${idx}"]`,
			);
			btn?.focus();
		}
		score();
		writeHashAnswers(answers);
	}

	function resetQuiz(): void {
		for (const k of Object.keys(answers)) delete answers[k];
		quiz.querySelectorAll<HTMLButtonElement>('.quiz-opt').forEach((b) => {
			b.classList.remove('is-selected');
			b.setAttribute('aria-checked', 'false');
			b.tabIndex = Number(b.dataset.i) === 0 ? 0 : -1;
		});
		result.hidden = true;
		shareBtn.hidden = true;
		writeHashAnswers(answers);
	}

	quiz.addEventListener('click', (e) => {
		const btn = (e.target as HTMLElement).closest('.quiz-opt') as HTMLButtonElement | null;
		if (!btn) return;
		selectOption(btn.dataset.q!, Number(btn.dataset.i));
	});

	quiz.addEventListener('keydown', (e) => {
		const btn = (e.target as HTMLElement).closest('.quiz-opt') as HTMLButtonElement | null;
		if (!btn) return;
		const qid = btn.dataset.q!;
		const group = quiz.querySelectorAll<HTMLButtonElement>(`.quiz-opt[data-q="${qid}"]`);
		const idx = Number(btn.dataset.i);
		let next = idx;
		if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % group.length;
		else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + group.length) % group.length;
		else if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			selectOption(qid, idx);
			return;
		} else return;
		e.preventDefault();
		selectOption(qid, next, true);
	});

	resetBtn.addEventListener('click', resetQuiz);
	resetBtn.id = 'quiz-reset';

	shareBtn.addEventListener('click', async () => {
		try {
			await navigator.clipboard.writeText(location.href);
			const prev = shareLabel.textContent;
			shareLabel.textContent = 'Copied!';
			shareBtn.classList.add('is-copied');
			setTimeout(() => {
				shareLabel.textContent = prev;
				shareBtn.classList.remove('is-copied');
			}, 1800);
		} catch {
			shareLabel.textContent = 'Press Ctrl+C to copy URL';
		}
	});

	// restore from hash
	QUESTIONS.forEach((q) => paintSelection(q.id));
	score();

	// expose reset for keyboard layer
	(window as unknown as { __quizReset?: () => void }).__quizReset = resetQuiz;

	return section;
}

// --- systems table ---------------------------------------------------------
function renderSystems(): HTMLElement {
	const section = el('section', 'lab-section');
	section.setAttribute('aria-labelledby', 'systems-heading');
	const cards = SYSTEMS.map(
		(s) => `
    <article class="panel-card">
      <div class="panel-header">
        <h3>${escapeHtml(s.name)}</h3>
        <span class="vs-chip ${s.type === 'SNARK' ? 'vs-chip--snark' : 'vs-chip--stark'}" aria-label="Family: ${s.type}">${s.type}</span>
      </div>
      <dl class="math-summary-grid">
        <div><dt class="hero-metric-label">Setup</dt><dd class="mono-inline">${escapeHtml(s.setup)}</dd></div>
        <div><dt class="hero-metric-label">Post-quantum</dt><dd class="mono-inline">${s.pq === 'plausible' ? 'plausible' : 'no'}</dd></div>
      </dl>
      <p class="panel-copy">${glossifyText(s.note)}</p>
    </article>`,
	).join('');
	section.innerHTML = `
    <div class="section-heading-row">
      <div>
        <p class="section-kicker">In the wild</p>
        <h2 id="systems-heading">Real Systems</h2>
        <p class="section-footnote">The labels blur in practice — some "SNARKs" drop the trusted setup, and STARKs are often wrapped in a SNARK for cheap verification.</p>
      </div>
    </div>
    <div class="playground-grid">${cards}</div>
  `;
	return section;
}

// --- milestones timeline ---------------------------------------------------
function renderTimeline(): HTMLElement {
	const section = el('section', 'lab-section');
	section.setAttribute('aria-labelledby', 'timeline-heading');
	const familyClass = (f: 'SNARK' | 'STARK' | 'Both') =>
		f === 'SNARK' ? 'vs-chip--snark' : f === 'STARK' ? 'vs-chip--stark' : 'vs-chip--tie';
	const cards = MILESTONES.map(
		(m) => `
    <li class="timeline-card">
      <div class="timeline-card__top">
        <time class="timeline-year mono-inline" datetime="${m.year}">${m.year}</time>
        <span class="vs-chip ${familyClass(m.family)}" aria-label="Family: ${m.family}">${m.family}</span>
      </div>
      <h3 class="timeline-title">${escapeHtml(m.title)}</h3>
      <p class="panel-copy">${glossifyText(m.note)}</p>
    </li>`,
	).join('');
	section.innerHTML = `
    <div class="section-heading-row">
      <div>
        <p class="section-kicker">A short history</p>
        <h2 id="timeline-heading">Milestones</h2>
        <p class="section-footnote">A non-exhaustive timeline of moments that shaped what SNARKs and STARKs look like today. Scroll horizontally on touch, or use ← → on desktop.</p>
      </div>
    </div>
    <div class="timeline-scroll" tabindex="0" aria-label="ZK milestones, scrollable">
      <ol class="timeline-rail">${cards}</ol>
    </div>
  `;
	const scroll = section.querySelector('.timeline-scroll') as HTMLElement;
	scroll.addEventListener('keydown', (e) => {
		const step = scroll.clientWidth * 0.8;
		if (e.key === 'ArrowRight') {
			e.preventDefault();
			scroll.scrollBy({ left: step, behavior: 'smooth' });
		} else if (e.key === 'ArrowLeft') {
			e.preventDefault();
			scroll.scrollBy({ left: -step, behavior: 'smooth' });
		}
	});
	return section;
}

// --- shared traits ---------------------------------------------------------
function renderShared(): HTMLElement {
	const section = el('section', 'lab-section');
	section.setAttribute('aria-labelledby', 'shared-heading');
	const items = SHARED.map(
		(s) => `
    <article class="panel-card">
      <h3>${escapeHtml(s.title)}</h3>
      <p class="panel-copy">${escapeHtml(s.body)}</p>
    </article>`,
	).join('');
	section.innerHTML = `
    <div class="section-heading-row">
      <div>
        <p class="section-kicker">Common ground</p>
        <h2 id="shared-heading">What They Share</h2>
      </div>
    </div>
    <div class="reuse-grid">${items}</div>
  `;
	return section;
}

function renderFooter(): HTMLElement {
	const footer = el('footer', 'lab-section site-footer');
	footer.setAttribute('role', 'contentinfo');
	const year = new Date().getFullYear();
	footer.innerHTML = `
    <p class="section-footnote">
      Figures are representative orders of magnitude for typical modern systems; exact numbers
      depend on the circuit, curve, field, and parameters. Educational comparison only.
    </p>
    <p class="footer-meta">
      <a href="https://github.com/systemslibrarian/crypto-lab-zk-arena" rel="noopener" class="footer-link">View source on GitHub</a>
      <span aria-hidden="true"> · </span>
      <button id="open-shortcuts" type="button" class="footer-link footer-link--button">Keyboard shortcuts <kbd>?</kbd></button>
      <span aria-hidden="true"> · </span>
      <span>© ${year} systemslibrarian</span>
    </p>
    <p class="footer-meta">
      Related demos:
      <a href="https://systemslibrarian.github.io/crypto-lab-snark-arena/" rel="noopener" class="footer-link">crypto-lab-snark-arena</a>
      <span aria-hidden="true"> · </span>
      <a href="https://systemslibrarian.github.io/crypto-lab-stark-tower/" rel="noopener" class="footer-link">crypto-lab-stark-tower</a>
      <span aria-hidden="true"> · </span>
      <a href="https://systemslibrarian.github.io/crypto-lab-bulletproofs/" rel="noopener" class="footer-link">crypto-lab-bulletproofs</a>
      <span aria-hidden="true"> · </span>
      <a href="https://systemslibrarian.github.io/crypto-lab-zk-proof-lab/" rel="noopener" class="footer-link">crypto-lab-zk-proof-lab</a>
      <span aria-hidden="true"> · </span>
      <a href="https://systemslibrarian.github.io/crypto-lab-commit-gate/" rel="noopener" class="footer-link">crypto-lab-commit-gate</a>
    </p>
    <p class="scripture">“So whether you eat or drink or whatever you do, do it all for the glory of God.” — 1 Corinthians 10:31</p>
  `;
	return footer;
}

function renderBackToTop(): HTMLElement {
	const btn = el('button', 'back-to-top', '↑');
	btn.type = 'button';
	btn.setAttribute('aria-label', 'Back to top');
	btn.title = 'Back to top';
	btn.hidden = true;
	btn.addEventListener('click', () => {
		window.scrollTo({ top: 0, behavior: 'smooth' });
		const main = document.getElementById('main');
		main?.focus();
	});
	let footerInView = false;
	const onScroll = () => {
		const past = window.scrollY > 600;
		btn.hidden = !past || footerInView;
	};
	window.addEventListener('scroll', onScroll, { passive: true });
	// hide when the footer or near-bottom enters view so it never sits on
	// top of footer links or the final section's action buttons.
	requestAnimationFrame(() => {
		const footer = document.querySelector('footer.site-footer');
		if (!footer) return;
		const io = new IntersectionObserver(
			([entry]) => {
				footerInView = entry.isIntersecting;
				onScroll();
			},
			{ rootMargin: '0px 0px -50px 0px' },
		);
		io.observe(footer);
	});
	return btn;
}

// --- keyboard shortcuts overlay --------------------------------------------
const SHORTCUTS: { key: string; label: string }[] = [
	{ key: '?', label: 'Open this help' },
	{ key: 'Esc', label: 'Close any overlay' },
	{ key: 'T', label: 'Toggle theme' },
	{ key: 'R', label: 'Reset recommender answers' },
	{ key: '1 – 8', label: 'Jump to that Arena dimension' },
	{ key: '←  →', label: 'Within the Arena: previous / next dimension' },
];

function buildShortcutsOverlay(): HTMLElement {
	const overlay = el('div', 'kbd-overlay');
	overlay.id = 'kbd-overlay';
	overlay.setAttribute('role', 'dialog');
	overlay.setAttribute('aria-modal', 'true');
	overlay.setAttribute('aria-labelledby', 'kbd-title');
	overlay.setAttribute('aria-hidden', 'true');
	overlay.hidden = true;
	const rows = SHORTCUTS.map(
		(s) =>
			`<tr><th scope="row"><kbd>${escapeHtml(s.key)}</kbd></th><td>${escapeHtml(s.label)}</td></tr>`,
	).join('');
	overlay.innerHTML = `
    <div class="kbd-backdrop" data-kbd-close></div>
    <div class="kbd-dialog" role="document">
      <div class="kbd-dialog__head">
        <h2 id="kbd-title">Keyboard shortcuts</h2>
        <button type="button" class="kbd-close" aria-label="Close" data-kbd-close>×</button>
      </div>
      <table class="kbd-table"><tbody>${rows}</tbody></table>
      <p class="section-footnote">Shortcuts are ignored while you're typing in an input.</p>
    </div>
  `;
	return overlay;
}

function setupKeyboardLayer(): void {
	const overlay = buildShortcutsOverlay();
	document.body.appendChild(overlay);
	const dialog = overlay.querySelector('.kbd-dialog') as HTMLElement;
	let lastFocused: HTMLElement | null = null;

	function open(): void {
		if (!overlay.hidden) return;
		lastFocused = (document.activeElement as HTMLElement) ?? null;
		overlay.hidden = false;
		overlay.setAttribute('aria-hidden', 'false');
		document.body.classList.add('kbd-open');
		const closeBtn = overlay.querySelector('.kbd-close') as HTMLButtonElement;
		closeBtn.focus();
	}

	function close(): void {
		if (overlay.hidden) return;
		overlay.hidden = true;
		overlay.setAttribute('aria-hidden', 'true');
		document.body.classList.remove('kbd-open');
		lastFocused?.focus?.();
	}

	overlay.addEventListener('click', (e) => {
		if ((e.target as HTMLElement).closest('[data-kbd-close]')) close();
	});

	// trap Tab inside dialog while open
	dialog.addEventListener('keydown', (e) => {
		if (e.key !== 'Tab') return;
		const focusable = dialog.querySelectorAll<HTMLElement>(
			'button, [href], [tabindex]:not([tabindex="-1"])',
		);
		if (focusable.length === 0) return;
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		if (e.shiftKey && document.activeElement === first) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && document.activeElement === last) {
			e.preventDefault();
			first.focus();
		}
	});

	document.addEventListener('keydown', (e) => {
		const target = e.target as HTMLElement;
		const editable =
			target && target.matches('input, textarea, select, [contenteditable="true"]');
		if (e.key === 'Escape') {
			if (!overlay.hidden) {
				e.preventDefault();
				close();
			}
			return;
		}
		if (editable || e.altKey || e.ctrlKey || e.metaKey) return;
		if (e.key === '?' || (e.shiftKey && e.key === '/')) {
			e.preventDefault();
			overlay.hidden ? open() : close();
			return;
		}
		const k = e.key.toLowerCase();
		if (k === 't') {
			(document.getElementById('theme-toggle') as HTMLButtonElement | null)?.click();
		} else if (k === 'r') {
			(window as unknown as { __quizReset?: () => void }).__quizReset?.();
		} else if (/^[1-9]$/.test(e.key)) {
			const idx = parseInt(e.key, 10) - 1;
			(window as unknown as { __arenaJump?: (i: number) => void }).__arenaJump?.(idx);
		}
	});

	document.addEventListener('click', (e) => {
		if ((e.target as HTMLElement).closest('#open-shortcuts')) open();
	});
}

// --- sticky scroll-spy nav -------------------------------------------------
const NAV_ITEMS: { id: string; label: string }[] = [
	{ id: 'primer', label: 'Primer' },
	{ id: 'arena', label: 'Arena' },
	{ id: 'visualizer', label: 'Sizes' },
	{ id: 'protocol', label: 'Live ZK' },
	{ id: 'setup', label: 'Setup' },
	{ id: 'recommender', label: 'Recommend' },
	{ id: 'systems', label: 'Systems' },
	{ id: 'timeline', label: 'Milestones' },
	{ id: 'shared', label: 'Shared' },
];

function renderNav(): HTMLElement {
	const nav = el('nav', 'page-nav');
	nav.setAttribute('aria-label', 'Sections');
	const links = NAV_ITEMS.map(
		(n) =>
			`<a class="page-nav__link" href="#${n.id}" data-target="${n.id}">${n.label}</a>`,
	).join('');
	nav.innerHTML = `<div class="page-nav__inner">${links}</div>`;
	return nav;
}

function setupScrollSpy(): void {
	const links = document.querySelectorAll<HTMLAnchorElement>('.page-nav__link');
	const byId: Record<string, HTMLAnchorElement> = {};
	links.forEach((l) => (byId[l.dataset.target!] = l));
	const sections = NAV_ITEMS.map((n) => document.getElementById(n.id)).filter(
		(x): x is HTMLElement => !!x,
	);
	let active = '';
	const io = new IntersectionObserver(
		(entries) => {
			// pick the entry highest in viewport that is intersecting
			const visible = entries
				.filter((e) => e.isIntersecting)
				.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
			if (visible.length === 0) return;
			const id = visible[0].target.id;
			if (id === active) return;
			active = id;
			links.forEach((l) => l.classList.toggle('is-active', l.dataset.target === id));
		},
		{ rootMargin: '-30% 0px -55% 0px', threshold: 0 },
	);
	sections.forEach((s) => io.observe(s));
}

// --- section entry animations ----------------------------------------------
function setupEntryAnimations(): void {
	const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (prefersReduced) return;
	const sections = document.querySelectorAll<HTMLElement>(
		'main .lab-section, .cl-hero, .site-footer',
	);
	sections.forEach((s) => s.classList.add('is-pre-enter'));
	const io = new IntersectionObserver(
		(entries) => {
			entries.forEach((e) => {
				if (e.isIntersecting) {
					(e.target as HTMLElement).classList.add('is-entered');
					(e.target as HTMLElement).classList.remove('is-pre-enter');
					io.unobserve(e.target);
				}
			});
		},
		{ threshold: 0.05 },
	);
	sections.forEach((s) => io.observe(s));
}

export function mountApp(root: HTMLDivElement): void {
	// Clear the static skeleton from index.html before mounting.
	root.replaceChildren();
	const shell = el('div', 'page-shell');
	const main = el('main');
	main.id = 'main';
	main.setAttribute('tabindex', '-1');

	const primer = renderPrimer();
	primer.id = 'primer';
	const arena = renderArena();
	arena.id = 'arena';
	const viz = renderProofVisualizer();
	viz.id = 'visualizer';
	const protocol = renderProtocol();
	const setup = renderTrustedSetup();
	const recommender = renderRecommender();
	recommender.id = 'recommender';
	const systems = renderSystems();
	systems.id = 'systems';
	const timeline = renderTimeline();
	timeline.id = 'timeline';
	const shared = renderShared();
	shared.id = 'shared';

	main.append(primer, arena, viz, protocol, setup, recommender, systems, timeline, shared);
	shell.append(renderHero(), renderNav(), main, renderFooter());
	root.appendChild(shell);
	root.appendChild(renderBackToTop());
	setupKeyboardLayer();
	requestAnimationFrame(() => {
		setupScrollSpy();
		setupEntryAnimations();
	});
}
