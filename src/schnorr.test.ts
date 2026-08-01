import { describe, expect, it } from 'vitest';
import {
	commit,
	fiatShamirChallenge,
	G,
	modpow,
	newKeypair,
	P,
	Q,
	randomChallenge,
	respond,
	SAFE_GROUP,
	shortHex,
	TOY_GROUP,
	verify,
} from './schnorr.ts';
import { modInverse } from './pohlig.ts';

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

// The point of having two parameter sets is that the protocol code is the same
// in both. These run the identical sequence against each, so a regression that
// only shows up at one size cannot hide.
describe('same protocol, both parameter sets', () => {
	for (const params of [TOY_GROUP, SAFE_GROUP]) {
		it(`${params.id}: accepts an honest interactive proof`, () => {
			const { x, y } = newKeypair(params);
			const { r, t } = commit(params);
			const c = randomChallenge(params);
			const s = respond(r, c, x, params);
			expect(verify(y, { t, c, s }, params)).toBe(true);
		});

		it(`${params.id}: accepts an honest Fiat–Shamir proof`, async () => {
			const { x, y } = newKeypair(params);
			const { r, t } = commit(params);
			const c = await fiatShamirChallenge(y, t, params);
			const s = respond(r, c, x, params);
			expect(verify(y, { t, c, s }, params)).toBe(true);
		});

		it(`${params.id}: rejects the wrong secret`, () => {
			const { x, y } = newKeypair(params);
			const { r, t } = commit(params);
			const c = randomChallenge(params);
			const s = respond(r, c, (x + 1n) % params.q, params);
			expect(verify(y, { t, c, s }, params)).toBe(false);
		});

		it(`${params.id}: rejects a tampered response`, () => {
			const { x, y } = newKeypair(params);
			const { r, t } = commit(params);
			const c = randomChallenge(params);
			const s = respond(r, c, x, params);
			expect(verify(y, { t, c, s: (s + 1n) % params.q }, params)).toBe(false);
		});

		it(`${params.id}: rejects a tampered commitment`, () => {
			const { x, y } = newKeypair(params);
			const { r, t } = commit(params);
			const c = randomChallenge(params);
			const s = respond(r, c, x, params);
			expect(verify(y, { t: (t * 2n) % params.p, c, s }, params)).toBe(false);
		});

		it(`${params.id}: rejects a replayed proof under a fresh challenge`, () => {
			// Soundness: a transcript valid for c is worthless for c' ≠ c.
			const { x, y } = newKeypair(params);
			const { r, t } = commit(params);
			const c = randomChallenge(params);
			const s = respond(r, c, x, params);
			const cPrime = (c + 1n) % params.q;
			expect(verify(y, { t, c: cPrime, s }, params)).toBe(false);
		});

		it(`${params.id}: the HVZK simulator produces an accepting transcript`, () => {
			// Pick c and s first, then solve for t = g^s · y^(-c). This is the
			// argument the page makes in prose; here it is executed.
			const { y } = newKeypair(params);
			const c = randomChallenge(params);
			const s = randomChallenge(params);
			const yInv = modInverse(modpow(y, c, params.p), params.p);
			const t = (modpow(params.g, s, params.p) * yInv) % params.p;
			expect(verify(y, { t, c, s }, params)).toBe(true);
		});

		it(`${params.id}: an all-zero proof is rejected`, () => {
			const { y } = newKeypair(params);
			expect(verify(y, { t: 0n, c: 0n, s: 0n }, params)).toBe(false);
		});
	}
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
