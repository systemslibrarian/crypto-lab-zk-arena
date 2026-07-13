import { describe, expect, it } from 'vitest';
import { G, modpow, P, Q } from './schnorr.ts';
import {
	commitValue,
	forgeOpening,
	modInverse,
	runCeremony,
	verifyOpening,
} from './trustedsetup.ts';

describe('modInverse', () => {
	it('produces a genuine inverse for values coprime to the modulus', () => {
		// small prime modulus where every nonzero residue is invertible
		for (const a of [1n, 2n, 3n, 5n, 12n, 16n]) {
			const inv = modInverse(a, 17n);
			expect((a * inv) % 17n).toBe(1n);
		}
	});
	it('throws when no inverse exists', () => {
		expect(() => modInverse(4n, 8n)).toThrow(/inverse/);
	});
});

describe('trusted-setup ceremony', () => {
	it('publishes h = g^τ mod p', () => {
		const crs = runCeremony();
		expect(modpow(G, crs.tau, P)).toBe(crs.h);
	});
});

describe('Pedersen commitment binding', () => {
	it('accepts an honest opening', () => {
		const crs = runCeremony();
		const com = commitValue(crs.h, 42n);
		expect(verifyOpening(crs.h, com.c, com.m, com.s)).toBe(true);
	});

	it('rejects a false opening when the trapdoor is unknown (setup was honest)', () => {
		// Without τ, changing the claimed value cannot keep the same C: the best a
		// cheater can do is guess randomness, which fails with overwhelming odds.
		const crs = runCeremony();
		const com = commitValue(crs.h, 42n);
		const guessS = (com.s + 1n) % Q;
		expect(verifyOpening(crs.h, com.c, 43n, guessS)).toBe(false);
		expect(verifyOpening(crs.h, com.c, 43n, com.s)).toBe(false);
	});
});

describe('toxic-waste forgery', () => {
	it('a kept trapdoor equivocates the SAME commitment to a false value', () => {
		const crs = runCeremony();
		const com = commitValue(crs.h, 42n);
		// Attacker keeps τ and forges an opening to 999 for the very same C.
		const forgedS = forgeOpening(crs.tau, com.m, com.s, 999n);
		expect(verifyOpening(crs.h, com.c, 999n, forgedS)).toBe(true);
	});

	it('forgery is specific to the trapdoor: a wrong τ does not equivocate', () => {
		const crs = runCeremony();
		const com = commitValue(crs.h, 42n);
		// A different ceremony's trapdoor (guaranteed coprime, but not log_g h).
		const wrongTau = runCeremony().tau;
		const forgedS = forgeOpening(wrongTau, com.m, com.s, 999n);
		expect(verifyOpening(crs.h, com.c, 999n, forgedS)).toBe(false);
	});
});
