// Les sons, synthétisés avec la Web Audio API : pas de fichier, comme les images. Chaque son est une petite recette de
// bruit filtré et d'oscillateurs avec une enveloppe. Le jeu émet des événements, play() les joue, panoramiqués selon
// leur place à l'écran. Le navigateur n'ouvre le son qu'après une première touche.

let ctx = null, master = null, noise = null, muted = false;
let fire = null; // le crépitement des braseros, en continu

export function unlock() {
  if (ctx) return ctx.state === "suspended" && ctx.resume();
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.55;
  // un compresseur doux évite que plusieurs impacts à la fois saturent
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  startFire();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.55, ctx.currentTime, 0.02);
  return muted;
}

// ---- briques
const now = () => ctx.currentTime;
function out(pan = 0, gain = 1) {
  const g = ctx.createGain(), p = ctx.createStereoPanner();
  g.gain.value = gain;
  p.pan.value = Math.max(-1, Math.min(1, pan));
  g.connect(p).connect(master);
  return g;
}
// une enveloppe : montée en a secondes jusqu'à v, puis descente exponentielle jusqu'à t
function env(param, t0, a, v, t) {
  param.setValueAtTime(0.0001, t0);
  param.linearRampToValueAtTime(v, t0 + a);
  param.exponentialRampToValueAtTime(0.0001, t0 + t);
}
function burst(dest, { t0 = now(), dur = 0.2, a = 0.005, v = 1, type = "bandpass", f0 = 1000, f1 = f0, q = 1, rate = 1 }) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noise;
  s.playbackRate.value = rate;
  s.loop = true;
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t0);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  env(g.gain, t0, a, v, dur);
  s.connect(f).connect(g).connect(dest);
  s.start(t0, Math.random() * 0.5);
  s.stop(t0 + dur + 0.05);
}
function tone(dest, { t0 = now(), dur = 0.2, a = 0.005, v = 1, type = "sine", f0 = 440, f1 = f0 }) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  env(g.gain, t0, a, v, dur);
  o.connect(g).connect(dest);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}
const jitter = (v, k = 0.08) => v * (1 + (Math.random() * 2 - 1) * k);

