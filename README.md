# TRUSS — Statics

Interactive 3D labs and a generated problem bank for Calculus-Based Statics (Hibbeler Ch 2–10).
One app at http://localhost:5174/ — units in the top row, labs as tabs, hash URLs so each lab is
bookmarkable (`#/u3/truss`).

Built on the engine from [flux-phy2049](https://github.com/DGadapee00/flux-phy2049): the problem
generator, spaced review, symbols-before-numbers input and the typeset panels are the same code;
the physics and the labs are new.

## Open it in a browser

`npm run build` turns the app into a plain folder of files that any static host can serve, which
makes TRUSS a link instead of an install — no Git, no Node, no terminal on the other end. Deep links
survive the move: `#/u3/truss`, or a single problem at `#/u3/truss?p=ch6.truss-joints&s=0`.

Nothing is published yet. **[DEPLOY.md](DEPLOY.md)** has the three routes and what each one exposes —
the build carries Hibbeler's numbers and printed answers, so read that section before hosting it
somewhere open.

## Run it locally

```bash
git clone https://github.com/DGadapee00/statics-sim.git
cd statics-sim
npm install
npm start
```

Opens at http://localhost:5174/

```bash
npm test    # statics self-test (no browser) + the problem-bank check
```

## What makes this worth using

Statics gives you a free second opinion that most subjects do not: **ΣF = 0 and ΣM = 0 hold about
every point**. So the labs do not only report an answer, they report the residual — the equilibrium
equations re-evaluated with the solved forces. When you close a joint by hand and your numbers
agree, that residual is what agreed with you.

The self-test uses the same idea. Nothing is checked against itself:

- the parallelogram rule against adding components, and against the law of cosines
- `r × F` against `F·d` with the perpendicular distance worked out geometrically
- a couple's moment computed about two unrelated points
- the method of joints against the method of sections, and against a hand solution at one joint
- zero-force members found by the two rules, then confirmed by the full solver
- shear and moment diagrams against `dM/dx = V`, and `M_max = wL²/8` for a uniform load
- centroids by composite parts against direct integration; Pappus against the known sphere and torus
- the parallel-axis theorem against `bh³/3`, and a rectangle split in two against the whole

`npm test` runs 81 of these plus the problem-bank check.

## Labs

| Unit | Hash | Labs |
|---|---|---|
| 1 · Force vectors (Ch 2) | `#/u1/vectors` | Vectors |
| 2 · Equilibrium & moments (Ch 3–4) | `#/u2` | *coming* |
| 3 · Rigid bodies & trusses (Ch 5–6) | `#/u3/truss` | Truss |
| 4 · Internal loads, centroids, MOI (Ch 7–10) | `#/u4` | *coming* |

- **Vectors** (`#/u1/vectors`) — two 3D forces and their resultant, with components, magnitudes and
  the coordinate direction angles. The panel shows cos²α + cos²β + cos²γ live, which is the cheapest
  error check in Chapter 2.
- **Truss** (`#/u3/truss`) — the method of joints solved as one linear system. Members are coloured
  by tension (blue) and compression (red) and labelled with their force; zero-force members are
  marked; supports, reactions and applied loads are drawn. The panel reports m + r vs 2j, every
  reaction, and the worst joint residual. Four scenarios including a Pratt truss and a zero-force
  case.

The physics for every other chapter is written and tested (`src/physics/`) — particle equilibrium in
2D and 3D, moments about points and axes, rigid-body reactions, distributed loads, internal N/V/M,
centroids, Pappus–Guldinus and moments of inertia — so those labs are scene work, not new physics.

## Practice

Press **P** for the problem bank: 22 generated problems across Ch 2–10, grouped by chapter, each
with fresh numbers every attempt. Problems that have a lab load their own setup into it, and the
lab's answer is compared with the problem's — 2010 such comparisons run in `npm test`.

Numeric answers, multiple choice, and typed formulas with a live units check. Where a problem has
both, the numeric boxes stay locked until the formula is right.

Progress is stored in this browser only.
