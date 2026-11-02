// Les braises : ce que lâchent les ennemis, la monnaie de l'arbre d'évolution. Elles jaillissent, rebondissent sur la
// pierre, rougeoient au sol, puis filent vers le chevalier quand il passe près d'elles.

import { hex, sparkle } from "pixelfx";
import { TILE } from "./level.js";

const RAMP = ["#5a1410", "#a8281a", "#f2561d", "#ff8a2a", "#ffc23d", "#fff3a6"].map(hex);
const MAGNET = 46, GRAB = 7;

export class Embers {
  constructor() {
    this.list = [];
    this.pops = []; // un éclat bref à chaque braise ramassée
  }

  /** Une gerbe de n braises depuis (x, y). */
  burst(x, y, n, rng) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (rng() - 0.5) * 1.8, sp = 70 + rng() * 90;
      this.list.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, age: 0, seed: rng() * 10, rest: false });
    }
  }

  /** Avance les braises ; renvoie le nombre ramassé pendant ce pas. */
  step(dt, level, hero) {
    let got = 0;
    const hx = hero.x, hy = hero.y - 16;
    for (const e of this.list) {
      e.age += dt;
      const dx = hx - e.x, dy = hy - e.y, d = Math.hypot(dx, dy);
      if (e.age > 0.35 && d < MAGNET) {
        // attirée : elle accélère vers lui et ne touche plus le décor
        const k = 900 * (1 - d / MAGNET) + 300;
        e.vx += (dx / d) * k * dt;
        e.vy += (dy / d) * k * dt;
        e.vx *= 1 - 3 * dt;
        e.vy *= 1 - 3 * dt;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.rest = false;
        if (d < GRAB) {
          e.got = true;
          got++;
          this.pops.push({ x: e.x, y: e.y, age: 0 });
        }
        continue;
      }
      if (e.rest) continue;
      e.vy += 600 * dt;
      e.vx *= 1 - 1.2 * dt;
      const nx = e.x + e.vx * dt, ny = e.y + e.vy * dt;
      if (level.solid(Math.floor(nx / TILE), Math.floor(e.y / TILE))) e.vx *= -0.5;
      else e.x = nx;
      const ty = Math.floor(ny / TILE), tx = Math.floor(e.x / TILE);
      const floor = e.vy > 0 && (level.solid(tx, ty) || (level.oneWay(tx, ty) && e.y <= ty * TILE));
      if (floor) {
        e.y = ty * TILE - 1;
        e.vy *= -0.35;
        e.vx *= 0.6;
        if (Math.abs(e.vy) < 25) { e.vy = 0; e.rest = true; }
      } else if (e.vy < 0 && level.solid(tx, ty)) e.vy = 0;
      else e.y = ny;
      // tombée dans un trou : perdue
      if (e.y > level.pxH + 32) e.got = true;
    }
    this.list = this.list.filter((e) => !e.got);
    for (const p of this.pops) p.age += dt;
    this.pops = this.pops.filter((p) => p.age < 0.16);
    return got;
  }

  draw(p, time) {
    for (const e of this.list) {
      // elle palpite entre deux tons chauds ; au sol, elle couve plus sombre
      const f = Math.sin(time * 9 + e.seed * 7) > 0 ? 1 : 0, i = e.rest ? 2 + f : 3 + f;
      p.rect(Math.round(e.x) - 1, Math.round(e.y) - 1, 2, 2, RAMP[i]);
      p.px(Math.round(e.x) - 1, Math.round(e.y) - 1, RAMP[5]);
      p.glow(e.x, e.y, 7, RAMP[3], e.rest ? 0.18 : 0.3);
    }
    for (const q of this.pops) sparkle(p, q.x, q.y, 5 * (1 - q.age / 0.16), RAMP[5], RAMP[3], 0.6);
  }
}
