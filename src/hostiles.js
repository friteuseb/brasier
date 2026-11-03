// Les tirs des monstres : des orbes lents qui filent droit, blessent le chevalier au contact et meurent contre un mur ou
// au bout de 3 s. Un coup d'épée qui les touche les détruit : on peut les parer.

import { hex } from "pixelfx";
import { TILE } from "./level.js";
import { HW, HH } from "./hero.js";

const CORE = hex("#f4ffd0"), MID = hex("#9be05a"), GLOW = hex("#3fae3a");

export class Orb {
  constructor(x, y, vx, vy) {
    Object.assign(this, { x, y, vx, vy, t: 0, dead: false, trail: [] });
  }
  /** Avance ; renvoie true s'il touche le chevalier. */
  step(dt, level, hero) {
    this.t += dt;
    this.trail.push([this.x, this.y]);
    if (this.trail.length > 8) this.trail.shift();
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.t > 3 || level.solid(Math.floor(this.x / TILE), Math.floor(this.y / TILE))) this.dead = true;
    const hit = !this.dead && Math.abs(this.x - hero.x) < HW + 3 && this.y > hero.y - HH - 3 && this.y < hero.y + 3;
    if (hit) this.dead = true;
    return hit;
  }
  box() {
    return { x0: this.x - 4, x1: this.x + 4, y0: this.y - 4, y1: this.y + 4 };
  }
  draw(p) {
    this.trail.forEach(([x, y], i) => p.dot(x, y, MID, i / this.trail.length * 0.8));
    p.circle(this.x, this.y, 2.5, MID);
    p.rect(Math.round(this.x) - 1, Math.round(this.y) - 1, 2, 2, CORE);
    p.glow(this.x, this.y, 10, GLOW, 0.6);
  }
}
