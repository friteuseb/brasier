// Les ennemis. Le slime de pixelfx saute sur place en boucle : on ne le fait avancer que pendant qu'il est en l'air,
// ainsi son animation reste celle de l'effet. Il fait demi-tour au bord du vide et contre un mur.

import { createFx } from "pixelfx";
import * as slime from "pixelfx/fx/critters/slime";
import { TILE } from "./level.js";

const D = slime.meta.duration, LIFT = 0.9, LAND = 1.44; // la phase en l'air de son saut, dans sa boucle
// le flash d'un coup : le slime pâlit, sans allumer toute sa lueur
const FLASH = ["#2a4440", "#5a8a80", "#a8d8cc", "#dff8ee", "#f4fff8", "#ffffff", "#ffffff"];
export const GOO = ["#0b2f2b", "#12594a", "#1f8f4f", "#47c752", "#a6f06a", "#f0ffd2"];

export class Slime {
  constructor(x, y, seed) {
    this.x = x;
    this.y = y;
    this.dir = seed % 2 ? 1 : -1;
    this.hp = 3;
    this.loot = 5; // les braises qu'il lâche
    this.hw = 11;
    this.hh = 18;
    this.kx = 0; // recul après un coup
    this.flash = 0;
    this.stun = 0;
    this.fx = createFx(slime, { x, y, seed });
    this.palette = this.fx.options.palette;
    this.t = ((seed - 1) * 0.618 * D) % D; // le même décalage que pixelfx donne à chaque graine
  }

  get airborne() {
    const u = this.t % D;
    return u >= LIFT && u < LAND;
  }

  step(dt, level) {
    this.flash = Math.max(0, this.flash - dt);
    this.stun = Math.max(0, this.stun - dt);
    // sonné, il ne saute plus ; sinon sa boucle avance
    if (this.stun <= 0) {
      this.t += dt;
      this.fx.update(dt);
    }
    if (this.airborne && this.stun <= 0) {
      const nx = this.x + this.dir * 34 * dt;
      // demi-tour devant un mur ou au bord du vide
      const ahead = Math.floor((nx + this.dir * this.hw) / TILE), row = Math.floor((this.y - 1) / TILE), below = Math.floor((this.y + 1) / TILE);
      if (level.solid(ahead, row) || !(level.solid(ahead, below) || level.oneWay(ahead, below))) this.dir *= -1;
      else this.x = nx;
    }
    if (this.kx) {
      const nx = this.x + this.kx * dt, ahead = Math.floor((nx + Math.sign(this.kx) * this.hw) / TILE), below = Math.floor((this.y + 1) / TILE);
      // le recul ne le pousse pas dans le vide ni dans un mur
      if (!level.solid(ahead, Math.floor((this.y - 1) / TILE)) && (level.solid(ahead, below) || level.oneWay(ahead, below))) this.x = nx;
      this.kx *= Math.pow(0.002, dt);
      if (Math.abs(this.kx) < 4) this.kx = 0;
    }
    this.fx.options.x = Math.round(this.x);
    this.fx.options.y = this.y;
  }

  /** Touché par l'épée depuis fromX. Renvoie true s'il en meurt. */
  hit(fromX, dmg, push = 2) {
    this.hp -= dmg;
    this.flash = 0.1;
    this.stun = 0.35;
    this.kx = (this.x < fromX ? -1 : 1) * (60 + push * 30);
    return this.hp <= 0;
  }

  /** Sa boîte, dans le monde. Elle monte avec lui quand il saute. */
  box() {
    const lift = this.airborne ? 10 : 0;
    return { x0: this.x - this.hw, x1: this.x + this.hw, y0: this.y - this.hh - lift, y1: this.y - lift };
  }

  draw(frame) {
    this.fx.options.palette = this.flash > 0 ? FLASH : this.palette;
    this.fx.options.light = this.flash > 0 ? 0.3 : 1;
    this.fx.draw(frame);
  }
}

export const overlaps = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
