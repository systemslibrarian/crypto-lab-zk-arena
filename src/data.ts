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
	// Plonky2's own README calls it "a SNARK implementation based on techniques
	// from PLONK and FRI": PLONK-style arithmetization, FRI as the polynomial
	// commitment scheme. "STARK-style" is common shorthand for the FRI half, but
	// the family label is SNARK. It is transparent and plausibly post-quantum
	// because FRI is hash-based, not because it is a STARK.
	{ name: 'Plonky2', type: 'SNARK', setup: 'transparent (none)', pq: 'plausible', note: 'PLONK-style arithmetization with hash-based FRI commitments — a SNARK that still needs no trusted setup; recursion-friendly and very fast to prove.' },
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

export interface Milestone {
	year: number;
	title: string;
	family: 'SNARK' | 'STARK' | 'Both';
	note: string;
}

export const MILESTONES: Milestone[] = [
	{
		year: 1992,
		family: 'Both',
		title: 'PCP Theorem',
		note: 'Probabilistically checkable proofs: any NP statement can be verified by spot-checking a tiny piece of a proof — the theoretical seed of every modern succinct proof system.',
	},
	{
		year: 2013,
		family: 'SNARK',
		title: 'Pinocchio',
		note: 'First end-to-end SNARK toolchain (Parno et al.). The moment SNARKs crossed from "theoretical" to "could run on a real computer".',
	},
	{
		year: 2016,
		family: 'SNARK',
		title: 'Groth16',
		note: 'Smallest known practical SNARK proof (~128 B) and pairing-based constant-time verification. Still the gold standard for proof size.',
	},
	{
		year: 2016,
		family: 'SNARK',
		title: 'Zcash launches',
		note: 'First major production SNARK deployment (mainnet 28 October 2016), with the famous Sprout multi-party setup ceremony to dilute toxic-waste risk.',
	},
	{
		year: 2018,
		family: 'STARK',
		title: 'STARK paper',
		note: 'Ben-Sasson, Bentov, Horesh & Riabzev introduce transparent, post-quantum-plausible proofs via FRI — no trusted setup, hash functions only.',
	},
	{
		year: 2019,
		family: 'SNARK',
		title: 'PLONK',
		note: 'Universal & updatable trusted setup: one ceremony reusable across many circuits, lifting a major operational burden of earlier SNARKs.',
	},
	{
		year: 2019,
		family: 'SNARK',
		title: 'Halo',
		note: 'First recursive composition without a trusted setup (Bowe, Grigg, Hopwood). Opened the door to incrementally-verifiable computation.',
	},
	{
		year: 2022,
		family: 'SNARK',
		title: 'Plonky2',
		note: 'Polygon Zero’s recursive SNARK built from PLONK arithmetization over FRI — transparent like a STARK, but a SNARK by construction. Millisecond verification of complex statements; a high-water mark for prover throughput.',
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
