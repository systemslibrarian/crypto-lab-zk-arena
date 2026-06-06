// ui.ts — zk-SNARK vs zk-STARK head-to-head UI.
import {
	DIMENSIONS,
	SYSTEMS,
	QUESTIONS,
	SHARED,
	type Dimension,
	type Winner,
} from './data.ts';

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

function winnerChip(w: Winner): string {
	if (w === 'snark') return `<span class="vs-chip vs-chip--snark">SNARK</span>`;
	if (w === 'stark') return `<span class="vs-chip vs-chip--stark">STARK</span>`;
	return `<span class="vs-chip vs-chip--tie">Tie</span>`;
}

function renderHero(): HTMLElement {
	const hero = el('header', 'hero-panel');
	const snarkWins = DIMENSIONS.filter((d) => d.winner === 'snark').length;
	const starkWins = DIMENSIONS.filter((d) => d.winner === 'stark').length;
	hero.innerHTML = `
    <button id="theme-toggle" class="theme-toggle" type="button" aria-label="Switch theme">\u{1F319}</button>
    <div class="hero-copy">
      <a class="portfolio-badge" href="https://github.com/systemslibrarian?tab=repositories&q=crypto-lab">crypto-lab \u00b7 portfolio</a>
      <p class="eyebrow">Zero-Knowledge</p>
      <h1>zk-Arena</h1>
      <p class="hero-text">
        zk-SNARKs and zk-STARKs both let a prover convince a verifier that a statement is true
        without revealing why \u2014 but they make opposite tradeoffs. This lab puts them head to
        head across proof size, trusted setup, post-quantum security, prover scalability, and
        more, then helps you pick the right one for a given use case.
      </p>
      <details class="why-details">
        <summary>SNARK vs STARK in one line</summary>
        <p>
          SNARKs give tiny proofs but usually need a trusted setup and break under quantum
          attack. STARKs are transparent and plausibly post-quantum, but their proofs are far
          larger. Neither is strictly better \u2014 it depends on what you are optimising for.
        </p>
      </details>
    </div>
    <div class="hero-metric-card">
      <p class="hero-metric-label">Dimension scorecard</p>
      <p class="hero-metric-value">SNARK favoured: ${snarkWins}<br/>STARK favoured: ${starkWins}<br/>Ties: ${DIMENSIONS.length - snarkWins - starkWins}</p>
      <p class="hero-metric-note">Across ${DIMENSIONS.length} practical dimensions \u00b7 "better" depends on your use case</p>
    </div>
  `;
	return hero;
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
        <p class="section-footnote">Select any dimension to see how the two systems compare and who it favours.</p>
      </div>
    </div>
    <div class="arena-grid">
      <div class="dim-list" role="tablist" aria-label="Comparison dimensions"></div>
      <div class="dim-detail panel-card" aria-live="polite"></div>
    </div>
  `;
	const list = section.querySelector('.dim-list') as HTMLElement;
	const detail = section.querySelector('.dim-detail') as HTMLElement;

	function paint(d: Dimension): void {
		list.querySelectorAll('.dim-row').forEach((r) =>
			r.classList.toggle('is-active', (r as HTMLElement).dataset.id === d.id),
		);
		detail.innerHTML = `
      <p class="section-kicker">${d.label}</p>
      <div class="dim-versus">
        <div class="dim-side dim-side--snark ${d.winner === 'snark' ? 'is-winner' : ''}">
          <p class="dim-side-name">zk-SNARK</p>
          <p class="mono-inline dim-side-val">${d.snark}</p>
        </div>
        <div class="dim-vs">vs</div>
        <div class="dim-side dim-side--stark ${d.winner === 'stark' ? 'is-winner' : ''}">
          <p class="dim-side-name">zk-STARK</p>
          <p class="mono-inline dim-side-val">${d.stark}</p>
        </div>
      </div>
      <p class="dim-verdict">Generally favours: ${winnerChip(d.winner)}</p>
      <p class="panel-copy">${d.detail}</p>
    `;
	}

	DIMENSIONS.forEach((d, i) => {
		const row = el('button', 'dim-row', `<span>${d.label}</span>${winnerChip(d.winner)}`);
		row.type = 'button';
		row.setAttribute('role', 'tab');
		row.dataset.id = d.id;
		row.addEventListener('click', () => paint(d));
		list.appendChild(row);
		if (i === 0) paint(d);
	});
	if (list.firstElementChild) list.firstElementChild.classList.add('is-active');

	return section;
}

// --- use-case recommender --------------------------------------------------
function renderRecommender(): HTMLElement {
	const section = el('section', 'lab-section');
	section.innerHTML = `
    <div class="section-heading-row">
      <div>
        <p class="section-kicker">Recommender</p>
        <h2>Pick Your Use Case</h2>
        <p class="section-footnote">Answer a few questions and the arena will score a recommendation. Nothing here is absolute \u2014 it weights the tradeoffs.</p>
      </div>
    </div>
    <div class="quiz"></div>
    <div class="quiz-result" id="quiz-result" hidden></div>
    <div class="quiz-actions">
      <button id="quiz-reset" class="ghost-button" type="button">Reset answers</button>
    </div>
  `;
	const quiz = section.querySelector('.quiz') as HTMLElement;
	const result = section.querySelector('#quiz-result') as HTMLElement;
	const answers: Record<string, number> = {};

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
				? 'It\u2019s a genuine toss-up \u2014 your needs pull both ways. Re-weight by what matters most.'
				: lead === 'snark'
					? 'Your priorities point toward a <strong>zk-SNARK</strong> \u2014 small proofs and mature tooling outweigh the setup and quantum tradeoffs for you.'
					: 'Your priorities point toward a <strong>zk-STARK</strong> \u2014 transparency, post-quantum security, or scale matter more than proof size for you.';
		result.innerHTML = `
      <div class="result-bar">
        <div class="result-fill result-fill--snark" style="width:${snarkPct}%">${snarkPct > 12 ? 'SNARK ' + snarkPct + '%' : ''}</div>
        <div class="result-fill result-fill--stark" style="width:${starkPct}%">${starkPct > 12 ? 'STARK ' + starkPct + '%' : ''}</div>
      </div>
      <p class="result-verdict">${verdict}</p>
      <p class="section-footnote">${answered} of ${QUESTIONS.length} questions answered.</p>
    `;
	}

	QUESTIONS.forEach((q) => {
		const card = el('div', 'quiz-card');
		const opts = q.options
			.map(
				(o, i) =>
					`<button class="quiz-opt" type="button" data-q="${q.id}" data-i="${i}">${o.label}</button>`,
			)
			.join('');
		card.innerHTML = `<p class="quiz-prompt">${q.prompt}</p><div class="quiz-opts">${opts}</div>`;
		quiz.appendChild(card);
	});

	quiz.addEventListener('click', (e) => {
		const btn = (e.target as HTMLElement).closest('.quiz-opt') as HTMLElement | null;
		if (!btn) return;
		const qid = btn.dataset.q!;
		const idx = parseInt(btn.dataset.i!, 10);
		answers[qid] = idx;
		quiz
			.querySelectorAll(`.quiz-opt[data-q="${qid}"]`)
			.forEach((b) => b.classList.toggle('is-selected', b === btn));
		score();
		result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
	});

	(section.querySelector('#quiz-reset') as HTMLElement).addEventListener('click', () => {
		for (const k of Object.keys(answers)) delete answers[k];
		quiz.querySelectorAll('.quiz-opt').forEach((b) => b.classList.remove('is-selected'));
		result.hidden = true;
	});

	return section;
}

// --- systems table ---------------------------------------------------------
function renderSystems(): HTMLElement {
	const section = el('section', 'lab-section');
	const cards = SYSTEMS.map(
		(s) => `
    <div class="panel-card">
      <div class="panel-header">
        <h3>${s.name}</h3>
        <span class="vs-chip ${s.type === 'SNARK' ? 'vs-chip--snark' : 'vs-chip--stark'}">${s.type}</span>
      </div>
      <div class="math-summary-grid">
        <div><p class="hero-metric-label">Setup</p><p class="mono-inline">${s.setup}</p></div>
        <div><p class="hero-metric-label">Post-quantum</p><p class="mono-inline">${s.pq === 'plausible' ? 'plausible' : 'no'}</p></div>
      </div>
      <p class="panel-copy">${s.note}</p>
    </div>`,
	).join('');
	section.innerHTML = `
    <div class="section-heading-row">
      <div>
        <p class="section-kicker">In the wild</p>
        <h2>Real Systems</h2>
        <p class="section-footnote">The labels blur in practice \u2014 some "SNARKs" drop the trusted setup, and STARKs are often wrapped in a SNARK for cheap verification.</p>
      </div>
    </div>
    <div class="playground-grid">${cards}</div>
  `;
	return section;
}

// --- shared traits ---------------------------------------------------------
function renderShared(): HTMLElement {
	const section = el('section', 'lab-section');
	const items = SHARED.map(
		(s) => `
    <div class="panel-card">
      <h3>${s.title}</h3>
      <p class="panel-copy">${s.body}</p>
    </div>`,
	).join('');
	section.innerHTML = `
    <div class="section-heading-row">
      <div>
        <p class="section-kicker">Common ground</p>
        <h2>What They Share</h2>
      </div>
    </div>
    <div class="reuse-grid">${items}</div>
  `;
	return section;
}

function renderFooter(): HTMLElement {
	const footer = el('footer', 'lab-section');
	footer.innerHTML = `
    <p class="section-footnote">
      Figures are representative orders of magnitude for typical modern systems; exact numbers
      depend on the circuit, curve, field, and parameters. Educational comparison only.
    </p>
    <p class="scripture">\u201CSo whether you eat or drink or whatever you do, do it all for the glory of God.\u201D \u2014 1 Corinthians 10:31</p>
  `;
	return footer;
}

export function mountApp(root: HTMLDivElement): void {
	const shell = el('div', 'page-shell');
	shell.append(
		renderHero(),
		renderArena(),
		renderRecommender(),
		renderSystems(),
		renderShared(),
		renderFooter(),
	);
	root.appendChild(shell);
}
