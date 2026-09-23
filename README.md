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
- a cantilever's internal moment against the right-hand segment, which needs no reactions at all
- the frame solver against a two-force-member argument (A-frame), `ΣM_A` on a boom (bracket), and
  the lever rule `N = Pb/a` for a pair of pliers — a machine with no supports

`npm test` runs 101 of these plus the problem-bank check.

## Labs

| Unit | Hash | Labs |
|---|---|---|
| 1 · Force vectors (Ch 2) | `#/u1/vectors` | Vectors |
| 2 · Equilibrium & moments (Ch 3–4) | `#/u2/particle` | Particle, Moments |
| 3 · Rigid bodies & trusses (Ch 5–6) | `#/u3/truss` | Truss, Frame |
| 4 · Internal loads, centroids, MOI (Ch 7–10) | `#/u4/beam` | Beam, Sections |

- **Vectors** (`#/u1/vectors`) — two 3D forces and their resultant, with components, magnitudes and
  the coordinate direction angles. The panel shows cos²α + cos²β + cos²γ live, which is the cheapest
  error check in Chapter 2.
- **Particle** (`#/u2/particle`) — a ring on two cables, a spring with a horizontal cable, and three
  cables in 3D. The unknown tensions are solved from ΣF = 0 and drawn on the free-body diagram, and
  the same forces are laid tip to tail beside it: the force polygon closes exactly when the ring is in
  equilibrium. A cable that would have to push is drawn red and called out, and the spring case turns
  the force into a stretch with Hooke's law.
- **Moments** (`#/u2/moments`) — a force about a point, worked as `xF_y − yF_x` and as `F·d` side by
  side with the moment arm drawn; a slider slides the force along its own line of action and the
  moment does not move. A couple whose moment point you can drag anywhere, with the two separate
  moments changing and their sum fixed. And `r × F` in 3D, checked against `M·F = 0` and `M·r = 0`,
  with an optional axis to project onto.
- **Truss** (`#/u3/truss`) — the method of joints solved as one linear system. Members are coloured
  by tension (blue) and compression (red) and labelled with their force; zero-force members are
  marked; supports, reactions and applied loads are drawn. The panel reports m + r vs 2j, every
  reaction, and the worst joint residual. Four scenarios including a Pratt truss and a zero-force
  case.
- **Frame** (`#/u3/frame`) — frames and machines, every member with its own three equations and
  Newton's third law at each pin. An **explode** slider pulls the assembly apart into one free body
  per member: the pin forces appear as equal and opposite pairs, and vanish again when it closes.
  Two-force members are spotted and drawn with their line of action. An A-frame loaded on one leg
  and on both, a wall bracket, and a pair of pliers (a machine — no supports, just a mechanical
  advantage).
- **Beam** (`#/u4/beam`) — Ch 5 reactions and Ch 7 internal loads on one beam, with the shear and
  moment diagrams stacked underneath on the same x axis and one cut running through all three. The
  left segment becomes a free body with N, V and M drawn on the cut face; the panel checks M at the
  cut against `∫V dx` (plus any couple jumps) and finds `|M|_max` where V crosses zero. Simple,
  cantilever and overhanging beams; point, uniform, triangular loads and applied couples.
- **Sections** (`#/u4/sections`) — centroids and moments of inertia by composite parts, with the
  exam table (A, x̃, ỹ, Ax̃, Aỹ — then Ī, d, Ad²) filled in live beside the shape. Holes are parts
  with negative area. In the inertia view the centroidal axis and each part's `d` are drawn, and
  the panel checks `I_base` against `Ī + Aȳ²`. L, T, I-beam, plate with a hole, and composites with
  a triangle and a semicircle.

On a phone the panels become one bottom sheet with an **Explain** button that swaps the setup for
the equations, the live values and the explainer; the camera backs off to keep each lab in frame.

## Practice

Press **P** for the problem bank: 27 generated problems across Ch 2–10, grouped by chapter, each
with fresh numbers every attempt. Problems that have a lab load their own setup into it, and the
lab's answer is compared with the problem's — 3237 such comparisons run in `npm test`. Every
chapter's problems now drive a lab except Pappus and the truss-determinacy question.

Numeric answers, multiple choice, and typed formulas with a live units check. Where a problem has
both, the numeric boxes stay locked until the formula is right.

Progress is stored in this browser only.
