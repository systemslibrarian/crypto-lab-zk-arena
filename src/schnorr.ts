// schnorr.ts — a working Schnorr identification (sigma) protocol, with optional
// Fiat-Shamir non-interactivisation.
//
// This is a real, runnable zero-knowledge proof of knowledge of the discrete
// logarithm x such that y = g^x mod p. It is the cleanest example of the
// {commit, challenge, response} structure that lies under every modern SNARK.
//
// The protocol code below is parameterised by the group (see groups.ts) and is
// byte-for-byte the same in both parameter sets the page offers:
//
//   • TOY_GROUP  — 256-bit, COMPOSITE order. Small factors of the group order
//     leak x mod 564522 (~19.1 bits) from the public key alone, before any
//     proof runs. That is not a bug in this file; it is a property of those
//     parameters, and pohlig.ts demonstrates it live on the page.
//   • SAFE_GROUP — 2048-bit safe prime, PRIME-order subgroup. The same attack
//     recovers nothing.
//
// The contrast is the lesson: identical protocol, different parameters,
// different outcome. Neither parameter set makes this file production
// cryptography — there is no constant-time arithmetic here, among other things.

import { TOY_GROUP, type GroupParams } from './groups.ts';

export { TOY_GROUP, SAFE_GROUP, GROUPS, type GroupParams } from './groups.ts';

/**
 * Default parameters, kept as module-level exports so existing call sites and
 * tests keep working. These are the TOY parameters — deliberately weak.
 */
export const P: bigint = TOY_GROUP.p;
export const G: bigint = TOY_GROUP.g;
export const Q: bigint = TOY_GROUP.q;

export function modpow(base: bigint, exp: bigint, mod: bigint): bigint {
	if (mod <= 0n) throw new Error('modulus must be positive');
	if (exp < 0n) throw new Error('negative exponent requires modular inverse; not supported');
	let b = ((base % mod) + mod) % mod;
	let e = exp;
	let r = 1n;
	while (e > 0n) {
		if (e & 1n) r = (r * b) % mod;
		e >>= 1n;
		b = (b * b) % mod;
	}
	return r;
}

export function randBig(bits = 256): bigint {
	const bytes = Math.ceil(bits / 8);
	const buf = new Uint8Array(bytes);
	crypto.getRandomValues(buf);
	let v = 0n;
	for (const b of buf) v = (v << 8n) | BigInt(b);
	return v;
}

/**
 * A uniform-ish exponent in [1, q). Draws 128 bits beyond the modulus so the
 * reduction bias is negligible rather than merely small.
 */
function randExponent(params: GroupParams): bigint {
	return (randBig(params.qBits + 128) % (params.q - 1n)) + 1n;
}

export interface Proof {
	t: bigint; // commitment g^r
	c: bigint; // challenge
	s: bigint; // response r + c*x
}

export interface Keypair {
	x: bigint; // secret
	y: bigint; // public g^x
}

export function newKeypair(params: GroupParams = TOY_GROUP): Keypair {
	const x = randExponent(params);
	const y = modpow(params.g, x, params.p);
	return { x, y };
}

export function commit(params: GroupParams = TOY_GROUP): { r: bigint; t: bigint } {
	const r = randExponent(params);
	const t = modpow(params.g, r, params.p);
	return { r, t };
}

export function respond(
	r: bigint,
	c: bigint,
	x: bigint,
	params: GroupParams = TOY_GROUP,
): bigint {
	const q = params.q;
	return ((((r + ((c * x) % q)) % q) + q) % q);
}

export function verify(y: bigint, proof: Proof, params: GroupParams = TOY_GROUP): boolean {
	const { g, p } = params;
	const lhs = modpow(g, proof.s, p);
	const rhs = (proof.t * modpow(y, proof.c, p)) % p;
	return lhs === rhs;
}

/** Sample a challenge the way an interactive verifier would. */
export function randomChallenge(params: GroupParams = TOY_GROUP): bigint {
	return randExponent(params);
}

// Fiat-Shamir: derive the challenge as H(g || p || y || t) instead of letting
// the verifier pick it. Turns the interactive sigma protocol into a
// non-interactive zero-knowledge proof.
export async function fiatShamirChallenge(
	y: bigint,
	t: bigint,
	params: GroupParams = TOY_GROUP,
): Promise<bigint> {
	const payload = new TextEncoder().encode(
		[params.g.toString(16), params.p.toString(16), y.toString(16), t.toString(16)].join('|'),
	);
	const digest = await crypto.subtle.digest('SHA-256', payload);
	const arr = new Uint8Array(digest);
	let v = 0n;
	for (const b of arr) v = (v << 8n) | BigInt(b);
	return v % params.q;
}

// helper for the UI: shortened hex
export function shortHex(b: bigint, keep = 10): string {
	const s = b.toString(16);
	if (s.length <= keep * 2 + 1) return '0x' + s;
	return '0x' + s.slice(0, keep) + '…' + s.slice(-keep);
}

export function fullHex(b: bigint): string {
	return '0x' + b.toString(16);
}
