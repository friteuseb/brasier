// Le chevalier dessiné : les poses du squelette pixelfx, repeintes en armure, et une cape qui suit le corps.
// Les poses sont en pixels depuis les pieds, y négatif vers le haut, le personnage regarde à droite.

import { READY, posed, skeleton, hex, DUMMY_PAL } from "pixelfx";

const SWORD = { ...READY, weapon: "sword", fx: 12, fy: -21, sa: -0.85 };
const IDLE = { ...SWORD, crouch: 2 };

// la course : huit dessins, contact, appui, passage, envol, puis la même chose sur l'autre jambe
const RUN = [
  { lean: 5, crouch: 2, ffx: 10, ffy: -4, fbx: -9, fby: -8 },
  { lean: 6, crouch: 4, ffx: 5, ffy: -4, fbx: -6, fby: -12 },
  { lean: 5, crouch: 2, ffx: -1, ffy: -4, fbx: 2, fby: -13 },
  { lean: 5, crouch: 0, ffx: -7, ffy: -7, fbx: 8, fby: -9 },
  { lean: 5, crouch: 2, fbx: 10, fby: -4, ffx: -9, ffy: -8 },
  { lean: 6, crouch: 4, fbx: 5, fby: -4, ffx: -6, ffy: -12 },
  { lean: 5, crouch: 2, fbx: -1, fby: -4, ffx: 2, ffy: -13 },
  { lean: 5, crouch: 0, fbx: -7, fby: -7, ffx: 8, ffy: -9 },
].map((q, i) => {
  // le bras libre balance à l'opposé de la jambe de devant ; l'épée tressaute à peine
  const swing = Math.sin((i / 8) * Math.PI * 2);
  return { ...SWORD, ...q, fx: 11 + swing, fy: -22 - (q.crouch === 0 ? 1 : 0), bx: 1 - swing * 7, by: -17 + Math.abs(swing) * 2 };
});
const RISE = { ...SWORD, lean: 2, ffx: 6, ffy: -11, fbx: -5, fby: -6, fx: 11, fy: -26, bx: -6, by: -27 };
const APEX = { ...SWORD, lean: 1, crouch: 1, ffx: 5, ffy: -9, fbx: -4, fby: -9, fx: 12, fy: -25, bx: -7, by: -29 };
const FALL = { ...SWORD, lean: -1, ffx: 6, ffy: -5, fbx: -4, fby: -11, fx: 13, fy: -25, bx: -8, by: -31 };
const HURT = { ...SWORD, crouch: 4, lean: -5, hx: -1, fx: 6, fy: -30, sa: -1.6, bx: -11, by: -27, ffx: 9, ffy: -7, fbx: -6 };
const LAND = { ...SWORD, crouch: 7, lean: 4, ffx: 8, fbx: -8, fx: 13, fy: -16, bx: 6, by: -16 };

/** La pose du chevalier selon son état. */
export function poseFor(h) {
  if (h.special) return h.special.pose;
  if (h.attack) return h.attack.pose;
  if (h.hurtT > 0) return HURT;
  if (!h.ground) return h.vy < -80 ? RISE : h.vy < 90 ? APEX : FALL;
  if (h.landT > 0) return LAND;
  if (Math.abs(h.vx) > 12) return RUN[Math.floor(h.stride / 6) % 8];
  // à l'arrêt, il respire
  const up = Math.floor(h.time * 2) & 1;
  return { ...IDLE, crouch: IDLE.crouch + up, fy: IDLE.fy + up, by: IDLE.by + up };
}

// ---- l'armure : chaque ton du mannequin devient un ton d'acier ou de cuir
const RECOLOR = new Map(
  Object.entries({
    A: "#e6ecf6", B: "#aab8d0", C: "#72809e", D: "#4a5372", // plaques
    E: "#7a5238", F: "#55362a", G: "#36211b", // cuir et maille aux jointures
    J: "#262033", m: "#ffd84a",
  }).map(([k, v]) => [hex(DUMMY_PAL[k]) >>> 0, hex(v) >>> 0]),
);

const RUN_SPEED = 108, GRAV = 520, DRAG = 9;
const CAPE = ["#3a0e1c", "#6a1426", "#9c1e2c", "#c8323a"].map((c) => hex(c));

