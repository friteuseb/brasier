// Les sons : des enregistrements CC0 de Kenney et des sons générés en local (www/sons, voir tools/sons), joués avec la Web Audio API. Chaque événement
// du jeu a plusieurs variantes tirées au hasard, avec une petite variation de hauteur, pour éviter l'effet mitraillette.
// Les sons sont placés à gauche ou à droite selon leur place à l'écran. Le navigateur n'ouvre le son qu'après une touche.

let ctx = null, master = null, muted = false;
const buffers = new Map();
let fire = null; // le crépitement des braseros, en boucle, s'il existe

const n5 = (name) => [0, 1, 2, 3, 4].map((i) => `${name}_00${i}`);
// chaque événement : des couches jouées ensemble ; chaque couche tire un fichier parmi ses variantes
// vol : volume ; rate : hauteur de base ; vary : écart de hauteur au hasard
const RECIPES = {
  step: [{ files: n5("footstep_concrete"), vol: 0.35, vary: 0.08 }],
  jump: [{ files: ["cloth1", "cloth2", "cloth3", "cloth4"], vol: 0.35, rate: 1.15, vary: 0.06 }],
  land: [
    { files: n5("footstep_concrete"), vol: 0.6, rate: 0.85 },
    { files: n5("impactPlate_light"), vol: 0.18, rate: 1.1 },
  ],
  swing: [{ files: ["swing_0", "swing_1", "swing_2"], vol: 0.7, vary: 0.05 }],
  hit: [
    { files: n5("impactPunch_medium"), vol: 0.65 },
    { files: n5("impactSoft_medium"), vol: 0.5, rate: 0.8 },
  ],
  heavyHit: [
    { files: n5("impactPunch_heavy"), vol: 0.8 },
    { files: n5("impactSoft_heavy"), vol: 0.5, rate: 0.8 },
  ],
  kill: [
    { files: ["splat_0", "splat_1", "splat_2"], vol: 0.8 },
    { files: n5("impactSoft_heavy"), vol: 0.4, rate: 0.7 },
  ],
  plop: [{ files: n5("impactSoft_medium"), vol: 0.14, rate: 1.4, vary: 0.12 }],
  ember: [{ files: ["ember_0", "ember_1", "ember_2", "ember_3"], vol: 0.35, rate: 1.1, vary: 0.12 }],
  hurt: [
    { files: n5("impactPlate_medium"), vol: 0.6 },
    { files: n5("impactPunch_medium"), vol: 0.4, rate: 0.9 },
  ],
  death: [{ files: n5("impactPlate_heavy"), vol: 0.7, rate: 0.85 }],
  fall: [{ files: n5("impactPlate_heavy"), vol: 0.35, rate: 0.7 }],
  ignite: [{ files: ["ignite"], vol: 0.9 }],
  // les coups spéciaux
  cast: [{ files: ["swing_0", "swing_1", "swing_2"], vol: 0.45, rate: 0.7 }],
  boom: [
    { files: n5("impactPunch_heavy"), vol: 0.9, rate: 0.7 },
    { files: ["ignite"], vol: 0.6, rate: 1.2 },
  ],
  smite: [
    { files: n5("impactPlate_heavy"), vol: 0.7, rate: 1.3 },
    { files: n5("impactPunch_heavy"), vol: 0.7 },
  ],
  // les attaques des monstres
  swoop: [
    { files: ["cloth1", "cloth3"], vol: 0.4, rate: 0.8 },
    { files: ["swing_0", "swing_1", "swing_2"], vol: 0.25, rate: 1.3 },
  ],
  charge: [{ files: ["ignite"], vol: 0.5, rate: 1.5 }],
  lunge: [{ files: ["swing_0", "swing_1", "swing_2"], vol: 0.35, rate: 1.5 }],
  // l'échoppe
  open: [{ files: ["ignite"], vol: 0.45, rate: 0.8 }],
  close: [{ files: ["cloth1", "cloth2"], vol: 0.35 }],
  tick: [{ files: n5("footstep_concrete"), vol: 0.2, rate: 1.6 }],
  learn: [
    { files: ["ignite"], vol: 0.7, rate: 1.1 },
    { files: n5("impactPlate_light"), vol: 0.35, rate: 1.2 },
  ],
  equip: [{ files: n5("impactPlate_light"), vol: 0.35, rate: 1.3 }],
  deny: [{ files: n5("impactSoft_medium"), vol: 0.4, rate: 0.6 }],
};
const ALL = [...new Set(Object.values(RECIPES).flatMap((r) => r.flatMap((l) => l.files))), "fire-loop"];

export function unlock() {
  if (ctx) return ctx.state === "suspended" && ctx.resume();
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.8;
  master.connect(ctx.destination);
  // chaque fichier est chargé une fois ; un fichier absent laisse simplement ce son muet
  for (const name of ALL)
    fetch(`sons/${name}.ogg`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
      .then((b) => ctx.decodeAudioData(b))
      .then((buf) => {
        buffers.set(name, buf);
        if (name === "fire-loop") startFire(buf);
      })
      .catch(() => {});
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.02);
  return muted;
}

function layer(l, pan, gain) {
  const name = l.files[Math.floor(Math.random() * l.files.length)], buf = buffers.get(name);
  if (!buf) return;
  const s = ctx.createBufferSource(), g = ctx.createGain(), p = ctx.createStereoPanner();
  s.buffer = buf;
  s.playbackRate.value = (l.rate ?? 1) * (1 + (Math.random() * 2 - 1) * (l.vary ?? 0.05));
  g.gain.value = (l.vol ?? 1) * gain;
  p.pan.value = Math.max(-1, Math.min(1, pan));
  s.connect(g).connect(p).connect(master);
  s.start();
}

/** Jouer les événements du jeu. cam : la caméra, pour placer chaque son à gauche ou à droite. */
export function play(events, cam, W) {
  if (!ctx || ctx.state !== "running") return;
  for (const e of events) {
    const recipe = RECIPES[e.type === "hit" && e.heavy ? "heavyHit" : e.type];
    if (!recipe) continue;
    // un son hors de l'écran s'éteint avec la distance
    const sx = e.x === undefined ? W / 2 : e.x - cam.x, off = Math.max(0, Math.abs(sx - W / 2) - W / 2);
    const gain = Math.max(0, 1 - off / 160);
    if (gain > 0.02) for (const l of recipe) layer(l, ((sx / W) * 2 - 1) * 0.7, gain);
  }
}

function startFire(buf) {
  const s = ctx.createBufferSource(), g = ctx.createGain();
  s.buffer = buf;
  s.loop = true;
  g.gain.value = 0;
  s.connect(g).connect(master);
  s.start();
  fire = g;
}

/** level : 0 loin de tout feu, 1 tout près d'un brasero allumé. */
export function fireLevel(level) {
  if (fire) fire.gain.setTargetAtTime(level * 0.5, ctx.currentTime, 0.25);
}
