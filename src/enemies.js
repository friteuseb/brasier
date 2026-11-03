// Les ennemis. Chacun est une créature pixelfx (une boucle « pure ») que le jeu déplace. Certaines bougent aussi dans
// leur propre animation (la chauve-souris décrit un huit, le crâne flotte) : on reprend leurs formules pour savoir où est
// le corps, et on compense ce qui gênerait le jeu. Tous partagent la base Enemy : coups reçus, recul, flash, brûlure.

import { createFx, hex, mix, rgb } from "pixelfx";
import * as slime from "pixelfx/fx/critters/slime";
import * as bat from "pixelfx/fx/critters/bat";
import * as skull from "pixelfx/fx/critters/flying-skull";
import * as snake from "pixelfx/fx/critters/snake";
import * as ghost from "pixelfx/fx/critters/ghost";
import * as frog from "pixelfx/fx/critters/frog";
import * as eyeball from "pixelfx/fx/critters/eyeball";
import * as jellyfish from "pixelfx/fx/critters/jellyfish";
import { TILE } from "./level.js";

const TAU = Math.PI * 2, WHITE = rgb(255, 255, 255);
export const GOO = ["#0b2f2b", "#12594a", "#1f8f4f", "#47c752", "#a6f06a", "#f0ffd2"];
// la boucle interne de pixelfx : chaque graine décale la créature dans sa boucle
const loopT = (fx, D, seed) => (((fx.t + (seed - 1) * 0.618 * D) % D) + D) % D;
const solidAt = (level, x, y) => level.solid(Math.floor(x / TILE), Math.floor(y / TILE));
const floorAt = (level, x, y) => { const tx = Math.floor(x / TILE), ty = Math.floor((y + 1) / TILE); return level.solid(tx, ty) || level.oneWay(tx, ty); };

class Enemy {
  constructor(mod, x, y, seed, o = {}) {
    Object.assign(this, { x, y, seed, dir: seed % 2 ? 1 : -1, kx: 0, flash: 0, stun: 0, burn: 0 });
    this.fx = createFx(mod, { x, y, seed, ...o });
    this.palette = this.fx.options.palette;
    // le flash d'un coup : la créature pâlit, sans allumer toute sa lueur
    this.pale = this.palette.map((c) => mix(hex(c), WHITE, 0.65));
  }
  /** Touché depuis fromX. Renvoie true s'il en meurt. */
  hit(fromX, dmg, push = 2) {
    this.hp -= dmg;
    this.flash = 0.1;
    this.stun = this.stunTime ?? 0.35;
    this.kx = (this.x < fromX ? -1 : 1) * (60 + push * 30);
    return this.hp <= 0;
  }
  // le recul, puis l'amorti ; une créature au sol ne recule ni dans le vide ni dans un mur
  knock(dt, level, grounded) {
    if (!this.kx) return;
    const nx = this.x + this.kx * dt, side = nx + Math.sign(this.kx) * this.hw;
    if (!grounded || (!solidAt(level, side, this.y - 1) && floorAt(level, side, this.y))) this.x = nx;
    this.kx *= Math.pow(0.002, dt);
    if (Math.abs(this.kx) < 4) this.kx = 0;
  }
  tickTimers(dt) {
    this.flash = Math.max(0, this.flash - dt);
    this.stun = Math.max(0, this.stun - dt);
  }
  draw(frame) {
    const light = this.fx.options.light;
    this.fx.options.palette = this.flash > 0 ? this.pale : this.palette;
    if (this.flash > 0) this.fx.options.light = 0.3;
    this.fx.draw(frame);
    this.fx.options.light = light;
  }
}

// ---- le slime : il n'avance que pendant son saut, pour garder l'animation de l'effet ; demi-tour au bord du vide
const S_D = slime.meta.duration, LIFT = 0.9, LAND = 1.44;
export class Slime extends Enemy {
  constructor(x, y, seed) {
    super(slime, x, y, seed);
    Object.assign(this, { hp: 3, loot: 5, hw: 11, hh: 18, kind: "slime" });
    this.t = ((seed - 1) * 0.618 * S_D) % S_D;
  }
  get airborne() {
    const u = this.t % S_D;
    return u >= LIFT && u < LAND;
  }
  step(dt, level) {
    this.tickTimers(dt);
    const wasAir = this.airborne;
    if (this.stun <= 0) {
      this.t += dt;
      this.fx.update(dt);
    }
    if (this.airborne && this.stun <= 0) {
      const nx = this.x + this.dir * 34 * dt, side = nx + this.dir * this.hw;
      if (solidAt(level, side, this.y - 1) || !floorAt(level, side, this.y)) this.dir *= -1;
      else this.x = nx;
    }
    this.knock(dt, level, true);
    this.landed = wasAir && !this.airborne;
    this.fx.options.x = Math.round(this.x);
    this.fx.options.y = this.y;
  }
  box() {
    const lift = this.airborne ? 10 : 0;
    return { x0: this.x - this.hw, x1: this.x + this.hw, y0: this.y - this.hh - lift, y1: this.y - lift };
  }
}

