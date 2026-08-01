import { describe, expect, it } from 'vitest';
import {
	FEASIBLE_FACTOR_BOUND,
	GROUPS,
	SAFE_GROUP,
	TOY_GROUP,
	log2Big,
	smoothPart,
	type GroupParams,
} from './groups.ts';
import { modpow } from './schnorr.ts';

// A Miller-Rabin test written here rather than imported, so the claims in
// groups.ts are checked against independent code rather than against
// themselves. Deterministic for the sizes involved given this many witnesses.
function isProbablePrime(n: bigint): boolean {
	if (n < 2n) return false;
	for (const p of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) {
		if (n === p) return true;
		if (n % p === 0n) return false;
	}
	let d = n - 1n;
	let r = 0n;
	while (d % 2n === 0n) {
		d /= 2n;
		r++;
	}
	const witnesses = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n, 43n, 47n, 53n];
	for (const a of witnesses) {
		let x = modpow(a, d, n);
		if (x === 1n || x === n - 1n) continue;
		let composite = true;
		for (let i = 1n; i < r; i++) {
			x = (x * x) % n;
			if (x === n - 1n) {
				composite = false;
				break;
			}
		}
		if (composite) return false;
	}
	return true;
}

/** ⟨g⟩ has order exactly q iff g^q = 1 and g^(q/f) ≠ 1 for every prime f | q. */
function hasExactOrder(params: GroupParams): boolean {
	const { g, p, q } = params;
	if (modpow(g, q, p) !== 1n) return false;
	for (const [f] of params.qFactors) {
		if (modpow(g, q / f, p) === 1n) return false;
	}
	return true;
}

describe('group parameter claims are true, not asserted', () => {
	for (const params of [TOY_GROUP, SAFE_GROUP]) {
		it(`${params.id}: p is prime`, () => {
			expect(isProbablePrime(params.p)).toBe(true);
		});

		it(`${params.id}: declared bit lengths match the actual values`, () => {
			expect(params.p.toString(2).length).toBe(params.pBits);
			expect(params.q.toString(2).length).toBe(params.qBits);
		});

		it(`${params.id}: qFactors multiply back to q exactly`, () => {
			let product = 1n;
			for (const [f, e] of params.qFactors) product *= f ** BigInt(e);
			expect(product).toBe(params.q);
		});

		it(`${params.id}: every declared factor of q is genuinely prime`, () => {
			for (const [f] of params.qFactors) {
				expect(isProbablePrime(f)).toBe(true);
			}
		});

		it(`${params.id}: g generates a subgroup of order exactly q`, () => {
			expect(hasExactOrder(params)).toBe(true);
		});

		it(`${params.id}: primeOrder flag matches whether q is actually prime`, () => {
			expect(isProbablePrime(params.q)).toBe(params.primeOrder);
		});
	}
});

describe('toy group — the specific, measured weakness', () => {
	it('q = p - 1, so the group is the whole multiplicative group', () => {
		expect(TOY_GROUP.q).toBe(TOY_GROUP.p - 1n);
	});

	it('factors as 2 · 3 · 7 · 13441 · q′ with q′ a 237-bit prime', () => {
		const small = TOY_GROUP.qFactors.filter(([f]) => f < FEASIBLE_FACTOR_BOUND).map(([f]) => f);
		expect(small).toEqual([2n, 3n, 7n, 13441n]);
		const big = TOY_GROUP.qFactors.filter(([f]) => f >= FEASIBLE_FACTOR_BOUND);
		expect(big.length).toBe(1);
		expect(big[0][0].toString(2).length).toBe(237);
		expect(isProbablePrime(big[0][0])).toBe(true);
	});

	it('the smooth part is exactly 564522', () => {
		expect(smoothPart(TOY_GROUP)).toBe(564522n);
	});

	it('the leak is 19.10 bits — the number the page prints', () => {
		// If this drifts, the disclosure copy is wrong and must be updated with it.
		expect(log2Big(smoothPart(TOY_GROUP))).toBeCloseTo(19.1067, 3);
	});

	it('trial division rediscovers the small factors independently', () => {
		// Do not trust the table: refactor q by hand up to the feasibility bound.
		let rem = TOY_GROUP.q;
		const found: bigint[] = [];
		for (let d = 2n; d < 20000n; d++) {
			while (rem % d === 0n) {
				rem /= d;
				found.push(d);
			}
		}
		expect(found).toEqual([2n, 3n, 7n, 13441n]);
	});
});

describe('safe group — RFC 3526 MODP Group 14', () => {
	it('p is a safe prime: p = 2q + 1 with q prime', () => {
		expect(2n * SAFE_GROUP.q + 1n).toBe(SAFE_GROUP.p);
		expect(isProbablePrime(SAFE_GROUP.q)).toBe(true);
	});

	it('has no smooth part at all — nothing to attack', () => {
		expect(smoothPart(SAFE_GROUP)).toBe(1n);
	});

	it('g = 2 lands inside the prime-order subgroup', () => {
		expect(modpow(SAFE_GROUP.g, SAFE_GROUP.q, SAFE_GROUP.p)).toBe(1n);
		expect(SAFE_GROUP.g).not.toBe(1n);
	});

	it('matches the RFC 3526 §3 prime bit-for-bit at both ends', () => {
		const hex = SAFE_GROUP.p.toString(16).toUpperCase();
		expect(hex.length).toBe(512);
		expect(hex.startsWith('FFFFFFFFFFFFFFFFC90FDAA22168C234')).toBe(true);
		expect(hex.endsWith('15728E5A8AACAA68FFFFFFFFFFFFFFFF')).toBe(true);
	});
});

describe('log2Big stays exact past double precision', () => {
	it('agrees with Math.log2 on small values', () => {
		expect(log2Big(1024n)).toBeCloseTo(10, 9);
		expect(log2Big(564522n)).toBeCloseTo(Math.log2(564522), 9);
	});
	it('handles values far beyond Number.MAX_SAFE_INTEGER', () => {
		expect(log2Big(1n << 2047n)).toBeCloseTo(2047, 6);
		expect(log2Big(TOY_GROUP.q)).toBeCloseTo(256, 3);
	});
});

describe('registry', () => {
	it('exposes both parameter sets under their own ids', () => {
		expect(GROUPS.toy).toBe(TOY_GROUP);
		expect(GROUPS.safe).toBe(SAFE_GROUP);
	});
});
