// pohlig.ts — a working Pohlig–Hellman discrete-log attack, run live in the
// browser against this demo's own public keys.
//
// This exists so the toy group's weakness is *demonstrable* rather than merely
// asserted. The disclosure note on the page says the parameters leak about 19
// bits of the secret; this module is what lets a learner press a button and
// watch those bits fall out of the public key, with nothing but the public key
// as input.
//
// The reduction: if the group order q factors as ∏ pᵢ^eᵢ, then for each factor
// the map z ↦ z^(q/pᵢ^eᵢ) lands in the unique subgroup of order pᵢ^eᵢ, and
// solving the discrete log *there* yields x mod pᵢ^eᵢ. The Chinese remainder
// theorem glues the residues into x mod ∏ pᵢ^eᵢ. The cost is dominated by the
// LARGEST prime factor, not by the size of q — which is precisely why "big
// modulus" is not the same thing as "hard discrete log".

import { FEASIBLE_FACTOR_BOUND, log2Big, type GroupParams } from './groups.ts';
import { modpow } from './schnorr.ts';

export interface FactorAttack {
	/** the prime factor pᵢ of the group order */
	factor: bigint;
	/** its exponent eᵢ in the factorisation of q */
	exponent: number;
	/** bits this factor contributes: log2(pᵢ^eᵢ) */
	bits: number;
	/** whether the demo attempted it (small enough to brute force in a tab) */
	feasible: boolean;
	/** x mod pᵢ^eᵢ, when feasible; null when the factor was left unattacked */
	residue: bigint | null;
	/** baby-step giant-step table size actually used, or the size that would be needed */
	bsgsSteps: number;
	/** log2 of the step count — the honest cost readout for infeasible factors */
	log2Steps: number;
	/** wall-clock milliseconds spent on this factor */
	ms: number;
}

export interface LeakResult {
	perFactor: FactorAttack[];
	/** product of the factors actually attacked */
	modulus: bigint;
	/** x mod `modulus`, recovered from the public key alone */
	residue: bigint;
	bitsRecovered: number;
	bitsTotal: number;
	bitsRemaining: number;
	totalMs: number;
	/** true iff at least one factor was small enough to attack */
	leaked: boolean;
}

/** Modular inverse via the extended Euclidean algorithm. */
export function modInverse(a: bigint, m: bigint): bigint {
	let [oldR, r] = [((a % m) + m) % m, m];
	let [oldS, s] = [1n, 0n];
	while (r !== 0n) {
		const quot = oldR / r;
		[oldR, r] = [r, oldR - quot * r];
		[oldS, s] = [s, oldS - quot * s];
	}
	if (oldR !== 1n) throw new Error('no modular inverse (value not coprime to modulus)');
	return ((oldS % m) + m) % m;
}

/**
 * Baby-step giant-step: find d with gi^d = yi (mod p), where gi has order
 * `order`. Runs in O(√order) time and memory — the reason a 13441-element
 * subgroup dies in about 116 steps.
 */
export function bsgs(
	gi: bigint,
	yi: bigint,
	order: bigint,
	p: bigint,
): { d: bigint | null; steps: number } {
	const m = BigInt(Math.ceil(Math.sqrt(Number(order))));
	const table = new Map<bigint, bigint>();
	let cur = 1n;
	for (let j = 0n; j < m; j++) {
		if (!table.has(cur)) table.set(cur, j);
		cur = (cur * gi) % p;
	}
	// gi^(-m): invert gi in the subgroup, then raise to m
	const giInv = modInverse(gi, p);
	const giInvM = modpow(giInv, m, p);
	let gamma = yi;
	for (let i = 0n; i <= m; i++) {
		const hit = table.get(gamma);
		if (hit !== undefined) return { d: (i * m + hit) % order, steps: Number(m) };
		gamma = (gamma * giInvM) % p;
	}
	return { d: null, steps: Number(m) };
}

/** Chinese remainder theorem over pairwise-coprime moduli. */
export function crt(residues: bigint[], moduli: bigint[]): bigint {
	let M = 1n;
	for (const m of moduli) M *= m;
	let x = 0n;
	for (let i = 0; i < moduli.length; i++) {
		const Mi = M / moduli[i];
		const inv = modInverse(Mi % moduli[i], moduli[i]);
		x = (x + ((residues[i] * Mi) % M) * inv) % M;
	}
	return ((x % M) + M) % M;
}

/**
 * Recover everything the public key `y` gives up about its own secret exponent,
 * using only `y` and the public parameters. No transcript, no interaction, no
 * access to the secret.
 *
 * Factors of the group order at or above `FEASIBLE_FACTOR_BOUND` are reported
 * with their true cost and deliberately NOT attempted — the result must never
 * claim a bit it did not actually compute.
 */
export function pohligHellman(y: bigint, params: GroupParams): LeakResult {
	const { p, g, q } = params;
	const perFactor: FactorAttack[] = [];
	const residues: bigint[] = [];
	const moduli: bigint[] = [];
	const t0 = performance.now();

	for (const [prime, exponent] of params.qFactors) {
		const power = prime ** BigInt(exponent);
		const bits = log2Big(power);
		const f0 = performance.now();

		if (prime >= FEASIBLE_FACTOR_BOUND) {
			// Honest cost readout for a factor we are not going to touch.
			perFactor.push({
				factor: prime,
				exponent,
				bits,
				feasible: false,
				residue: null,
				bsgsSteps: Infinity,
				log2Steps: log2Big(power) / 2,
				ms: performance.now() - f0,
			});
			continue;
		}

		// Project into the order-`power` subgroup and solve there.
		const cofactor = q / power;
		const gi = modpow(g, cofactor, p);
		const yi = modpow(y, cofactor, p);
		const { d, steps } = bsgs(gi, yi, power, p);
		const ms = performance.now() - f0;

		if (d === null) {
			perFactor.push({
				factor: prime,
				exponent,
				bits,
				feasible: true,
				residue: null,
				bsgsSteps: steps,
				log2Steps: Math.log2(Math.max(1, steps)),
				ms,
			});
			continue;
		}

		perFactor.push({
			factor: prime,
			exponent,
			bits,
			feasible: true,
			residue: d,
			bsgsSteps: steps,
			log2Steps: Math.log2(Math.max(1, steps)),
			ms,
		});
		residues.push(d);
		moduli.push(power);
	}

	const modulus = moduli.reduce((a, b) => a * b, 1n);
	const residue = moduli.length > 0 ? crt(residues, moduli) : 0n;
	const totalMs = performance.now() - t0;
	const bitsTotal = log2Big(q);
	const bitsRecovered = modulus > 1n ? log2Big(modulus) : 0;

	return {
		perFactor,
		modulus,
		residue,
		bitsRecovered,
		bitsTotal,
		bitsRemaining: bitsTotal - bitsRecovered,
		totalMs,
		leaked: modulus > 1n,
	};
}

/**
 * The one bit a safe prime *looks* like it might give away, checked rather than
 * assumed.
 *
 * When p = 2q + 1, the group order p − 1 does have a factor of 2, and the
 * Legendre symbol y^((p−1)/2) mod p is computable by anyone. But every element
 * of the order-q subgroup is a quadratic residue, so that computation returns 1
 * for every honest public key and distinguishes nothing. This function performs
 * the computation for real so the page can show the 1 instead of claiming it.
 */
export function legendreProbe(y: bigint, params: GroupParams): { value: bigint; informative: boolean } {
	const value = modpow(y, (params.p - 1n) / 2n, params.p);
	// Informative only if it can come out as something other than 1.
	return { value, informative: !params.primeOrder };
}
