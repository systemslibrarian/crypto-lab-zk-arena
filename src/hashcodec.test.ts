import { describe, expect, it } from 'vitest';
import { QUESTIONS } from './data.ts';
import { decodeAnswers, encodeAnswers, isAllEmpty } from './hashcodec.ts';

describe('hash codec', () => {
	it('round-trips a full answer set', () => {
		const answers: Record<string, number> = {};
		QUESTIONS.forEach((q, i) => (answers[q.id] = i % q.options.length));
		const encoded = encodeAnswers(QUESTIONS, answers);
		expect(encoded).toMatch(/^[0-9]+$/);
		expect(decodeAnswers(QUESTIONS, encoded)).toEqual(answers);
	});

	it('represents missing answers as "."', () => {
		const answers: Record<string, number> = { [QUESTIONS[0].id]: 0 };
		const encoded = encodeAnswers(QUESTIONS, answers);
		expect(encoded[0]).toBe('0');
		expect(encoded.slice(1)).toBe('.'.repeat(QUESTIONS.length - 1));
	});

	it('drops out-of-range indices silently', () => {
		const malformed = '9'.repeat(QUESTIONS.length);
		const decoded = decodeAnswers(QUESTIONS, malformed);
		// every question has fewer than 9 options, so all are dropped
		expect(Object.keys(decoded).length).toBe(0);
	});

	it('isAllEmpty true for all-dot string', () => {
		expect(isAllEmpty('.....')).toBe(true);
		expect(isAllEmpty('.0...')).toBe(false);
		expect(isAllEmpty('')).toBe(true);
	});

	it('drops whitespace, letters, and punctuation rather than coercing them to 0', () => {
		// before the fix, Number(' ') = 0 would have silently selected option 0
		expect(decodeAnswers(QUESTIONS, ' ' + '.'.repeat(QUESTIONS.length - 1))).toEqual({});
		expect(decodeAnswers(QUESTIONS, 'a' + '.'.repeat(QUESTIONS.length - 1))).toEqual({});
		expect(decodeAnswers(QUESTIONS, '+' + '.'.repeat(QUESTIONS.length - 1))).toEqual({});
		expect(decodeAnswers(QUESTIONS, '\t' + '.'.repeat(QUESTIONS.length - 1))).toEqual({});
	});

	it('accepts only single-digit characters as answer indices', () => {
		const answers = decodeAnswers(QUESTIONS, '0' + '.'.repeat(QUESTIONS.length - 1));
		expect(answers).toEqual({ [QUESTIONS[0].id]: 0 });
	});
});
