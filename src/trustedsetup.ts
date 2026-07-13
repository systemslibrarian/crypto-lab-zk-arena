// trustedsetup.ts — a real, runnable trusted-setup ceremony and the forgery it
// enables when the "toxic waste" is not destroyed.
//
// This models the central risk of a SNARK trusted setup with the simplest real
// primitive that has the same shape: a Pedersen commitment whose binding rests
// on a secret trapdoor τ ("tau"). The ceremony samples τ and publishes the
// common reference string (CRS) h = g^τ mod p, then is *supposed* to destroy τ.
//
//   • Commit to a value m with randomness s:   C = g^m · h^s mod p
//   • Open honestly by revealing (m, s):        verifier checks C == g^m · h^s
//
// A commitment is *binding* only because nobody knows τ = log_g(h). Anyone who
// keeps τ can equivocate: for any target m′ they can compute s′ so that (m′, s′)
// opens the SAME C. That is the toxic-waste forgery — an accepting proof for a
// false statement, produced without ever breaking the discrete log.
//
// The math is spec-accurate; the group parameters are educational-grade (the
// same 256-bit prime as the Schnorr demo). Do not use for production.

import { G, modpow, P, Q, randBig } from './schnorr.ts';

export interface Crs {
	/** trapdoor τ; in a real ceremony this is the "toxic waste" that must be destroyed */
	tau: bigint;
	/** the published common reference string h = g^τ mod p */
	h: bigint;
}

export interface Commitment {
	/** the committed value the prover claims (kept private until opening) */
	m: bigint;
	/** blinding randomness */
	s: bigint;
	/** C = g^m · h^s mod p */
	c: bigint;
}

function gcd(a: bigint, b: bigint): bigint {
	while (b !== 0n) [a, b] = [b, a % b];
	return a < 0n ? -a : a;
}

/** Modular inverse a⁻¹ mod m via the extended Euclidean algorithm. */
export function modInverse(a: bigint, m: bigint): bigint {
	let [old_r, r] = [((a % m) + m) % m, m];
	let [old_s, s] = [1n, 0n];
	while (r !== 0n) {
		const q = old_r / r;
		[old_r, r] = [r, old_r - q * r];
		[old_s, s] = [s, old_s - q * s];
	}
	if (old_r !== 1n) throw new Error('no modular inverse (value not coprime to modulus)');
	return ((old_s % m) + m) % m;
}

/**
 * Run the setup ceremony: sample τ and publish h = g^τ mod p.
 *
 * We reject any τ that shares a factor with the group order q. In a real
 * prime-order subgroup every nonzero τ is invertible; this demo reuses the
 * Schnorr group whose order q = p − 1 is composite, so we sample τ coprime to q
 * (still uniform among invertible exponents) to keep the equivocation math
 * exact. This is a property of the toy parameters, not of trusted setup.
 */
export function runCeremony(): Crs {
	let tau = (randBig() % (Q - 1n)) + 1n;
	while (gcd(tau, Q) !== 1n) tau = (randBig() % (Q - 1n)) + 1n;
	const h = modpow(G, tau, P);
	return { tau, h };
}

/** Pedersen commitment C = g^m · h^s mod p to value m with fresh randomness. */
export function commitValue(h: bigint, m: bigint): Commitment {
	const s = (randBig() % (Q - 1n)) + 1n;
	const c = (modpow(G, ((m % Q) + Q) % Q, P) * modpow(h, s, P)) % P;
	return { m: ((m % Q) + Q) % Q, s, c };
}

/** Verify an opening (m, s) of commitment c against the public CRS h. */
export function verifyOpening(h: bigint, c: bigint, m: bigint, s: bigint): boolean {
	const lhs = c % P;
	const rhs = (modpow(G, ((m % Q) + Q) % Q, P) * modpow(h, ((s % Q) + Q) % Q, P)) % P;
	return lhs === rhs;
}

/**
 * Toxic-waste forgery: given the trapdoor τ and an existing commitment that was
 * honestly made to `mReal` with randomness `sReal`, produce randomness s′ so
 * that (mFalse, s′) opens the SAME commitment C.
 *
 * Derivation: we need g^{mFalse} · h^{s′} = g^{mReal} · h^{sReal} (= C).
 * With h = g^τ this is  mFalse + τ·s′ ≡ mReal + τ·sReal  (mod q), so
 *   s′ = sReal + (mReal − mFalse)·τ⁻¹  (mod q).
 */
export function forgeOpening(
	tau: bigint,
	mReal: bigint,
	sReal: bigint,
	mFalse: bigint,
): bigint {
	const tauInv = modInverse(tau, Q);
	const delta = (((mReal - mFalse) % Q) + Q) % Q;
	return (((sReal + delta * tauInv) % Q) + Q) % Q;
}
