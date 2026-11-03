// Le combo d'épée : trois coups repris des effets pixelfx (leurs poses et leurs instants d'impact), joués plus vite
// pour un jeu de plateforme. Un coup qui touche gèle le monde un instant et secoue l'image ; un coup dans le vide, non.

import { createFx, poseAt } from "pixelfx";
import * as slash from "pixelfx/fx/melee/sword-slash";
import * as double from "pixelfx/fx/melee/double-slash";
import * as cleave from "pixelfx/fx/melee/heavy-cleave";

// from : où commence l'anticipation (temps de l'effet) ; chain : à partir de quand le coup suivant peut partir ;
// end : fin du coup ; reach : la zone touchée devant lui [x0, x1, y0, y1] en px depuis ses pieds ; dmg par impact
const STROKES = [
  { mod: slash, from: -0.3, chain: 0.12, end: 0.42, speed: 1.7, reach: [0, 44, -46, 2], dmg: 1, lunge: 70 },
  { mod: double, from: -0.18, chain: 0.24, end: 0.5, speed: 1.6, reach: [0, 50, -48, 2], dmg: 1, lunge: 80 },
  { mod: cleave, from: -0.12, chain: 99, end: 0.62, speed: 1.5, reach: [-6, 58, -50, 4], dmg: 2, lunge: 110 },
];

export class Attack {
  constructor(hero, n = 0) {
    this.hero = hero;
    this.n = n;
    this.s = STROKES[n];
    this.t = this.s.from;
    this.fx = null;
    this.face = hero.face;
    this.nextHit = 0;
    this.queued = false;
    this.done = false;
  }

  /** Le coup avance ; renvoie les impacts qui tombent pendant ce pas : [{ hit, box }]. */
  step(dt, game) {
    const s = this.s, h = this.hero, t0 = this.t;
    const speed = s.speed * (h.skills?.has("elan") ? 1.2 : 1);
    this.t += dt * speed;
    if (t0 < 0 && this.t >= 0) {
      // l'effet part sur l'image de la coupe ; le chevalier s'avance d'un pas
      // la lame ardente teint les coupes de feu ; un autre porteur (le Chevalier noir) peut avoir sa propre teinte
      const fire = h.skills?.has("lame-ardente") ? { palette: FIRE } : h.slashPalette ? { palette: h.slashPalette } : {};
      this.fx = createFx(s.mod, { x: h.x, y: h.y, flip: this.face < 0, seed: 1 + this.n, ...fire });
      game.addFx(this.fx, speed);
      game.emit("swing", { x: h.x, n: this.n });
      if (h.ground) h.vx = this.face * s.lunge;
    }
    const out = [];
    const hits = s.mod.act.hits ?? [];
    for (; this.nextHit < hits.length && hits[this.nextHit].t <= this.t; this.nextHit++) {
      const hit = hits[this.nextHit];
      out.push({ box: this.box(), dmg: s.dmg, stop: hit.stop, shake: hit.shake, amp: hit.amp, push: hit.push, sword: true, stroke: this.n });
    }
    if (this.t >= s.chain && this.queued && this.n < STROKES.length - 1) this.done = "chain";
    else if (this.t >= s.end) this.done = "end";
    return out;
  }

  /** La zone touchée, dans le monde : { x0, x1, y0, y1 }. */
  box() {
    const [a, b, y0, y1] = this.s.reach, h = this.hero, f = this.face;
    return { x0: h.x + Math.min(a * f, b * f), x1: h.x + Math.max(a * f, b * f), y0: h.y + y0, y1: h.y + y1 };
  }

  get pose() {
    const q = poseAt(this.s.mod.act.poses, this.t);
    // le troisième coup prend la grande épée à deux mains dans l'effet d'origine : il garde la sienne
    return { ...q, weapon: "sword", two: false };
  }
}

const FIRE = ["#4a1712", "#8a1f17", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#ffffff"];

export const STROKE_COUNT = STROKES.length;
