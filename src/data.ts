// data.ts — comparison corpus for zk-SNARK vs zk-STARK.
// Figures are representative orders of magnitude for typical modern systems
// (e.g. Groth16 / PLONK-family SNARKs vs FRI-based STARKs). Exact numbers vary
// by circuit, curve, field, and parameter choice.

export type Winner = 'snark' | 'stark' | 'tie';

export interface Dimension {
	id: string;
	label: string;
	snark: string; // SNARK value
	stark: string; // STARK value
	winner: Winner; // who is generally favoured on this axis
	detail: string; // one-line explanation
}

export const DIMENSIONS: Dimension[] = [
	{
		id: 'proof-size',
		label: 'Proof size',
		snark: '~200 B \u2013 1.5 KB',
		stark: '~40 \u2013 200 KB',
		winner: 'snark',
		detail: 'SNARKs produce tiny, near-constant-size proofs. STARK proofs are far larger and grow polylogarithmically with the computation.',
	},
	{
		id: 'verify-time',
		label: 'Verifier time',
		snark: 'near-constant; can be slower per proof',
		stark: 'polylogarithmic; often fast',
		winner: 'tie',
		detail: 'Highly circuit-dependent. SNARK verification is near-constant (a few pairings) but some benchmarks find it slower per proof than STARK verification, which is polylogarithmic. Neither universally wins.',
	},
	{
		id: 'prove-time',
		label: 'Prover time / scalability',
		snark: 'fast on small circuits; setup-bound',
		stark: 'scales quasi-linearly; parallelisable',
		winner: 'stark',
		detail: 'On small circuits SNARK proving can be faster, but STARK provers scale quasi-linearly and parallelise well, winning decisively on very large computations.',
	},
	{
		id: 'trusted-setup',
		label: 'Trusted setup',
		snark: 'usually required',
		stark: 'none (transparent)',
		winner: 'stark',
		detail: 'Most SNARKs need a trusted setup ceremony (toxic waste risk). STARKs are transparent \u2014 only public randomness.',
	},
	{
		id: 'pq-security',
		label: 'Post-quantum security',
		snark: 'usually NOT pq-secure',
		stark: 'plausibly pq-secure',
		winner: 'stark',
		detail: 'Pairing-based SNARKs break under quantum attack. STARKs rely only on collision-resistant hashes, believed quantum-resistant.',
	},
	{
		id: 'assumptions',
		label: 'Cryptographic assumptions',
		snark: 'elliptic-curve pairings',
		stark: 'hash functions only',
		winner: 'stark',
		detail: 'Fewer and more conservative assumptions for STARKs; SNARKs lean on stronger, structured algebraic assumptions.',
	},
	{
		id: 'maturity',
		label: 'Tooling & ecosystem',
		snark: 'very mature, widely deployed',
		stark: 'newer, growing fast',
		winner: 'snark',
		detail: 'SNARKs have years of production use (Zcash, many rollups) and rich tooling; STARK tooling is younger but expanding.',
	},
	{
		id: 'onchain-cost',
		label: 'On-chain footprint',
		snark: 'cheap to store/verify',
		stark: 'larger calldata cost',
		winner: 'snark',
		detail: 'Small SNARK proofs are cheap to post and verify on-chain; large STARK proofs cost more in calldata unless wrapped.',
	},
];

export interface ZkSystem {
	name: string;
	type: 'SNARK' | 'STARK';
	setup: string;
	pq: 'no' | 'plausible';
	note: string;
}

export const SYSTEMS: ZkSystem[] = [
	{ name: 'Groth16', type: 'SNARK', setup: 'per-circuit trusted setup', pq: 'no', note: 'Smallest proofs (~128\u2013192 B), fastest verify; setup must be redone per circuit.' },
	{ name: 'PLONK', type: 'SNARK', setup: 'universal trusted setup', pq: 'no', note: 'One universal setup reusable across circuits; slightly larger proofs than Groth16.' },
	{ name: 'Halo2', type: 'SNARK', setup: 'no trusted setup (IPA)', pq: 'no', note: 'Recursive-friendly SNARK avoiding a trusted setup via inner-product arguments; still pairing/EC-based.' },
	{ name: 'FRI-based STARK', type: 'STARK', setup: 'transparent (none)', pq: 'plausible', note: 'Hash-based proofs via FRI; transparent and plausibly post-quantum, at the cost of larger proofs.' },
	{ name: 'Plonky2', type: 'STARK', setup: 'transparent (none)', pq: 'plausible', note: 'STARK-style with a small recursive SNARK wrapper for fast verification; very fast prover.' },
];

// --- use-case recommender --------------------------------------------------
export interface UseCase {
	id: string;
	prompt: string;
	options: { label: string; weight: { snark: number; stark: number } }[];
}

export const QUESTIONS: UseCase[] = [
	{
		id: 'pq',
		prompt: 'Do you need to stay secure against future quantum computers?',
		options: [
			{ label: 'Yes \u2014 long-lived security matters', weight: { snark: 0, stark: 3 } },
			{ label: 'No \u2014 classical security is fine', weight: { snark: 2, stark: 0 } },
		],
	},
	{
		id: 'setup',
		prompt: 'Can you tolerate a trusted setup ceremony?',
		options: [
			{ label: 'No \u2014 must be transparent', weight: { snark: 0, stark: 3 } },
			{ label: 'Yes \u2014 a one-time ceremony is acceptable', weight: { snark: 2, stark: 0 } },
		],
	},
	{
		id: 'size',
		prompt: 'How important is the smallest possible proof size?',
		options: [
			{ label: 'Critical \u2014 tiny on-chain proofs', weight: { snark: 3, stark: 0 } },
			{ label: 'Not critical \u2014 larger proofs are fine', weight: { snark: 0, stark: 2 } },
		],
	},
	{
		id: 'scale',
		prompt: 'Are you proving very large computations?',
		options: [
			{ label: 'Yes \u2014 huge circuits, need scalable proving', weight: { snark: 0, stark: 3 } },
			{ label: 'No \u2014 modest circuit sizes', weight: { snark: 2, stark: 0 } },
		],
	},
	{
		id: 'maturity',
		prompt: 'Do you need a mature, battle-tested ecosystem today?',
		options: [
			{ label: 'Yes \u2014 production tooling now', weight: { snark: 2, stark: 0 } },
			{ label: 'No \u2014 comfortable with newer tools', weight: { snark: 0, stark: 1 } },
		],
	},
];

export interface SharedTrait {
	title: string;
	body: string;
}

export const SHARED: SharedTrait[] = [
	{
		title: 'Both are zero-knowledge',
		body: 'A verifier learns only that a statement is true \u2014 nothing about the secret witness behind it.',
	},
	{
		title: 'Both are succinct',
		body: 'Verification is far cheaper than re-running the computation; that is what the "S" in each name promises.',
	},
	{
		title: 'Both are non-interactive',
		body: 'The prover sends a single proof; no back-and-forth with the verifier is needed (via Fiat\u2013Shamir).',
	},
	{
		title: 'STARK is not always zero-knowledge',
		body: 'The "ST" stands for Scalable Transparent; zero-knowledge is an optional add-on, though commonly included.',
	},
];
