// Le marchand : un mage en robe derrière son étal, sous un auvent rayé, des fioles et une bougie. C'est chez
// lui qu'on dépense ses braises (l'écran de l'arbre, src/altar.js). Il se tourne vers le chevalier et le salue.
// Le mage est le squelette pixelfx du chevalier, repeint en robe violette, un bâton à la main.

import { createFx, posed, hex, DUMMY_PAL, READY, painterFor } from "pixelfx";
import * as candle from "pixelfx/fx/fire/candle";

const C = Object.fromEntries(
  Object.entries({
    wood: "#8a5a32", woodL: "#b9884f", woodD: "#5a3820", woodK: "#2a1810",
    clothA: "#6a3c9a", clothB: "#e0b84a", clothD: "#3a1f58", clothBD: "#9a7a2a",
    shelf: "#4a3020", glassA: "#5fd0ff", glassB: "#f53cd1", glassC: "#7fe05a", cork: "#c9a06a",
  }).map(([k, v]) => [k, hex(v)]),
);
const LAMP = hex("#ffcf80");
// la robe : chaque ton du mannequin devient un violet de robe, un or de broderie ou une gemme
const ROBE = new Map(
  Object.entries({ A: "#e8d4ff", B: "#b896ec", C: "#8a68c4", D: "#5c4290", E: "#f0c860", F: "#b88a38", G: "#6e521c", J: "#2c1e48", m: "#7fe0ff" })
    .map(([k, v]) => [hex(DUMMY_PAL[k]) >>> 0, hex(v) >>> 0]),
);

// ses poses : les mains sur le comptoir, le bâton dressé ; il lève la main libre quand le chevalier arrive
const STAFF = { ...READY, weapon: "spear", fx: 9, fy: -24, sa: -1.5, bx: 12, by: -17, crouch: 1 };
const WAVE = { ...STAFF, bx: 2, by: -36, turn: 1 };
const W2 = { ...WAVE, bx: 5, by: -34 };

export class Merchant {
  constructor(x, y, seed) {
    Object.assign(this, { x, y, face: -1, greet: 0, time: 0, near: false });
    this.candle = createFx(candle, { x: x + 15, y: y - 10, seed });
  }
  /** Le chevalier est-il assez près pour marchander ? */
  reach(hero) {
    return Math.abs(hero.x - this.x) < 30 && Math.abs(hero.y - this.y) < 6;
  }
  step(dt, hero) {
    this.time += dt;
    this.candle.update(dt);
    if (Math.abs(hero.x - this.x) < 160) this.face = hero.x < this.x ? -1 : 1;
    const near = this.reach(hero);
    if (near && !this.near) this.greet = 1.1; // il salue à l'arrivée
    this.near = near;
    this.greet = Math.max(0, this.greet - dt);
  }
  get pose() {
    if (this.greet > 0) return Math.floor(this.greet * 6) % 2 ? WAVE : W2;
    const up = Math.floor(this.time * 1.5) & 1; // il respire
    return { ...STAFF, crouch: STAFF.crouch + up, by: STAFF.by + up };
  }

  // l'arrière de l'échoppe : poteaux, étagère de fioles, auvent ; puis le mage ; puis le comptoir devant lui
  drawBack(frame, p) {
    const x0 = Math.round(this.x) - 24, y = this.y;
    for (const px of [x0, x0 + 46]) p.rect(px, y - 52, 2, 52, C.woodD);
    p.rect(x0 + 2, y - 36, 44, 2, C.shelf);
    [C.glassA, C.glassB, C.glassC, C.glassA].forEach((g, i) => {
      const bx = x0 + 6 + i * 10;
      p.rect(bx, y - 42, 4, 6, g);
      p.rect(bx + 1, y - 44, 2, 2, C.cork);
      p.glow(bx + 2, y - 39, 6, g, 0.12);
    });
  }
  drawMage(frame) {
    painterFor(frame).glow(this.x, this.y - 26, 22, LAMP, 0.25);
    const r = posed(this.pose), flip = this.face < 0, W = frame.w, H = frame.h;
    const bx = Math.round(this.x) - frame.ox, by = Math.round(this.y) - frame.oy;
    for (let i = 0; i < r.n; i++) {
      const px = flip ? bx - r.xs[i] - 1 : bx + r.xs[i], py = by + r.ys[i];
      if (px < 0 || py < 0 || px >= W || py >= H) continue;
      frame.color[py * W + px] = ROBE.get(r.color[i] >>> 0) ?? r.color[i];
    }
  }
  drawFront(frame, p) {
    const x0 = Math.round(this.x) - 26, y = this.y;
    // le comptoir : un plateau clair, des planches, un pied sombre
    p.rect(x0, y - 11, 52, 2, C.woodL);
    p.rect(x0 + 1, y - 9, 50, 9, C.wood);
    for (let i = 1; i < 5; i++) p.rect(x0 + 1 + i * 10, y - 9, 1, 9, C.woodD);
    p.rect(x0 + 1, y - 2, 50, 2, C.woodK);
    // l'auvent : des bandes violettes et dorées, un bord en festons
    for (let i = 0; i < 56; i++) {
      const stripe = Math.floor(i / 7) % 2, c = stripe ? C.clothB : C.clothA, d = stripe ? C.clothBD : C.clothD;
      const sag = Math.round(Math.sin((i / 55) * Math.PI) * 2);
      p.rect(x0 - 2 + i, y - 60 + sag, 1, 6, c);
      p.rect(x0 - 2 + i, y - 54 + sag + (i % 7 < 4 ? 1 : 0), 1, 1, d);
    }
    this.candle.draw(frame);
  }
}
