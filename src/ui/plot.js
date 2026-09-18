const BLUE = '#58C4DD';
const YELLOW = '#F4D345';
const GOLD = '#F0AC5F';
const RED = '#FC6255';
const WHITE = '#ECE6E2';
const SERIF = "italic 13px KaTeX_Math, 'Latin Modern Math', 'Cambria Math', serif";

/** Resize the backing store to CSS size × DPR so strokes stay crisp; returns a context in CSS pixels. */
function setup(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = canvas.clientWidth || 300;
  const h = canvas.clientHeight || 96;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  return { ctx, w, h };
}

function axes(ctx, w, h, y0, nTicks) {
  ctx.strokeStyle = 'rgba(41,171,202,0.22)';
  ctx.lineWidth = 1;
  for (let i = 1; i < nTicks; i++) {
    const X = 12 + (i / nTicks) * (w - 24);
    ctx.beginPath();
    ctx.moveTo(X, 6);
    ctx.lineTo(X, h - 6);
    ctx.stroke();
  }
  ctx.strokeStyle = WHITE;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(12, y0);
  ctx.lineTo(w - 10, y0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w - 10, y0);
  ctx.lineTo(w - 16, y0 - 3.5);
  ctx.lineTo(w - 16, y0 + 3.5);
  ctx.closePath();
  ctx.fillStyle = WHITE;
  ctx.fill();
  for (let i = 1; i < nTicks; i++) {
    const X = 12 + (i / nTicks) * (w - 24);
    ctx.beginPath();
    ctx.moveTo(X, y0 - 3);
    ctx.lineTo(X, y0 + 3);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function dot(ctx, x, y, color) {
  ctx.beginPath();
  ctx.arc(x, y, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#0b0c0e';
  ctx.stroke();
}

export function drawVx(canvas, xs, Vs, probeX, pathAx) {
  if (!canvas) return;
  const { ctx, w, h } = setup(canvas);
  if (!Vs.length) return;
  let vmin = Math.min(...Vs, 0);
  let vmax = Math.max(...Vs, 0);
  if (vmax - vmin < 1e-6) {
    vmax += 1;
    vmin -= 1;
  }
  const xmin = xs[0];
  const xmax = xs[xs.length - 1];
  const xmap = (x) => ((x - xmin) / (xmax - xmin)) * (w - 24) + 12;
  const ymap = (v) => h - 10 - ((v - vmin) / (vmax - vmin)) * (h - 22);
  axes(ctx, w, h, ymap(0), 8);

  ctx.strokeStyle = BLUE;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 0; i < xs.length; i++) {
    const X = xmap(xs[i]);
    const Y = ymap(Vs[i]);
    if (i === 0) ctx.moveTo(X, Y);
    else ctx.lineTo(X, Y);
  }
  ctx.stroke();

  const bx = xmap(probeX);
  const by = ymap(Vs[nearest(xs, probeX)]);
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = 'rgba(236,230,226,0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx, ymap(0));
  ctx.stroke();
  ctx.setLineDash([]);
  dot(ctx, bx, by, YELLOW);
  if (pathAx != null) dot(ctx, xmap(pathAx), ymap(Vs[nearest(xs, pathAx)]), GOLD);

  ctx.fillStyle = WHITE;
  ctx.font = SERIF;
  ctx.fillText('V(x)', 14, 16);
}

export function drawAC(canvas, pwr, t) {
  if (!canvas) return;
  const { ctx, w, h } = setup(canvas);
  const Vp = pwr.Vrms * Math.SQRT2;
  const Ip = Vp / pwr.R;
  const f = pwr.f;
  const T = 1 / f;
  const n = 120;
  axes(ctx, w, h, h / 2, 8);

  const curve = (color, fn) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const tt = t - T + (i / n) * T;
      const X = 12 + (i / n) * (w - 24);
      const Y = h / 2 - fn(tt) * (h / 2 - 12);
      if (i === 0) ctx.moveTo(X, Y);
      else ctx.lineTo(X, Y);
    }
    ctx.stroke();
  };
  curve(BLUE, (tt) => Math.sin(2 * Math.PI * f * tt));
  curve(RED, (tt) => {
    const s = Math.sin(2 * Math.PI * f * tt);
    return (Ip * Vp * s * s) / (Ip * Vp || 1);
  });

  // P_avg = half the peak of P(t)
  const yAvg = h / 2 - 0.5 * (h / 2 - 12);
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = RED;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(12, yAvg);
  ctx.lineTo(w - 12, yAvg);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  ctx.font = SERIF;
  ctx.fillStyle = BLUE;
  ctx.fillText('V(t)', 14, 16);
  ctx.fillStyle = RED;
  ctx.fillText('P(t)', 52, 16);
  ctx.globalAlpha = 0.8;
  ctx.fillText('P avg', w - 50, yAvg - 4);
  ctx.globalAlpha = 1;
}

/** One slow-motion cycle of v(t) (blue) and i(t) (yellow), current lagging by φ. */
export function drawVI(canvas, { omega, phi, t }) {
  if (!canvas) return;
  const { ctx, w, h } = setup(canvas);
  const f = omega / (2 * Math.PI);
  const T = 1 / f;
  const n = 120;
  axes(ctx, w, h, h / 2, 8);
  const curve = (color, fn) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const tt = t - T + (i / n) * T;
      const X = 12 + (i / n) * (w - 24);
      const Y = h / 2 - fn(tt) * (h / 2 - 12);
      if (i === 0) ctx.moveTo(X, Y);
      else ctx.lineTo(X, Y);
    }
    ctx.stroke();
  };
  curve(BLUE, (tt) => Math.sin(omega * tt));
  curve(YELLOW, (tt) => Math.sin(omega * tt - phi));
  ctx.font = SERIF;
  ctx.fillStyle = BLUE;
  ctx.fillText('V(t)', 14, 16);
  ctx.fillStyle = YELLOW;
  ctx.fillText('I(t)', 52, 16);
}

function nearest(xs, x) {
  let best = 0;
  let d = Infinity;
  for (let i = 0; i < xs.length; i++) {
    const dd = Math.abs(xs[i] - x);
    if (dd < d) {
      d = dd;
      best = i;
    }
  }
  return best;
}