// ---- les recettes
const SOUNDS = {
  // l'épée fend l'air : un souffle qui monte puis retombe, plus grave pour le coup final
  swing(o, e) {
    const low = e.n === 2 ? 0.6 : e.n === 1 ? 0.85 : 1;
    burst(o, { dur: 0.22, a: 0.03, v: 0.5, f0: 500 * low, f1: 2600 * low, q: 1.4 });
    burst(o, { t0: now() + 0.08, dur: 0.16, v: 0.3, f0: 2400 * low, f1: 700 * low, q: 1.2 });
  },
  // l'impact : un coup sourd, un claquement, un tintement d'acier
  hit(o, e) {
    const heavy = e.heavy ? 1.5 : 1;
    tone(o, { dur: 0.16 * heavy, v: 0.9, f0: 150, f1: 45 });
    burst(o, { dur: 0.06, v: 0.7, type: "highpass", f0: 2500, f1: 1200 });
    tone(o, { dur: 0.25, v: 0.12, type: "triangle", f0: jitter(2900), f1: jitter(2700) });
    // le slime, lui, fait « splotch »
    burst(o, { t0: now() + 0.01, dur: 0.18, v: 0.5, type: "lowpass", f0: 1400, f1: 250, q: 6 });
  },
  kill(o) {
    burst(o, { dur: 0.45, v: 0.7, type: "lowpass", f0: 1800, f1: 160, q: 8 });
    for (let i = 0; i < 5; i++) tone(o, { t0: now() + 0.05 + i * 0.05, dur: 0.07, v: 0.25, f0: jitter(500 + i * 90, 0.2), f1: jitter(260, 0.2) });
  },
  // une braise ramassée : un tintement qui monte quand elles arrivent en série
  ember(o, e) {
    const f = 880 * Math.pow(2, (e.streak % 12) / 12);
    tone(o, { dur: 0.12, v: 0.22, type: "triangle", f0: f, f1: f * 1.02 });
    tone(o, { t0: now() + 0.03, dur: 0.1, v: 0.1, type: "sine", f0: f * 2 });
  },
  ignite(o) {
    burst(o, { dur: 0.9, a: 0.15, v: 0.8, f0: 200, f1: 3000, q: 0.8 });
    tone(o, { dur: 1.2, a: 0.05, v: 0.5, f0: 70, f1: 40 });
    for (let i = 0; i < 12; i++) burst(o, { t0: now() + 0.2 + Math.random() * 0.9, dur: 0.02, v: 0.4, type: "highpass", f0: 3000 });
  },
  jump(o) {
    burst(o, { dur: 0.12, v: 0.25, type: "lowpass", f0: 900, f1: 2200 });
  },
  land(o, e) {
    const k = Math.min(1, e.speed / 400);
    burst(o, { dur: 0.12, v: 0.3 + 0.5 * k, type: "lowpass", f0: 600, f1: 120 });
    tone(o, { dur: 0.1, v: 0.3 * k, f0: 110, f1: 50 });
    tone(o, { t0: now() + 0.01, dur: 0.12, v: 0.06, type: "triangle", f0: jitter(3300) });
  },
  // un pas sur la pierre, et l'armure qui tinte un peu
  step(o) {
    burst(o, { dur: 0.05, v: 0.22, type: "lowpass", f0: jitter(1100, 0.2), f1: 300 });
    if (Math.random() < 0.5) tone(o, { dur: 0.06, v: 0.035, type: "triangle", f0: jitter(3800, 0.1) });
  },
  hurt(o) {
    tone(o, { dur: 0.3, v: 0.5, type: "sawtooth", f0: 320, f1: 110 });
    burst(o, { dur: 0.15, v: 0.5, type: "bandpass", f0: 1800, f1: 600, q: 2 });
  },
  fall(o) {
    tone(o, { dur: 0.6, v: 0.3, type: "triangle", f0: 600, f1: 120 });
  },
  death(o) {
    for (let i = 0; i < 3; i++) tone(o, { t0: now() + i * 0.18, dur: 0.3, v: 0.35, type: "triangle", f0: 440 / Math.pow(1.26, i), f1: 400 / Math.pow(1.26, i) });
  },
  // un slime retombe de son saut : un « plop » discret
  plop(o) {
    tone(o, { dur: 0.08, v: 0.15, f0: jitter(260, 0.15), f1: 90 });
    burst(o, { dur: 0.06, v: 0.08, type: "lowpass", f0: 900, f1: 300, q: 4 });
  },
};

const VOLUME = { step: 0.6, plop: 0.5, ember: 0.8 };

/** Jouer les événements du jeu. cam : la caméra, pour placer chaque son à gauche ou à droite. */
export function play(events, cam, W) {
  if (!ctx || ctx.state !== "running") return;
  for (const e of events) {
    const fn = SOUNDS[e.type];
    if (!fn) continue;
    // un son hors de l'écran s'éteint avec la distance
    const sx = e.x === undefined ? W / 2 : e.x - cam.x, off = Math.max(0, Math.abs(sx - W / 2) - W / 2);
    const gain = (VOLUME[e.type] ?? 1) * Math.max(0, 1 - off / 160);
    if (gain > 0.02) fn(out((sx / W) * 2 - 1, gain), e);
  }
}

// ---- les braseros crépitent : un souffle continu et des craquements, plus forts près d'un feu allumé
function startFire() {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noise;
  s.loop = true;
  s.playbackRate.value = 0.5;
  f.type = "lowpass";
  f.frequency.value = 500;
  g.gain.value = 0;
  s.connect(f).connect(g).connect(master);
  s.start();
  fire = { g, level: 0, next: 0 };
}

/** level : 0 loin de tout feu, 1 tout près d'un brasero allumé. */
export function fireLevel(level) {
  if (!fire) return;
  fire.level = level;
  fire.g.gain.setTargetAtTime(level * 0.35, now(), 0.2);
  // des craquements au hasard, d'autant plus fréquents qu'on est près
  if (level > 0.05 && now() > fire.next) {
    const o = out((Math.random() - 0.5) * 0.6, level);
    burst(o, { dur: 0.015 + Math.random() * 0.02, v: 0.5 + Math.random() * 0.5, type: "highpass", f0: 1800 + Math.random() * 2500 });
    fire.next = now() + 0.04 + Math.random() * 0.25 / level;
  }
}
