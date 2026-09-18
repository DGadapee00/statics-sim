/**
 * View pool stub.
 *
 * In FLUX this pooled the charge, field-line and flux-patch views that several labs shared. The
 * statics labs each build and own their scene objects in init(), so nothing is pooled here — but
 * the shell still calls hideAll() on a lab switch, and a lab may reach for ctx.pool defensively.
 */
const noop = () => {};
const view = {
  setVisible: noop,
  sync: noop,
  clear: noop,
  update: noop,
  rebuild: () => ({ pieces: [] }),
};

export function createViewPool() {
  return new Proxy(
    { hideAll: noop },
    {
      get: (target, key) => (key in target ? target[key] : () => view),
    },
  );
}
