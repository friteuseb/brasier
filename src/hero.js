// Le chevalier : physique de plateforme (pieds en x, y) et choix de la pose.

import { TILE } from "./level.js";
import { poseFor } from "./knight.js";

const RUN = 108, ACCEL = 1500, DECEL = 1800, AIR = 950;
const JUMP = 330, GRAVITY = 980, FALL_GRAVITY = 1500, MAX_FALL = 430;
const COYOTE = 0.08, BUFFER = 0.12;
const HW = 5, HH = 32; // demi-largeur et hauteur de la boîte de collision

export class Hero {
  constructor(x, y) {
    this.spawnAt = { x, y };
    this.reset();
  }

  reset() {
    Object.assign(this, { x: this.spawnAt.x, y: this.spawnAt.y, vx: 0, vy: 0, face: 1, ground: true });
    Object.assign(this, { coyote: 0, buffer: 0, landT: 0, airT: 0, stride: 0, time: 0, jumpHeld: false });
  }

  step(dt, keys, level) {
    this.time += dt;
    const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (dir) this.face = dir;

    // course : accélère vite, freine plus vite encore, moins de contrôle en l'air
    const target = dir * RUN, rate = !this.ground ? AIR : dir && Math.sign(dir) === Math.sign(this.vx || dir) ? ACCEL : DECEL;
    this.vx += Math.max(-rate * dt, Math.min(rate * dt, target - this.vx));

    // saut : tampon d'entrée, temps de coyote, hauteur selon la durée d'appui
    if (keys.jump && !this.jumpHeld) this.buffer = BUFFER;
    this.jumpHeld = keys.jump;
    this.buffer = Math.max(0, this.buffer - dt);
    this.coyote = this.ground ? COYOTE : Math.max(0, this.coyote - dt);
    if (this.buffer > 0 && this.coyote > 0) {
      this.vy = -JUMP;
      this.buffer = this.coyote = 0;
      this.ground = false;
    }
    const g = this.vy < 0 && keys.jump ? GRAVITY : FALL_GRAVITY;
    this.vy = Math.min(MAX_FALL, this.vy + g * dt);

    this.moveX(this.vx * dt, level);
    const wasGround = this.ground, fallSpeed = this.vy;
    this.moveY(this.vy * dt, level);
    if (this.ground && !wasGround && fallSpeed > 160) this.landT = 0.1;
    this.landT = Math.max(0, this.landT - dt);
    this.airT = this.ground ? 0 : this.airT + dt;
    if (this.ground) this.stride += Math.abs(this.vx) * dt;

    // tombé dans un trou : retour au départ
    if (this.y > level.pxH + 64) this.reset();
  }

  moveX(dx, level) {
    this.x += dx;
    const top = Math.floor((this.y - HH) / TILE), bot = Math.floor((this.y - 0.01) / TILE);
    if (dx > 0) {
      const tx = Math.floor((this.x + HW) / TILE);
      for (let ty = top; ty <= bot; ty++)
        if (level.solid(tx, ty)) { this.x = tx * TILE - HW; this.vx = 0; break; }
    } else if (dx < 0) {
      const tx = Math.floor((this.x - HW) / TILE);
      for (let ty = top; ty <= bot; ty++)
        if (level.solid(tx, ty)) { this.x = (tx + 1) * TILE + HW; this.vx = 0; break; }
    }
  }

  moveY(dy, level) {
    const before = this.y;
    this.y += dy;
    const l = Math.floor((this.x - HW) / TILE), r = Math.floor((this.x + HW - 0.01) / TILE);
    this.ground = false;
    if (dy > 0) {
      const ty = Math.floor(this.y / TILE);
      for (let tx = l; tx <= r; tx++) {
        // une planche ne porte que ce qui arrive d'au-dessus
        const plank = level.oneWay(tx, ty) && before <= ty * TILE + 0.01;
        if (level.solid(tx, ty) || plank) {
          this.y = ty * TILE;
          this.vy = 0;
          this.ground = true;
          break;
        }
      }
    } else if (dy < 0) {
      const ty = Math.floor((this.y - HH) / TILE);
      for (let tx = l; tx <= r; tx++)
        if (level.solid(tx, ty)) { this.y = (ty + 1) * TILE + HH; this.vy = 0; break; }
    }
  }

  get pose() {
    return poseFor(this);
  }
}
