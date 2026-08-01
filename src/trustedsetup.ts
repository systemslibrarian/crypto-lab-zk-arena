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
// The math is spec-accurate. Like the Schnorr exhibit, it runs in whichever of
// the two parameter sets the learner selects, and carries the same caveat: in
// the toy group the trapdoor's own "public key" h leaks ~19 bits of τ before
// the ceremony has done anything. Do not use for production.

import { TOY_GROUP, type GroupParams } from './groups.ts';
import { modpow, randBig } from './schnorr.ts';
import { modInverse } from './pohlig.ts';

export { modInverse } from './pohlig.ts';

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

function randExponent(params: GroupParams): bigint {
	return (randBig(params.qBits + 128) % (params.q - 1n)) + 1n;
}

/**
 * Run the setup ceremony: sample τ and publish h = g^τ mod p.
 *
 * We reject any τ that shares a factor with the group order q. In a prime-order
 * group (the safe parameter set) every nonzero τ is already invertible and this
 * loop never fires; in the toy group q = p − 1 is composite, so sampling τ
 * coprime to q keeps the equivocation math exact. That extra condition is a
 * property of the toy parameters, not of trusted setup.
 */
export function runCeremony(params: GroupParams = TOY_GROUP): Crs {
	let tau = randExponent(params);
	while (gcd(tau, params.q) !== 1n) tau = randExponent(params);
	const h = modpow(params.g, tau, params.p);
	return { tau, h };
}

/** Pedersen commitment C = g^m · h^s mod p to value m with fresh randomness. */
export function commitValue(
	h: bigint,
	m: bigint,
	params: GroupParams = TOY_GROUP,
): Commitment {
	const { g, p, q } = params;
	const s = randExponent(params);
	const mm = ((m % q) + q) % q;
	const c = (modpow(g, mm, p) * modpow(h, s, p)) % p;
	return { m: mm, s, c };
}

/** Verify an opening (m, s) of commitment c against the public CRS h. */
export function verifyOpening(
	h: bigint,
	c: bigint,
	m: bigint,
	s: bigint,
	params: GroupParams = TOY_GROUP,
): boolean {
	const { g, p, q } = params;
	const lhs = c % p;
	const rhs = (modpow(g, ((m % q) + q) % q, p) * modpow(h, ((s % q) + q) % q, p)) % p;
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
	params: GroupParams = TOY_GROUP,
): bigint {
	const q = params.q;
	const tauInv = modInverse(tau, q);
	const delta = (((mReal - mFalse) % q) + q) % q;
	return (((sReal + delta * tauInv) % q) + q) % q;
}
