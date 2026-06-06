import { describe, expect, it } from 'vitest';
import {
	commit,
	fiatShamirChallenge,
	G,
	modpow,
	newKeypair,
	P,
	Q,
	respond,
	shortHex,
	verify,
} from './schnorr.ts';

describe('modpow', () => {
	it('agrees with native exponentiation for small inputs', () => {
		expect(modpow(2n, 10n, 1000n)).toBe(1024n % 1000n);
		expect(modpow(7n, 0n, 13n)).toBe(1n);
		expect(modpow(5n, 1n, 11n)).toBe(5n);
	});
	it("Fermat's little theorem holds for a small prime", () => {
		const p = 13n;
		for (let a = 1n; a < p; a++) {
			expect(modpow(a, p - 1n, p)).toBe(1n);
		}
	});
	it('throws on negative exponent rather than silently returning 1', () => {
		expect(() => modpow(2n, -1n, 13n)).toThrow(/negative/);
	});
	it('throws on non-positive modulus', () => {
		expect(() => modpow(2n, 5n, 0n)).toThrow(/modulus/);
		expect(() => modpow(2n, 5n, -7n)).toThrow(/modulus/);
	});
	it('handles negative base by normalising into [0, mod)', () => {
		// (-1)^2 mod 7 = 1
		expect(modpow(-1n, 2n, 7n)).toBe(1n);
		// (-3)^3 mod 11 = -27 mod 11 = 6
		expect(modpow(-3n, 3n, 11n)).toBe(6n);
	});
});

describe('Schnorr identification', () => {
	it('verifies an honestly generated interactive proof', () => {
		const { x, y } = newKeypair();
		const { r, t } = commit();
		const c = 12345678901234567890n % Q;
		const s = respond(r, c, x);
		expect(verify(y, { t, c, s })).toBe(true);
	});

	it('rejects a proof made with the wrong secret', () => {
		const { x, y } = newKeypair();
		const { r, t } = commit();
		const c = 999_999_999_999n % Q;
		const wrongX = (x + 1n) % Q;
		const s = respond(r, c, wrongX);
		expect(verify(y, { t, c, s })).toBe(false);
	});

	it('rejects a proof made for a different public key', () => {
		const a = newKeypair();
		const b = newKeypair();
		const { r, t } = commit();
		const c = 42n;
		const s = respond(r, c, a.x);
		expect(verify(b.y, { t, c, s })).toBe(false);
	});

	it('verifies a Fiat–Shamir non-interactive proof', async () => {
		const { x, y } = newKeypair();
		const { r, t } = commit();
		const c = await fiatShamirChallenge(y, t);
		const s = respond(r, c, x);
		expect(verify(y, { t, c, s })).toBe(true);
	});
});

describe('shortHex', () => {
	it('returns full prefix when value is small', () => {
		expect(shortHex(0xabcn)).toBe('0xabc');
	});
	it('truncates large values with ellipsis', () => {
		const s = shortHex(P);
		expect(s.startsWith('0x')).toBe(true);
		expect(s.includes('…')).toBe(true);
	});
});

describe('group parameters', () => {
	it('public key satisfies y = g^x mod p', () => {
		const { x, y } = newKeypair();
		expect(modpow(G, x, P)).toBe(y);
	});
});
