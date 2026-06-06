// hashcodec.ts — serialize / deserialize quiz answers as a compact hash payload.
// Format: one digit per question, '.' for unanswered. Validated against the
// question schema so invalid indices are dropped silently.
import type { UseCase } from './data.ts';

export function encodeAnswers(
	questions: UseCase[],
	answers: Record<string, number>,
): string {
	return questions
		.map((q) => (answers[q.id] !== undefined ? String(answers[q.id]) : '.'))
		.join('');
}

export function decodeAnswers(questions: UseCase[], compact: string): Record<string, number> {
	const out: Record<string, number> = {};
	questions.forEach((q, i) => {
		const ch = compact[i];
		if (!ch || ch === '.') return;
		const idx = Number(ch);
		if (Number.isFinite(idx) && idx >= 0 && idx < q.options.length) out[q.id] = idx;
	});
	return out;
}

export function isAllEmpty(compact: string): boolean {
	for (const ch of compact) if (ch !== '.') return false;
	return true;
}
