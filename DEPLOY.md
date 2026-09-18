# Putting TRUSS behind a link

The app is a static site. `npm run build` writes a `dist/` folder of plain HTML, JS and CSS —
no server, no database, no Node on the other end. Anything that can serve a folder can host it,
and then the app is a URL: your group opens it on a laptop, a Chromebook, a phone, a library
machine, with nothing installed and no terminal.

```bash
npm run build     # writes dist/ (~2.1 MB)
npm run preview   # serves dist/ at http://localhost:4173 to check it first
```

`vite.config.js` sets `base: './'`, so the build works at the root of a domain or in a
subfolder (`.../statics-sim/`) without changing anything. Routing is hash-based
(`#/u3/truss`), so there is no server rewrite rule to configure — deep links to a lab
or to a single problem (`#/u3/truss?p=ch6.truss-joints&s=0`) work as-is.

## Before you publish: what goes public

The bank's problems are generated from our own templates, but their ground-truth `cases`
carry numbers and printed answers taken from Hibbeler's problem sets — a copyrighted
textbook. Hosting the build puts the *rendered* version of those numbers and answers on
the open internet, where anyone with the URL can read them. Keep the audience to the study
group; option 3 is the only route that enforces that rather than asking politely.

`public/robots.txt` and `public/_headers` ship with the build and ask search engines to
skip the site, so it will not turn up in a Google search for a problem's wording. That is
a courtesy, not a lock. If you want an actual lock, use option 3.

## Option 1 — Netlify Drop (fastest, ~2 minutes, unlisted URL)

No account strictly required, but make a free one or the site expires after 7 days.

1. `npm run build`
2. Open <https://app.netlify.com/drop>
3. Drag the `dist` folder onto the page
4. You get a URL like `https://splendid-tarsier-1a2b3c.netlify.app` — that is the link you send

To update it later: rebuild and drag `dist` again onto the same site's *Deploys* tab.
Rename the site under Site configuration → Change site name if you want something typeable.

Good for: getting the group unblocked today. The URL is public but unguessable, and the
site is marked noindex.

## Option 2 — GitHub Pages (automatic on every push)

`.github/workflows/pages.yml` is already in the repo. Turn it on at
**Settings → Pages → Build and deployment → Source: GitHub Actions**, then push to `main`.
Every push rebuilds and republishes; the URL is
`https://dgadapee00.github.io/statics-sim/`.

Two caveats:

- **Plan.** Publishing Pages from a *private* repository needs GitHub Pro. On the free plan
  the repo has to be public for Pages to work — which would put the source, including every
  worksheet-derived `case`, on the open internet. That is the thing we agreed not to do.
- **Visibility.** Even on Pro, the *site* is public; only the source stays private. Private
  Pages sites (viewable only by collaborators) are an Enterprise feature.

Good for: never thinking about deployment again, if the repo goes Pro.

## Option 3 — Cloudflare Pages + Access (free, and actually gated)

The only free route that keeps the site to named people. Cloudflare Zero Trust allows up to
50 users at no cost.

1. Build, and upload `dist` at <https://dash.cloudflare.com> → Workers & Pages → Create →
   Pages → Upload assets. (Or connect the repo and let it run `npm run build` with output
   directory `dist`.)
2. In the same dashboard: Zero Trust → Access → Applications → Add a self-hosted
   application, pointed at the `*.pages.dev` hostname.
3. Policy: *Allow* → include → **Emails** → paste your group's addresses.

Visitors get a one-time code emailed to them, then the app. Anyone else gets a wall.

Good for: sharing a build that contains the textbook's numbers without putting them
where the whole internet can read them.

## After it's live

- **Progress doesn't follow the move.** Mastery is stored in `localStorage` under
  `flux.problems.v1`, which is per-origin. Your work at `localhost:5174` stays there; the
  hosted site starts everyone at zero. That is fine for the group — just don't expect your
  own streak to appear.
- **Fonts come from Google.** `index.html` pulls Inter and JetBrains Mono from
  `fonts.googleapis.com`. On a network that blocks it the app still works, just in fallback
  type. Vendoring the two fonts into `public/` would remove the dependency.
- **Updating means rebuilding.** The hosted copy is a snapshot. New problems or labs reach
  the group only after another build and upload (or, on option 2, another push).
- **Phones work** but the labs assume a pointer and a fair amount of screen. Tablet and up
  is the honest floor.
