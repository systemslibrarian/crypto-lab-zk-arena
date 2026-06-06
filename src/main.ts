import './style.css';
import './extra.css';
import { DIMENSIONS } from './data.ts';
import { mountApp } from './ui.ts';

console.group('crypto-lab-zk-arena: scorecard self-test');
const snark = DIMENSIONS.filter((d) => d.winner === 'snark').map((d) => d.label);
const stark = DIMENSIONS.filter((d) => d.winner === 'stark').map((d) => d.label);
const ties = DIMENSIONS.filter((d) => d.winner === 'tie').map((d) => d.label);
console.log('Dimensions compared:', DIMENSIONS.length);
console.log('SNARK favoured:', snark.join(', '));
console.log('STARK favoured:', stark.join(', '));
console.log('Ties:', ties.join(', ') || 'none');
console.groupEnd();

mountApp(document.querySelector<HTMLDivElement>('#app')!);

(function initThemeToggle() {
	const button = document.getElementById('theme-toggle') as HTMLButtonElement | null;
	if (!button) return;
	const icon = button.querySelector<HTMLSpanElement>('.theme-toggle__icon');
	function apply(theme: string): void {
		document.documentElement.setAttribute('data-theme', theme);
		try {
			localStorage.setItem('theme', theme);
		} catch {
			// storage unavailable (private mode) — non-fatal
		}
		const isDark = theme === 'dark';
		if (icon) icon.textContent = isDark ? '\u{1F319}' : '☀️';
		button!.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
		button!.setAttribute('aria-pressed', isDark ? 'false' : 'true');
	}
	const current = document.documentElement.getAttribute('data-theme') ?? 'dark';
	apply(current);
	button.addEventListener('click', () => {
		const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
		apply(next);
	});
})();