/** La cape : une corde de points qui pend du cou, traîne derrière la course et flotte en l'air. */
export class Cape {
  /** colors : quatre tons, du plus sombre au plus clair (la cape rouge du chevalier par défaut). */
  constructor(colors = CAPE) {
    this.colors = colors;
    this.pts = null;
    this.shown = null; // ce qu'on dessine : un relevé de la corde, renouvelé 12 fois par seconde
    this.hold = 0;
  }
  anchor(h, pose) {
    const n = skeleton(pose).joints.neck;
    return [h.x + h.face * (n[0] - 3), h.y + n[1] + 2];
  }
  step(dt, h) {
    const [ax, ay] = this.anchor(h, h.pose), N = 8, L = 3;
    if (!this.pts) this.pts = Array.from({ length: N }, (_, i) => ({ x: ax - h.face * i, y: ay + i * L, px: ax - h.face * i, py: ay + i * L }));
    const P = this.pts;
    P[0].x = P[0].px = ax;
    P[0].y = P[0].py = ay;
    // la gravité tire la cape vers le bas, l'air freine chaque point selon sa vitesse dans le monde :
    // elle pend au repos, traîne derrière la course, flotte à la chute et ondule un peu
    const run = Math.min(1, Math.abs(h.vx) / RUN_SPEED);
    for (let i = 1; i < N; i++) {
      const p = P[i], vx = (p.x - p.px) / dt, vy = (p.y - p.py) / dt;
      const flutter = Math.sin(h.time * 9 - i * 0.7) * 70 * run * (i / N);
      const axx = -DRAG * vx, ayy = GRAV - DRAG * vy + flutter;
      p.px = p.x;
      p.py = p.y;
      p.x += vx * dt * 0.998 + axx * dt * dt;
      p.y += vy * dt * 0.998 + ayy * dt * dt;
    }
    for (let k = 0; k < 4; k++)
      for (let i = 1; i < N; i++) {
        const a = P[i - 1], b = P[i], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, e = (d - L) / d;
        b.x -= dx * e;
        b.y -= dy * e;
        // elle ne remonte jamais au-dessus des épaules
        if (b.y < ay - 2) b.y = ay - 2;
      }
    // la cape se dessine comme les membres, en dessins tenus ; seul le col suit le corps à chaque image
    this.hold -= dt;
    if (!this.shown || this.hold <= 0) {
      this.hold += 1 / 12;
      if (this.hold <= 0) this.hold = 1 / 12;
      this.shown = P.map((p) => ({ dx: p.x - ax, dy: p.y - ay }));
    }
    this.at = [ax, ay];
  }
  draw(p) {
    if (!this.shown) return;
    const [ax, ay] = this.at, P = this.shown.map((q) => ({ x: ax + q.dx, y: ay + q.dy }));
    for (let i = 1; i < P.length; i++) {
      // étroite au col, plus large en bas ; le pli éclairé suit le haut du tissu
      const a = P[i - 1], b = P[i], w = 1.2 + i * 0.35;
      const K = this.colors;
      p.beam(a.x, a.y, b.x, b.y, w + 0.8, K[0]);
      p.beam(a.x, a.y, b.x, b.y, w, i < 4 ? K[2] : K[1]);
      if (i < 5) p.line(a.x, a.y - 0.5, b.x, b.y - 0.5, K[3]);
    }
  }
}

/** Peindre le chevalier dans une image, pieds en (x, y) dans le monde. */
/** recolor : les tons du mannequin vers ceux de l'armure (celle du chevalier par défaut). */
export function drawKnight(frame, h, recolor = RECOLOR) {
  // il clignote tant qu'il est protégé après un choc
  if (h.invuln > 0 && Math.floor(h.invuln * 14) % 2) return;
  const q = h.pose, r = posed(q), W = frame.w, H = frame.h, flip = h.face < 0;
  // les poses d'attaque déplacent le corps (un pas en arrière pour armer, un pas en avant pour frapper)
  const bx = Math.round(h.x + h.face * (q.x ?? 0)) - frame.ox, by = Math.round(h.y + (q.y ?? 0)) - frame.oy;
  for (let i = 0; i < r.n; i++) {
    const px = flip ? bx - r.xs[i] - 1 : bx + r.xs[i], py = by + r.ys[i];
    if (px < 0 || py < 0 || px >= W || py >= H) continue;
    frame.color[py * W + px] = recolor.get(r.color[i] >>> 0) ?? r.color[i];
  }
}

/**
 * Le chevalier vu par les effets qui entourent le corps (prière, bouclier) : la silhouette de sa pose au repos dans la
 * boîte de 24 x 38 du personnage pixelfx. Ses pixels restent vides, pour que l'effet ne repeigne pas le mannequin.
 */
let ACTOR = null;
export function knightActor() {
  if (ACTOR) return ACTOR;
  const W = 24, H = 38, data = new Uint8Array(W * H), r = posed(IDLE);
  for (let i = 0; i < r.n; i++) {
    const x = r.xs[i] + 12, y = r.ys[i] + H;
    if (x >= 0 && y >= 0 && x < W && y < H) data[y * W + x] = 1;
  }
  ACTOR = { mask: { w: W, h: H, data }, pixels: new Uint32Array(W * H), x: -12, y: -H, w: W, h: H, k: 2, head: [0, -H], chest: [0, -26] };
  return ACTOR;
}
