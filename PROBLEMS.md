# Problems — statics

Same authoring kit as flux-phy2049; see that repo's PROBLEMS.md for the full contract. What differs
here:

- **Constants.** The expression language provides `pi`, `g` (9.81 m/s²) and `gft` (32.2 ft/s²).
- **Units.** `src/physics/units.js` adds `lb`, `kip`, `ft`, `in` and `slug` to the dimension table,
  so a symbolic answer in lb·ft is checked against one in N·m correctly.
- **Degrees vs radians.** Problems state angles in degrees, but the expression parser's `sin` and
  `cos` take radians. A template whose symbolic key uses a trig function should derive the angle in
  radians (`thr`) and declare that as the symbol — see `ch2.parallelogram` and `ch3.spring`.
- **Symbol names.** The parser matches declared symbol names anywhere in the expression, so a symbol
  called `qe` would be found inside `sqrt`. Keep symbol names clear of `sqrt`, `sin`, `cos`, `tan`.

## Bank

| File | Chapters |
|---|---|
| `bank/ch2.js` | 2 — force vectors |
| `bank/ch34.js` | 3 particle equilibrium, 4 moments |
| `bank/ch56.js` | 5 rigid bodies, 6 trusses |
| `bank/ch7910.js` | 7 internal loads, 9 centroids, 10 moments of inertia |

22 templates, sourced from the four problem decks. `npm test` confirms each worked case, resamples
every template, and — where a problem drives a lab — compares the lab's own answer with the
problem's.