// ---- la chauve-souris : elle patrouille en l'air autour de son perchoir, plonge sur le chevalier quand il passe
// dessous, puis remonte. On annule le huit de son animation en x (il gênerait la visée), on garde un peu de roulis en y.
const B_D = bat.meta.duration;
const batAt = (t) => { const a = (t / B_D) * TAU; return { x: 22 * Math.sin(a), y: 7 * Math.sin(2 * a) }; };
export class Bat extends Enemy {
  constructor(x, y, seed) {
    super(bat, x, y, seed);
    Object.assign(this, { hp: 2, loot: 4, hw: 9, hh: 10, kind: "bat", home: { x, y }, state: "patrol", st: 0, tx: 0, ty: 0, stunTime: 0.25 });
  }
  step(dt, level, hero) {
    this.tickTimers(dt);
    this.fx.update(dt);
    this.st += dt;
    const hx = hero.x, hy = hero.y - 18;
    if (this.stun > 0) {
      if (this.state === "dive") Object.assign(this, { state: "rise", st: 0 });
    } else if (this.state === "patrol") {
      // va-et-vient de 3 cases autour du perchoir
      this.x += this.dir * 40 * dt;
      if (Math.abs(this.x - this.home.x) > 48) this.dir = Math.sign(this.home.x - this.x);
      if (this.st > 1.2 && Math.abs(hx - this.x) < 90 && hy > this.y + 8 && hy - this.y < 130) {
        Object.assign(this, { state: "dive", st: 0, tx: hx, ty: hy });
        this.swooped = true;
      }
    } else if (this.state === "dive") {
      const dx = this.tx - this.x, dy = this.ty - this.y, d = Math.hypot(dx, dy) || 1;
      this.x += (dx / d) * 150 * dt;
      this.y += (dy / d) * 150 * dt;
      if (d < 6 || this.st > 0.9) Object.assign(this, { state: "rise", st: 0 });
    } else {
      // remonter au perchoir
      const dx = this.home.x - this.x, dy = this.home.y - this.y, d = Math.hypot(dx, dy);
      if (d < 3) Object.assign(this, { state: "patrol", st: 0 });
      else { this.x += (dx / d) * 70 * dt; this.y += (dy / d) * 70 * dt; }
    }
    this.knock(dt, level, false);
    const o = batAt(loopT(this.fx, B_D, this.seed));
    this.fx.options.x = Math.round(this.x - o.x);
    this.fx.options.y = Math.round(this.y - o.y * 0.6);
  }
  box() {
    return { x0: this.x - this.hw, x1: this.x + this.hw, y0: this.y - this.hh, y1: this.y + 6 };
  }
}

// ---- le crâne de feu : il flotte, suit le chevalier de loin, s'arme (il tremble et chauffe) puis charge en ligne droite
const K_HOVER = 40;
export class Skull extends Enemy {
  constructor(x, y, seed) {
    super(skull, x, y + K_HOVER, seed);
    this.y = y;
    Object.assign(this, { hp: 4, loot: 8, hw: 10, hh: 12, kind: "skull", state: "drift", st: 0, vx: 0, vy: 0, stunTime: 0.3 });
  }
  step(dt, level, hero) {
    this.tickTimers(dt);
    this.fx.update(dt);
    this.st += dt;
    const hx = hero.x, hy = hero.y - 18, d = Math.hypot(hx - this.x, hy - this.y);
    if (this.stun > 0) {
      if (this.state !== "drift") Object.assign(this, { state: "drift", st: 0 });
    } else if (this.state === "drift") {
      if (d < 170) {
        // il se place un peu au-dessus du chevalier, à 5 cases de lui
        const goalX = hx - Math.sign(hx - this.x || 1) * 80, goalY = hy - 30;
        this.x += Math.sign(goalX - this.x) * Math.min(Math.abs(goalX - this.x), 30 * dt);
        this.y += Math.sign(goalY - this.y) * Math.min(Math.abs(goalY - this.y), 24 * dt);
        if (this.st > 2.2) Object.assign(this, { state: "aim", st: 0 });
      }
    } else if (this.state === "aim") {
      if (this.st > 0.45) {
        const dx = hx - this.x, dy = hy - this.y, n = Math.hypot(dx, dy) || 1;
        Object.assign(this, { state: "charge", st: 0, vx: (dx / n) * 210, vy: (dy / n) * 210 });
        this.charged = true;
      }
    } else if (this.state === "charge") {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.st > 0.6 || solidAt(level, this.x, this.y)) Object.assign(this, { state: "drift", st: 0 });
    }
    this.knock(dt, level, false);
    // en s'armant, il tremble d'un pixel et son feu monte
    const shake = this.state === "aim" ? (Math.floor(this.st * 30) % 2 ? 1 : -1) : 0;
    this.fx.options.x = Math.round(this.x) + shake;
    this.fx.options.y = Math.round(this.y) + K_HOVER;
    this.fx.options.light = this.state === "aim" ? 1.6 : 1;
  }
  box() {
    return { x0: this.x - this.hw, x1: this.x + this.hw, y0: this.y - this.hh, y1: this.y + 10 };
  }
}

