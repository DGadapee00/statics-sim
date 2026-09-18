const loaders = {
  vectors: () => import('./vectors.js'),
  truss: () => import('./truss.js'),
};

const cache = new Map();

export function hasLab(id) {
  return !!loaders[id];
}

export async function loadLab(id) {
  if (cache.has(id)) return cache.get(id);
  const loader = loaders[id];
  if (!loader) return null;
  const mod = await loader();
  const lab = mod.default;
  cache.set(id, lab);
  return lab;
}

export function loadExamLabs(labIds) {
  return Promise.all(labIds.filter(hasLab).map(loadLab));
}

export function registerLabLoader(id, loader) {
  loaders[id] = loader;
}
