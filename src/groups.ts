// groups.ts — the two parameter sets the live exhibits can run in, and the
// published facts about each that the leak demo relies on.
//
// The whole point of having two is contrast: the SAME protocol code runs in
// both, and the difference in outcome comes only from the parameters. One of
// them is deliberately broken in a specific, measurable way; the other is a
// real, standardised group.
//
// Every number asserted here is checked by `groups.test.ts` at run time — the
// primality of each modulus, the claimed factorisation of each group order, and
// the claimed order of each generator. Nothing below is taken on trust from a
// comment.

export interface GroupParams {
	id: 'toy' | 'safe';
	/** short label for the UI toggle */
	label: string;
	/** one-line description of what this parameter set actually is */
	summary: string;
	/** the modulus */
	p: bigint;
	/** the generator */
	g: bigint;
	/** the order of ⟨g⟩ — exponents are reduced mod this */
	q: bigint;
	/** bit length of p */
	pBits: number;
	/** bit length of q */
	qBits: number;
	/** true iff q is prime, i.e. iff ⟨g⟩ is a prime-order group */
	primeOrder: boolean;
	/**
	 * The complete prime factorisation of q, as [prime, exponent] pairs.
	 *
	 * This is a *published property of the parameters*, not something the browser
	 * computes: factoring a 2047-bit number in a web page is not possible, and
	 * pretending otherwise would be the same class of dishonesty this demo is
	 * trying to teach against. For the toy group the factorisation is small
	 * enough to rediscover by trial division in milliseconds; for the safe group
	 * it is a defining, standardised property of the chosen prime.
	 */
	qFactors: ReadonlyArray<readonly [bigint, number]>;
	/** honest statement of the security level, or the lack of one */
	securityNote: string;
}

// ---------------------------------------------------------------------------
// Toy group — deliberately broken, kept because you can follow the attack.
// ---------------------------------------------------------------------------

/** secp256k1's *field* prime. Note: the field prime, not the curve order. */
const TOY_P: bigint = (1n << 256n) - (1n << 32n) - 977n;

/** The 237-bit prime cofactor of TOY_P − 1. */
const TOY_Q_PRIME: bigint =
	205115282021455665897114700593932402728804164701536103180137503955397371n;

export const TOY_GROUP: GroupParams = {
	id: 'toy',
	label: 'Toy group — 256-bit, composite order',
	summary:
		'The multiplicative group mod the secp256k1 field prime, with g = 5 and exponents mod p − 1. ' +
		'p − 1 is composite, so this is not a prime-order group and the Schnorr security argument does not apply.',
	p: TOY_P,
	// 5 is a primitive root mod p, so ⟨g⟩ is the entire multiplicative group and
	// the order of ⟨g⟩ is exactly p − 1.
	g: 5n,
	q: TOY_P - 1n,
	pBits: 256,
	qBits: 256,
	primeOrder: false,
	// p − 1 = 2 · 3 · 7 · 13441 · q′ — verified by trial division in groups.test.ts.
	qFactors: [
		[2n, 1],
		[3n, 1],
		[7n, 1],
		[13441n, 1],
		[TOY_Q_PRIME, 1],
	],
	securityNote:
		'No claimed security level. The small factors 2, 3, 7 and 13441 of the group order leak ' +
		'x mod 564522 — about 19.1 bits — from the public key alone, in under a millisecond.',
};

// ---------------------------------------------------------------------------
// Safe group — RFC 3526 MODP Group 14. A real, deployed, standardised group.
// ---------------------------------------------------------------------------

/**
 * The 2048-bit MODP prime from RFC 3526 §3 (also IKE/IPsec "Group 14", and the
 * same prime as RFC 7919 is a sibling of). It is a *safe prime*: p = 2q + 1
 * with q prime.
 */
const SAFE_P: bigint = BigInt(
	'0x' +
		[
			'FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD1',
			'29024E088A67CC74020BBEA63B139B22514A08798E3404DD',
			'EF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245',
			'E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED',
			'EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3D',
			'C2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F',
			'83655D23DCA3AD961C62F356208552BB9ED529077096966D',
			'670C354E4ABC9804F1746C08CA18217C32905E462E36CE3B',
			'E39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9',
			'DE2BCBF6955817183995497CEA956AE515D2261898FA0510',
			'15728E5A8AACAA68FFFFFFFFFFFFFFFF',
		].join(''),
);

/** q = (p − 1)/2, a 2047-bit prime. ⟨2⟩ is exactly the subgroup of order q. */
const SAFE_Q: bigint = (SAFE_P - 1n) / 2n;

export const SAFE_GROUP: GroupParams = {
	id: 'safe',
	label: 'Safe group — 2048-bit, prime order',
	summary:
		'RFC 3526 MODP Group 14: a 2048-bit safe prime p = 2q + 1, with g = 2 generating the ' +
		'subgroup of prime order q. Prime order is exactly the precondition Schnorr is analysed under.',
	p: SAFE_P,
	g: 2n,
	q: SAFE_Q,
	pBits: 2048,
	qBits: 2047,
	primeOrder: true,
	// q is prime, so its factorisation is itself. There is no smooth part.
	qFactors: [[SAFE_Q, 1]],
	securityNote:
		'A real, standardised group — but be precise about the number: 2048-bit finite-field ' +
		'discrete log is rated at roughly 112 bits of security (NIST SP 800-57), not 128, because ' +
		'the number field sieve attacks the field, not the subgroup. It is genuinely out of reach ' +
		'here; it is not the strongest choice a 2026 deployment would make.',
};

export const GROUPS: Record<GroupParams['id'], GroupParams> = {
	toy: TOY_GROUP,
	safe: SAFE_GROUP,
};

/**
 * The largest factor this demo is willing to attack by brute force in a browser
 * tab. 2^24 keeps the worst-case baby-step giant-step table at ~4096 entries,
 * which is instant. Anything larger is reported as infeasible *and left
 * unattempted* rather than silently skipped.
 */
export const FEASIBLE_FACTOR_BOUND: bigint = 1n << 24n;

/** Product of the factors of q small enough to be attacked — the "smooth part". */
export function smoothPart(params: GroupParams): bigint {
	let b = 1n;
	for (const [f, e] of params.qFactors) {
		if (f < FEASIBLE_FACTOR_BOUND) b *= f ** BigInt(e);
	}
	return b;
}

/** log2 of a bigint, as a float, accurate enough for a bit-count readout. */
export function log2Big(n: bigint): number {
	if (n <= 0n) return -Infinity;
	const bits = n.toString(2).length;
	if (bits <= 50) return Math.log2(Number(n));
	// scale down to keep the mantissa exact, then add the exponent back
	const shift = BigInt(bits - 50);
	return Math.log2(Number(n >> shift)) + Number(shift);
}
