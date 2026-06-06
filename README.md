# crypto-lab-zk-arena

## What It Is

A head-to-head comparison of the two leading families of succinct zero-knowledge proof systems: zk-SNARKs and zk-STARKs. Both let a prover convince a verifier that a statement is true without revealing the secret behind it, and both verify far faster than re-running the computation — but they make opposite engineering tradeoffs. This lab puts them side by side across the dimensions that actually drive a design decision (proof size, verifier and prover cost, trusted setup, post-quantum security, cryptographic assumptions, tooling maturity, and on-chain footprint), then offers an interactive recommender that weights those tradeoffs against your specific use case. The goal is not to crown a winner — neither is strictly better — but to make the tradeoff space legible.

## When to Use It

- **Choosing a proof system for a project** — answer the recommender's questions to see which family your priorities favour.
- **Teaching zero-knowledge tradeoffs** — show concretely why "which is better, SNARK or STARK?" has no universal answer.
- **Explaining post-quantum implications** — see why pairing-based SNARKs break under quantum attack while hash-based STARKs plausibly survive.
- **Understanding trusted setup** — clarify what a setup ceremony is, why it is a risk, and which systems avoid it.
- **Do NOT treat the figures as exact** — they are representative orders of magnitude; real numbers depend heavily on circuit, curve, field, and parameters.

## Live Demo

[**https://systemslibrarian.github.io/crypto-lab-zk-arena/**](https://systemslibrarian.github.io/crypto-lab-zk-arena/)

The Arena lets you click any comparison dimension to see both systems' values side by side, which one it favours, and a one-line explanation. The Pick Your Use Case recommender asks about quantum security, trusted setup tolerance, proof-size sensitivity, computation scale, and ecosystem maturity, then renders a weighted SNARK-vs-STARK recommendation bar. Below that, cards cover real systems (Groth16, PLONK, Halo2, FRI-based STARKs, Plonky2) showing how the labels blur in practice, and a Common Ground section covers what both systems share — including the subtlety that a STARK is not always zero-knowledge.

## What Can Go Wrong

- **Assuming a trusted setup is harmless** — if the setup ceremony's secret ("toxic waste") is not destroyed, an attacker can forge proofs; this is the central risk many SNARKs carry and STARKs avoid.
- **Deploying a pairing-based SNARK for long-lived security** — elliptic-curve and pairing assumptions fall to a sufficiently large quantum computer, so harvest-now-decrypt-later concerns apply.
- **Posting large STARK proofs on-chain naively** — proof size drives calldata cost; STARKs are often wrapped in a small SNARK precisely to make on-chain verification cheap.
- **Confusing "transparent" with "zero-knowledge"** — STARK transparency refers to needing no trusted setup; zero-knowledge is a separate, optional property.
- **Reading one benchmark as universal** — prover and verifier times are highly circuit-dependent; a result on one workload may reverse on another.

## Real-World Usage

- **Zcash** — pioneered production zk-SNARKs for shielded transactions, including multi-party trusted setup ceremonies to reduce toxic-waste risk.
- **Ethereum L2 rollups** — both SNARK-based and STARK-based validity rollups compress many transactions into a single succinct proof verified on-chain.
- **STARK-based scaling** — FRI-based systems and recursive variants like Plonky2 target high-throughput proving for large computations.
- **PLONK and universal setups** — widely adopted because one universal setup can be reused across many circuits, easing the per-circuit ceremony burden of earlier SNARKs.
- **Post-quantum roadmaps** — STARKs are frequently cited as the zero-knowledge option most likely to remain secure in a post-quantum world.

## Tech

Vite + TypeScript, zero runtime dependencies. The comparison corpus and recommender weights live in `src/data.ts`; the arena and quiz UI are plain DOM in `src/ui.ts`. Dark mode by default with a persisted theme toggle that respects `prefers-color-scheme`.

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check + production build to dist/
npm run preview  # serve the production build locally
```

Deployed automatically to GitHub Pages from `main` via `.github/workflows/deploy.yml`.

## Accessibility

- WCAG-AA contrast in both themes; high-visibility focus rings.
- Semantic landmarks (`<main>`, `<header role="banner">`, `<footer role="contentinfo">`) and a working skip link.
- The dimension explorer is a proper `tablist`/`tabpanel` with arrow-key / Home / End navigation.
- The recommender is a series of `radiogroup` fieldsets with arrow-key selection and `aria-checked` state.
- Honours `prefers-reduced-motion` and `prefers-color-scheme`. 44 px+ touch targets throughout.

---

"So whether you eat or drink or whatever you do, do it all for the glory of God." — 1 Corinthians 10:31
