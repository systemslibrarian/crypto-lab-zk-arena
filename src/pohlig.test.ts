import { describe, expect, it } from 'vitest';
import { SAFE_GROUP, TOY_GROUP, smoothPart } from './groups.ts';
import { bsgs, crt, legendreProbe, modInverse, pohligHellman } from './pohlig.ts';
import { modpow, newKeypair } from './schnorr.ts';

describe('baby-step giant-step', () => {
	it('solves a discrete log in a small prime-order subgroup', () => {
		// order-11 subgroup of Z_23*: 2^11 = 2048 = 1 mod 23
		const p = 23n;
		const g = 2n;
		expect(modpow(g, 11n, p)).toBe(1n);
		for (let d = 0n; d < 11n; d++) {
			const y = modpow(g, d, p);
			expect(bsgs(g, y, 11n, p).d).toBe(d);
		}
	});

	it('returns null rather than a wrong answer when the target is outside ⟨g⟩', () => {
		// 5 is not in the order-11 subgroup of Z_23* (which is the quadratic residues)
		const inSubgroup = new Set<bigint>();
		for (let d = 0n; d < 11n; d++) inSubgroup.add(modpow(2n, d, 23n));
		const outsider = [...Array(22).keys()]
			.map((i) => BigInt(i + 1))
			.find((v) => !inSubgroup.has(v));
		expect(outsider !== undefined).toBe(true);
		expect(bsgs(2n, outsider as bigint, 11n, 23n).d).toBeNull();
	});
});

describe('crt', () => {
	it('reconstructs a value from its residues', () => {
		expect(crt([2n, 3n, 2n], [3n, 5n, 7n])).toBe(23n);
	});
	it('agrees with direct reduction for the toy group factors', () => {
		const moduli = [2n, 3n, 7n, 13441n];
		const x = 123456789012345n;
		const residues = moduli.map((m) => x % m);
		expect(crt(residues, moduli)).toBe(x % 564522n);
	});
});

describe('modInverse', () => {
	it('inverts values coprime to the modulus', () => {
		for (const a of [1n, 2n, 3n, 5n, 12n, 16n]) {
			expect((a * modInverse(a, 17n)) % 17n).toBe(1n);
		}
	});
	it('throws when no inverse exists', () => {
		expect(() => modInverse(4n, 8n)).toThrow(/inverse/);
	});
});

describe('Pohlig–Hellman against the TOY group — the leak is real', () => {
	const TRIALS = 60;

	it(`recovers x mod 564522 from the public key alone, ${TRIALS}/${TRIALS} times`, () => {
		let recovered = 0;
		for (let i = 0; i < TRIALS; i++) {
			const { x, y } = newKeypair(TOY_GROUP);
			// The attack is handed y and the public parameters. Nothing else.
			const leak = pohligHellman(y, TOY_GROUP);
			if (leak.residue === x % leak.modulus) recovered++;
		}
		expect(recovered).toBe(TRIALS);
	});

	it('recovers each small-factor residue correctly, not just the CRT product', () => {
		const { x, y } = newKeypair(TOY_GROUP);
		const leak = pohligHellman(y, TOY_GROUP);
		for (const f of leak.perFactor) {
			if (!f.feasible) continue;
			expect(f.residue).toBe(x % f.factor ** BigInt(f.exponent));
		}
	});

	it('reports the modulus and bit count the disclosure copy quotes', () => {
		const { y } = newKeypair(TOY_GROUP);
		const leak = pohligHellman(y, TOY_GROUP);
		expect(leak.modulus).toBe(564522n);
		expect(leak.modulus).toBe(smoothPart(TOY_GROUP));
		expect(leak.bitsRecovered).toBeCloseTo(19.1067, 3);
		expect(leak.bitsTotal).toBeCloseTo(256, 3);
		expect(leak.bitsRemaining).toBeCloseTo(236.89, 1);
		expect(leak.leaked).toBe(true);
	});

	it('never counts a bit it did not actually compute', () => {
		const { y } = newKeypair(TOY_GROUP);
		const leak = pohligHellman(y, TOY_GROUP);
		let claimed = 1n;
		for (const f of leak.perFactor) {
			if (f.feasible && f.residue !== null) claimed *= f.factor ** BigInt(f.exponent);
			// an infeasible factor must contribute nothing and admit it
			if (!f.feasible) expect(f.residue).toBeNull();
		}
		expect(claimed).toBe(leak.modulus);
	});

	it('leaves the 237-bit factor untouched and says so', () => {
		const { y } = newKeypair(TOY_GROUP);
		const leak = pohligHellman(y, TOY_GROUP);
		const infeasible = leak.perFactor.filter((f) => !f.feasible);
		expect(infeasible.length).toBe(1);
		expect(infeasible[0].residue).toBeNull();
		// square-root cost of a 237-bit subgroup is ~2^118 steps
		expect(infeasible[0].log2Steps).toBeCloseTo(118.3, 0);
	});

	it('is fast enough to be a button, not a batch job', () => {
		const { y } = newKeypair(TOY_GROUP);
		const leak = pohligHellman(y, TOY_GROUP);
		expect(leak.totalMs < 250).toBe(true);
	});
});

describe('Pohlig–Hellman against the SAFE group — the same attack gets nothing', () => {
	it('recovers zero bits', () => {
		for (let i = 0; i < 3; i++) {
			const { y } = newKeypair(SAFE_GROUP);
			const leak = pohligHellman(y, SAFE_GROUP);
			expect(leak.modulus).toBe(1n);
			expect(leak.bitsRecovered).toBe(0);
			expect(leak.leaked).toBe(false);
		}
	});

	it('declines to attack the single 2047-bit factor and reports its true cost', () => {
		const { y } = newKeypair(SAFE_GROUP);
		const leak = pohligHellman(y, SAFE_GROUP);
		expect(leak.perFactor.length).toBe(1);
		expect(leak.perFactor[0].feasible).toBe(false);
		expect(leak.perFactor[0].residue).toBeNull();
		expect(leak.perFactor[0].log2Steps).toBeCloseTo(1023.5, 0);
	});

	it('the Legendre probe returns 1 for every key, so it distinguishes nothing', () => {
		for (let i = 0; i < 5; i++) {
			const { y } = newKeypair(SAFE_GROUP);
			const probe = legendreProbe(y, SAFE_GROUP);
			expect(probe.value).toBe(1n);
			expect(probe.informative).toBe(false);
		}
	});

	it('the same probe IS informative in the toy group', () => {
		const probe = legendreProbe(newKeypair(TOY_GROUP).y, TOY_GROUP);
		expect(probe.informative).toBe(true);
	});
});