// ---- le serpent : il ondule au sol, fait demi-tour au bord, et se détend d'un coup quand le chevalier passe devant lui
export class Snake extends Enemy {
  constructor(x, y, seed) {
    super(snake, x, y, seed);
    Object.assign(this, { hp: 3, loot: 5, hw: 14, hh: 13, kind: "snake", lunge: 0, cool: 0 });
  }
  step(dt, level, hero) {
    this.tickTimers(dt);
    this.fx.update(dt);
    this.cool = Math.max(0, this.cool - dt);
    this.lunge = Math.max(0, this.lunge - dt);
    const ahead = (hero.x - this.x) * this.dir;
    if (this.stun <= 0 && !this.lunge && !this.cool && ahead > 0 && ahead < 70 && Math.abs(hero.y - this.y) < 20) {
      this.lunge = 0.3;
      this.cool = 1.4;
      this.struck = true;
    }
    if (this.stun <= 0) {
      const speed = this.lunge > 0 ? 190 : 28, nx = this.x + this.dir * speed * dt, side = nx + this.dir * (this.hw + 4);
      if (solidAt(level, side, this.y - 1) || !floorAt(level, side, this.y)) { this.dir *= -1; this.lunge = 0; }
      else this.x = nx;
    }
    this.knock(dt, level, true);
    // l'effet a la tête 30 px devant son origine : on recule l'origine pour que la tête soit à l'avant de la boîte
    this.fx.options.x = Math.round(this.x - this.dir * 14);
    this.fx.options.y = this.y;
    this.fx.options.flip = this.dir < 0;
  }
  box() {
    // la tête et l'avant du corps : c'est ce qui mord
    return { x0: this.x - this.hw, x1: this.x + this.hw, y0: this.y - this.hh, y1: this.y };
  }
}

// ---- le fantôme : il dérive vers le chevalier à travers les murs, lentement
const G_LIFT = 30;
export class Ghost extends Enemy {
  constructor(x, y, seed) {
    super(ghost, x, y + G_LIFT, seed);
    this.y = y;
    Object.assign(this, { hp: 3, loot: 6, hw: 10, hh: 14, kind: "ghost", home: { x, y }, stunTime: 0.5 });
  }
  step(dt, level, hero) {
    this.tickTimers(dt);
    this.fx.update(dt);
    const hx = hero.x, hy = hero.y - 18, d = Math.hypot(hx - this.x, hy - this.y);
    if (this.stun <= 0) {
      const [gx, gy] = d < 170 ? [hx, hy] : [this.home.x, this.home.y], dx = gx - this.x, dy = gy - this.y, n = Math.hypot(dx, dy);
      if (n > 2) { this.x += (dx / n) * 22 * dt; this.y += (dy / n) * 22 * dt; }
      if (Math.abs(dx) > 2) this.dir = dx < 0 ? -1 : 1;
    }
    this.knock(dt, level, false);
    this.fx.options.x = Math.round(this.x);
    this.fx.options.y = Math.round(this.y) + G_LIFT;
    this.fx.options.flip = this.dir < 0;
  }
  box() {
    return { x0: this.x - this.hw, x1: this.x + this.hw, y0: this.y - this.hh, y1: this.y + 12 };
  }
}

