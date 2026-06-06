// schnorr.ts — a working Schnorr identification (sigma) protocol over a
// prime-order group, with optional Fiat-Shamir non-interactivisation.
//
// This is a real, runnable zero-knowledge proof of knowledge of the discrete
// logarithm x such that y = g^x mod p. It is the cleanest example of the
// {commit, challenge, response} structure that lies under every modern SNARK.
//
// The chosen group parameters are educational-grade: a 256-bit prime with a
// small generator. Do not use for production cryptography.

// secp256k1 field prime (well-known 256-bit prime).
export const P: bigint = (1n << 256n) - (1n << 32n) - 977n;
// Generator chosen as a small primitive-like element for the demo.
export const G: bigint = 5n;
// Group order used for exponents. Using P - 1 keeps the demo simple; a real
// Schnorr deployment would use a subgroup of prime order Q < P-1.
export const Q: bigint = P - 1n;

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

export interface Proof {
	t: bigint; // commitment g^r
	c: bigint; // challenge
	s: bigint; // response r + c*x
}

export interface Keypair {
	x: bigint; // secret
	y: bigint; // public g^x
}

export function newKeypair(): Keypair {
	const x = (randBig() % (Q - 1n)) + 1n;
	const y = modpow(G, x, P);
	return { x, y };
}

export function commit(): { r: bigint; t: bigint } {
	const r = (randBig() % (Q - 1n)) + 1n;
	const t = modpow(G, r, P);
	return { r, t };
}

export function respond(r: bigint, c: bigint, x: bigint): bigint {
	return ((r + ((c * x) % Q)) % Q + Q) % Q;
}

export function verify(y: bigint, proof: Proof): boolean {
	const lhs = modpow(G, proof.s, P);
	const rhs = (proof.t * modpow(y, proof.c, P)) % P;
	return lhs === rhs;
}

// Fiat-Shamir: derive the challenge as H(g || p || y || t) instead of letting
// the verifier pick it. Turns the interactive sigma protocol into a
// non-interactive zero-knowledge proof.
export async function fiatShamirChallenge(y: bigint, t: bigint): Promise<bigint> {
	const payload = new TextEncoder().encode(
		[G.toString(16), P.toString(16), y.toString(16), t.toString(16)].join('|'),
	);
	const digest = await crypto.subtle.digest('SHA-256', payload);
	const arr = new Uint8Array(digest);
	let v = 0n;
	for (const b of arr) v = (v << 8n) | BigInt(b);
	return v % Q;
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
