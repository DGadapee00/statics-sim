/** Course map for Statics. `labs` are implemented; `coming` is the rest of that unit. */

export const EXAMS = [
  {
    id: 'u1',
    n: 1,
    title: 'Force vectors',
    chapters: '2',
    date: 'Ch 2',
    labs: ['vectors'],
    coming: [],
  },
  {
    id: 'u2',
    n: 2,
    title: 'Equilibrium & moments',
    chapters: '3–4',
    date: 'Ch 3–4',
    labs: ['particle', 'moments'],
    coming: [],
  },
  {
    id: 'u3',
    n: 3,
    title: 'Rigid bodies & trusses',
    chapters: '5–6',
    date: 'Ch 5–6',
    labs: ['truss', 'frame'],
    coming: [],
  },
  {
    id: 'u4',
    n: 4,
    title: 'Internal loads, centroids, MOI',
    chapters: '7, 9–10',
    date: 'Ch 7–10',
    labs: ['beam', 'sections'],
    coming: [],
  },
];

export const LAB_META = {
  vectors: { id: 'vectors', exam: 'u1', title: 'Vectors' },
  particle: { id: 'particle', exam: 'u2', title: 'Particle' },
  moments: { id: 'moments', exam: 'u2', title: 'Moments' },
  truss: { id: 'truss', exam: 'u3', title: 'Truss' },
  frame: { id: 'frame', exam: 'u3', title: 'Frame' },
  beam: { id: 'beam', exam: 'u4', title: 'Beam' },
  sections: { id: 'sections', exam: 'u4', title: 'Sections' },
};

export const CHAPTER_TITLES = {
  2: 'Force vectors',
  3: 'Particle equilibrium',
  4: 'Moments',
  5: 'Rigid-body equilibrium',
  6: 'Trusses, frames & machines',
  7: 'Internal loads',
  9: 'Centroids',
  10: 'Moments of inertia',
};

export function examById(id) {
  return EXAMS.find((e) => e.id === id) || EXAMS[0];
}

export function examForLab(labId) {
  const meta = LAB_META[labId];
  return meta ? examById(meta.exam) : EXAMS[0];
}

export function examIndex(id) {
  const i = EXAMS.findIndex((e) => e.id === id);
  return i < 0 ? 0 : i;
}