// ---- la grenouille : comme le slime, elle n'avance que pendant son bond (0,42 s par cycle), mais plus loin, et elle
// se tourne vers le chevalier quand il est à moins de 8 cases
const F_D = frog.meta.duration, F_UP = 1.2, F_LAND = 1.62;
export class Frog extends Enemy {
  constructor(x, y, seed) {
    super(frog, x, y, seed);
    Object.assign(this, { hp: 3, loot: 5, hw: 10, hh: 14, kind: "frog" });
  }
  get airborne() {
    const u = loopT(this.fx, F_D, this.seed);
    return u >= F_UP && u < F_LAND;
  }
  step(dt, level, hero) {
    this.tickTimers(dt);
    const wasAir = this.airborne;
    if (this.stun <= 0) this.fx.update(dt);
    if (!this.airborne && Math.abs(hero.x - this.x) < 128 && Math.abs(hero.y - this.y) < 40) this.dir = hero.x < this.x ? -1 : 1;
    if (this.airborne && this.stun <= 0) {
      const nx = this.x + this.dir * 70 * dt, side = nx + this.dir * this.hw;
      if (solidAt(level, side, this.y - 1) || !floorAt(level, side, this.y)) this.dir *= -1;
      else this.x = nx;
    }
    this.knock(dt, level, true);
    this.landed = wasAir && !this.airborne;
    this.fx.options.x = Math.round(this.x);
    this.fx.options.y = this.y;
    this.fx.options.flip = this.dir < 0;
  }
  box() {
    const u = loopT(this.fx, F_D, this.seed), q = (u - F_UP) / (F_LAND - F_UP), lift = this.airborne ? 22 * 4 * q * (1 - q) : 0;
    return { x0: this.x - this.hw, x1: this.x + this.hw, y0: this.y - this.hh - lift, y1: this.y - lift };
  }
}

// ---- l'œil volant : il garde ses distances (6 cases) un peu au-dessus du chevalier, et tire un orbe toutes les 2,6 s
const E_HOVER = 48;
export class Eye extends Enemy {
  constructor(x, y, seed) {
    super(eyeball, x, y + E_HOVER, seed);
    this.y = y;
    Object.assign(this, { hp: 3, loot: 6, hw: 11, hh: 11, kind: "eye", home: { x, y }, cool: 1.5 + (seed % 3) * 0.4, stunTime: 0.4 });
  }
  step(dt, level, hero) {
    this.tickTimers(dt);
    this.fx.update(dt);
    const hx = hero.x, hy = hero.y - 18, d = Math.hypot(hx - this.x, hy - this.y);
    if (this.stun <= 0) {
      const [gx, gy] = d < 190 ? [hx - Math.sign(hx - this.x || 1) * 96, hy - 26] : [this.home.x, this.home.y];
      const dx = gx - this.x, dy = gy - this.y, n = Math.hypot(dx, dy);
      if (n > 2) { this.x += (dx / n) * 26 * dt; this.y += (dy / n) * 26 * dt; }
      this.cool -= dt;
      if (this.cool <= 0 && d < 190) {
        this.cool = 2.6;
        this.shot = { x: this.x, y: this.y, vx: ((hx - this.x) / d) * 95, vy: ((hy - this.y) / d) * 95 };
      }
    }
    this.knock(dt, level, false);
    this.fx.options.x = Math.round(this.x);
    this.fx.options.y = Math.round(this.y) + E_HOVER;
  }
  box() {
    return { x0: this.x - this.hw, x1: this.x + this.hw, y0: this.y - this.hh, y1: this.y + this.hh };
  }
}

// ---- la méduse : elle monte et descend dans l'eau autour de sa place, et dérive vers le chevalier quand il nage près
// d'elle ; elle ne sort jamais de l'eau
export class Jelly extends Enemy {
  constructor(x, y, seed) {
    super(jellyfish, x, y, seed);
    Object.assign(this, { hp: 2, loot: 4, hw: 10, hh: 10, kind: "jelly", home: { x, y }, t: seed, stunTime: 0.4 });
  }
  step(dt, level, hero) {
    this.tickTimers(dt);
    this.fx.update(dt);
    this.t += dt;
    if (this.stun <= 0) {
      const chase = hero.swim && Math.abs(hero.x - this.x) < 110 ? Math.sign(hero.x - this.x) * 18 * dt : 0;
      const nx = this.x + chase, wet = (x, y) => level.water(Math.floor(x / TILE), Math.floor(y / TILE));
      if (wet(nx + Math.sign(chase) * this.hw, this.y)) this.x = nx;
      const ny = this.home.y + Math.sin(this.t * 1.1) * 18;
      if (wet(this.x, ny - this.hh) && wet(this.x, ny + this.hh)) this.y = ny;
    }
    this.knock(dt, level, false);
    if (!level.water(Math.floor(this.x / TILE), Math.floor(this.y / TILE))) this.x = this.home.x; // jamais hors de l'eau
    this.fx.options.x = Math.round(this.x);
    this.fx.options.y = Math.round(this.y) - 6;
  }
  box() {
    // la cloche et le haut des tentacules
    return { x0: this.x - this.hw, x1: this.x + this.hw, y0: this.y - this.hh - 6, y1: this.y + 16 };
  }
}

/** Les ennemis par lettre de carte : S slime, b chauve-souris, k crâne de feu, n serpent, g fantôme, f grenouille, e œil volant, j méduse. */
export const KINDS = { S: Slime, b: Bat, k: Skull, n: Snake, g: Ghost, f: Frog, e: Eye, j: Jelly };
export const overlaps = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
