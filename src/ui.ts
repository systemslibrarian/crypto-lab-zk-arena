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

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function winnerChip(w: Winner): string {
	if (w === 'snark') return `<span class="vs-chip vs-chip--snark" aria-label="Favours SNARK">SNARK</span>`;
	if (w === 'stark') return `<span class="vs-chip vs-chip--stark" aria-label="Favours STARK">STARK</span>`;
	return `<span class="vs-chip vs-chip--tie" aria-label="Tie">Tie</span>`;
}

function renderHero(): HTMLElement {
	const hero = el('header', 'hero-panel');
	hero.setAttribute('role', 'banner');
	const snarkWins = DIMENSIONS.filter((d) => d.winner === 'snark').length;
	const starkWins = DIMENSIONS.filter((d) => d.winner === 'stark').length;
	const ties = DIMENSIONS.length - snarkWins - starkWins;
	hero.innerHTML = `
    <button id="theme-toggle" class="theme-toggle" type="button" aria-label="Switch theme" aria-pressed="false">
      <span class="theme-toggle__icon" aria-hidden="true">\u{1F319}</span>
    </button>
    <div class="hero-copy">
      <a class="portfolio-badge" href="https://github.com/systemslibrarian?tab=repositories&q=crypto-lab" rel="noopener">
        <span aria-hidden="true">← </span>crypto-lab · portfolio
      </a>
      <p class="eyebrow">Zero-Knowledge</p>
      <h1>zk-Arena</h1>
      <p class="hero-text">
        zk-SNARKs and zk-STARKs both let a prover convince a verifier that a statement is true
        without revealing why — but they make opposite tradeoffs. This lab puts them head to
        head across proof size, trusted setup, post-quantum security, prover scalability, and
        more, then helps you pick the right one for a given use case.
      </p>
      <details class="why-details">
        <summary>SNARK vs STARK in one line</summary>
        <p>
          SNARKs give tiny proofs but usually need a trusted setup and break under quantum
          attack. STARKs are transparent and plausibly post-quantum, but their proofs are far
          larger. Neither is strictly better — it depends on what you are optimising for.
        </p>
      </details>
    </div>
    <aside class="hero-metric-card" aria-label="Dimension scorecard summary">
      <p class="hero-metric-label">Dimension scorecard</p>
      <dl class="hero-metric-list">
        <div><dt>SNARK favoured</dt><dd>${snarkWins}</dd></div>
        <div><dt>STARK favoured</dt><dd>${starkWins}</dd></div>
        <div><dt>Ties</dt><dd>${ties}</dd></div>
      </dl>
      <p class="hero-metric-note">Across ${DIMENSIONS.length} practical dimensions · "better" depends on your use case</p>
    </aside>
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
        <p class="section-footnote">Select any dimension to see how the two systems compare and who it favours. Use arrow keys to move between dimensions.</p>
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
		const row = el('button', 'dim-row', `<span>${escapeHtml(d.label)}</span>${winnerChip(d.winner)}`);
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

	return section;
}

// --- use-case recommender --------------------------------------------------
function renderRecommender(): HTMLElement {
	const section = el('section', 'lab-section');
	section.setAttribute('aria-labelledby', 'recommender-heading');
	section.innerHTML = `
    <div class="section-heading-row">
      <div>
        <p class="section-kicker">Recommender</p>
        <h2 id="recommender-heading">Pick Your Use Case</h2>
        <p class="section-footnote">Answer a few questions and the arena will score a recommendation. Nothing here is absolute — it weights the tradeoffs.</p>
      </div>
    </div>
    <div class="quiz" role="form" aria-labelledby="recommender-heading"></div>
    <div class="quiz-result" id="quiz-result" role="status" aria-live="polite" hidden></div>
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

	function selectOption(qid: string, idx: number, focus = false): void {
		answers[qid] = idx;
		const group = quiz.querySelectorAll<HTMLButtonElement>(`.quiz-opt[data-q="${qid}"]`);
		group.forEach((b) => {
			const isSel = Number(b.dataset.i) === idx;
			b.classList.toggle('is-selected', isSel);
			b.setAttribute('aria-checked', isSel ? 'true' : 'false');
			b.tabIndex = isSel ? 0 : -1;
			if (isSel && focus) b.focus();
		});
		if (!Array.from(group).some((b) => b.tabIndex === 0)) group[0].tabIndex = 0;
		score();
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

	(section.querySelector('#quiz-reset') as HTMLElement).addEventListener('click', () => {
		for (const k of Object.keys(answers)) delete answers[k];
		quiz.querySelectorAll<HTMLButtonElement>('.quiz-opt').forEach((b) => {
			b.classList.remove('is-selected');
			b.setAttribute('aria-checked', 'false');
			b.tabIndex = Number(b.dataset.i) === 0 ? 0 : -1;
		});
		result.hidden = true;
	});

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
      <p class="panel-copy">${escapeHtml(s.note)}</p>
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
      <span>© ${year} systemslibrarian</span>
    </p>
    <p class="scripture">“So whether you eat or drink or whatever you do, do it all for the glory of God.” — 1 Corinthians 10:31</p>
  `;
	return footer;
}

function renderBackToTop(): HTMLElement {
	const btn = el('button', 'back-to-top', '↑ Top');
	btn.type = 'button';
	btn.setAttribute('aria-label', 'Back to top');
	btn.hidden = true;
	btn.addEventListener('click', () => {
		window.scrollTo({ top: 0, behavior: 'smooth' });
		const main = document.getElementById('main');
		main?.focus();
	});
	const onScroll = () => {
		btn.hidden = window.scrollY < 600;
	};
	window.addEventListener('scroll', onScroll, { passive: true });
	return btn;
}

export function mountApp(root: HTMLDivElement): void {
	const shell = el('div', 'page-shell');
	const main = el('main');
	main.id = 'main';
	main.setAttribute('tabindex', '-1');
	main.append(renderArena(), renderRecommender(), renderSystems(), renderShared());
	shell.append(renderHero(), main, renderFooter());
	root.appendChild(shell);
	root.appendChild(renderBackToTop());
}
