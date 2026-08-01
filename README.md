# crypto-lab-zk-arena

[![Deploy to GitHub Pages](https://github.com/systemslibrarian/crypto-lab-zk-arena/actions/workflows/deploy.yml/badge.svg)](https://github.com/systemslibrarian/crypto-lab-zk-arena/actions/workflows/deploy.yml)
[![Live demo](https://img.shields.io/badge/live-demo-0a6f96)](https://systemslibrarian.github.io/crypto-lab-zk-arena/)
[![No deps](https://img.shields.io/badge/runtime%20deps-0-c68b1a)](./package.json)
[![Lighthouse: Performance 97](https://img.shields.io/badge/Lighthouse-Performance%2097-1e6f3a)](#audited)
[![Lighthouse: A11y 100](https://img.shields.io/badge/Lighthouse-A11y%20100-1e6f3a)](#audited)
[![Lighthouse: BP 100](https://img.shields.io/badge/Lighthouse-Best%20Practices%20100-1e6f3a)](#audited)
[![Lighthouse: SEO 100](https://img.shields.io/badge/Lighthouse-SEO%20100-1e6f3a)](#audited)

## What It Is

A head-to-head comparison of the two leading families of succinct zero-knowledge proof systems: zk-SNARKs and zk-STARKs. Both let a prover convince a verifier that a statement is true without revealing the secret behind it, and both verify far faster than re-running the computation — but they make opposite engineering tradeoffs. The lab opens with a plain-language primer that defines the four load-bearing terms (proof size, prover, verifier, trusted setup) before any comparison begins, then puts the two families side by side across the dimensions that actually drive a design decision (proof size, verifier and prover cost, trusted setup, post-quantum security, cryptographic assumptions, tooling maturity, and on-chain footprint). Two hands-on exhibits make the abstractions concrete: a runnable Schnorr sigma-protocol that shows what zero-knowledge and soundness actually feel like (with an honest-vs-forged toggle), and a real trusted-setup ceremony where keeping the "toxic waste" lets you forge an accepting proof of a false statement — the SNARK backdoor made experiential. An interactive recommender then weights the tradeoffs against your specific use case. The goal is not to crown a winner — neither is strictly better — but to make the tradeoff space legible, with a clear on-ramp for a newcomer and enough depth for a specialist.

## Exhibits

1. **Primer — "What even is a SNARK or a STARK?"** — plainly defines proof size, prover, verifier, and trusted setup, plus a numbered "start here" reading path so a newcomer never lands mid-page in the deep end.
2. **The Arena** — click any of eight comparison dimensions to see both families' values, who it favours, and why; full keyboard tablist navigation.
3. **Proof Sizes, To Scale** — both proofs drawn dot-for-dot at one shared byte scale, with an explicit ratio caption ("showing X KB of a Y KB proof… the SNARK is these N dots") so the size gap is unmistakable.
4. **Run a Zero-Knowledge Proof** — a live, in-browser Schnorr identification protocol (interactive and Fiat–Shamir modes) with an honest-vs-forged toggle that flips soundness on demand. Framed honestly: this teaches the *idea*, not SNARK succinctness, and the panel opens with a toy-parameter disclosure naming the composite group order and the ~19 bits of the secret it leaks.
5. **Break a Trusted Setup** — a real Pedersen-commitment ceremony; destroy the toxic waste τ and a false claim is rejected, keep it and the same commitment forges an accepted opening to a value it never held. Carries the same toy-parameter disclosure, since it runs in the same group.
6. **Pick Your Use Case** — a weighted recommender whose answers are shareable via the URL.
7. **Real Systems, Milestones, and What They Share** — Groth16, PLONK, Halo2, FRI-based STARKs, Plonky2, a short history, and common ground, with first-use glossary popovers for FRI, Merkle paths, pairings, IPA, and recursion.

## When to Use It

- **Choosing a proof system for a project** — answer the recommender's questions to see which family your priorities favour.
- **Teaching zero-knowledge tradeoffs** — show concretely why "which is better, SNARK or STARK?" has no universal answer.
- **Explaining post-quantum implications** — see why pairing-based SNARKs break under quantum attack while hash-based STARKs plausibly survive.
- **Understanding trusted setup** — clarify what a setup ceremony is, why it is a risk, and which systems avoid it.
- **Do NOT treat the figures as exact** — they are representative orders of magnitude; real numbers depend heavily on circuit, curve, field, and parameters.
- **Do NOT** use the recommender as a substitute for a real security review — it is a teaching demo, not production guidance.

## Live Demo

**[systemslibrarian.github.io/crypto-lab-zk-arena](https://systemslibrarian.github.io/crypto-lab-zk-arena/)**

The Arena lets you click any comparison dimension to see both systems' values side by side, which one it favours, and a one-line explanation. The Pick Your Use Case recommender asks about quantum security, trusted setup tolerance, proof-size sensitivity, computation scale, and ecosystem maturity, then renders a weighted SNARK-vs-STARK recommendation bar. Below that, cards cover real systems (Groth16, PLONK, Halo2, FRI-based STARKs, Plonky2) showing how the labels blur in practice, and a Common Ground section covers what both systems share — including the subtlety that a STARK is not always zero-knowledge.

## What Can Go Wrong

- **Assuming a trusted setup is harmless** — if the setup ceremony's secret ("toxic waste") is not destroyed, an attacker can forge proofs; this is the central risk many SNARKs carry and STARKs avoid.
- **Deploying a pairing-based SNARK for long-lived security** — elliptic-curve and pairing assumptions fall to a sufficiently large quantum computer, so harvest-now-decrypt-later concerns apply.
- **Posting large STARK proofs on-chain naively** — proof size drives calldata cost; STARKs are often wrapped in a small SNARK precisely to make on-chain verification cheap.
- **Confusing "transparent" with "zero-knowledge"** — STARK transparency refers to needing no trusted setup; zero-knowledge is a separate, optional property.
- **Reading one benchmark as universal** — prover and verifier times are highly circuit-dependent; a result on one workload may reverse on another.
- **Running a sigma protocol in a group whose order is not prime** — the two live exhibits do exactly that, deliberately and with the fact stated on the page. They use `g = 5` with exponents mod `p − 1` where `p` is the secp256k1 field prime, and `p − 1 = 2 · 3 · 7 · 13441 · q′` is composite. Pohlig–Hellman then recovers `x` modulo each small factor — about 19 bits — from the public key alone. Prime-order groups are a precondition of the security proof, not a stylistic preference.
- **Reading zero-knowledge as unconditional** — the simulator argument shown in the Schnorr panel establishes *honest-verifier* zero knowledge. A verifier who picks the challenge adaptively after seeing the commitment is outside what that argument covers.

## Real-World Usage

- **Zcash** — pioneered production zk-SNARKs for shielded transactions, including multi-party trusted setup ceremonies to reduce toxic-waste risk.
- **Ethereum L2 rollups** — both SNARK-based and STARK-based validity rollups compress many transactions into a single succinct proof verified on-chain.
- **STARK-based scaling** — FRI-based systems and recursive variants like Plonky2 target high-throughput proving for large computations.
- **PLONK and universal setups** — widely adopted because one universal setup can be reused across many circuits, easing the per-circuit ceremony burden of earlier SNARKs.
- **Post-quantum roadmaps** — STARKs are frequently cited as the zero-knowledge option most likely to remain secure in a post-quantum world.

## How to Run Locally

```bash
git clone https://github.com/systemslibrarian/crypto-lab-zk-arena
cd crypto-lab-zk-arena
npm install
npm run dev
```

## Related Demos

- [crypto-lab-snark-arena](https://systemslibrarian.github.io/crypto-lab-snark-arena/) — compares zk-SNARK constructions (Groth16, PLONK) and their trusted-setup tradeoffs.
- [crypto-lab-stark-tower](https://systemslibrarian.github.io/crypto-lab-stark-tower/) — transparent, post-quantum zk-STARKs built on AIR constraints and FRI.
- [crypto-lab-bulletproofs](https://systemslibrarian.github.io/crypto-lab-bulletproofs/) — short range proofs with no trusted setup via the inner-product argument.
- [crypto-lab-zk-proof-lab](https://systemslibrarian.github.io/crypto-lab-zk-proof-lab/) — interactive Schnorr, commit-reveal, and Fiat-Shamir protocol walkthroughs.
- [crypto-lab-commit-gate](https://systemslibrarian.github.io/crypto-lab-commit-gate/) — hash and Pedersen commitments demonstrating binding and hiding.

## Tech

Vite + TypeScript, zero runtime dependencies. The comparison corpus and recommender weights live in `src/data.ts`; the arena and quiz UI are plain DOM in `src/ui.ts`. The two live-crypto exhibits are real, spec-accurate, and unit-tested: the Schnorr sigma-protocol in `src/schnorr.ts` and the trusted-setup Pedersen-commitment ceremony (with the toxic-waste equivocation) in `src/trustedsetup.ts`. Dark mode by default with a persisted theme toggle that respects `prefers-color-scheme`.

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check + production build to dist/
npm run preview  # serve the production build locally
```

Deployed automatically to GitHub Pages from `main` via `.github/workflows/deploy.yml`. Every push is gated on:
unit tests → `tsc && vite build` → bundle-size budget (20 KB JS gz / 8 KB CSS gz) → Playwright E2E + axe-core a11y on Chromium → deploy.

<a id="audited"></a>
## Audited

Run locally against the preview build:

| Tool | Result |
|---|---|
| **Lighthouse Performance** | **97** (median of 3, throttled, headless) |
| **Lighthouse Accessibility** | **100** |
| **Lighthouse Best Practices** | **100** |
| **Lighthouse SEO** | **100** |
| **axe-core** (Chromium, Firefox, WebKit) | 0 violations across 49 passes per engine |
| **Vitest** | 25 / 25 passing |
| **Playwright E2E** | 16 / 16 passing |

## Accessibility

- **`axe-core` clean** across Chromium, Firefox, and WebKit — 0 violations, 49 passes per engine on WCAG 2.1 A/AA + best-practice rules.
- WCAG-AA contrast verified by computed-style sampling in both themes (5.5:1 – 18.1:1 on critical text); high-visibility focus rings.
- Semantic landmarks (`<main>`, `<header role="banner">`, `<footer role="contentinfo">`) and a working skip link.
- The dimension explorer is a proper `tablist`/`tabpanel` with arrow-key / Home / End navigation.
- The recommender is a series of `radiogroup` fieldsets with arrow-key selection and `aria-checked` state.
- Honours `prefers-reduced-motion` and `prefers-color-scheme`. 44 px+ touch targets throughout.
- Print-friendly: `@media print` rules collapse the page into a clean black-on-white teaching handout (nav, buttons, and overlays hidden; outbound link URLs expanded inline).

---

*One of 170+ browser demos in the [Crypto Lab](https://crypto-lab.systemslibrarian.dev/) suite.*

*"So whether you eat or drink or whatever you do, do it all for the glory of God." — 1 Corinthians 10:31*
