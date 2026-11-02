// Le jeu sans navigateur : un état, step(dt, keys) et draw(). main.js l'affiche, tools/shot.mjs le photographie.

import { createFrame, createFx, painterFor } from "pixelfx";
import * as brazier from "pixelfx/fx/fire/brazier";
import { Level, LEVEL1 } from "./level.js";
import { Hero } from "./hero.js";
import { Cape, drawKnight } from "./knight.js";
import { drawBackdrop, drawTiles } from "./tiles.js";

export const W = 320, H = 180;
const STEP = 1 / 120;

export function createGame() {
  const level = new Level(LEVEL1);
  const hero = new Hero(level.spawn.x, level.spawn.y);
  const cape = new Cape();
  const frame = createFrame(W, H);
  const fires = level.braziers.map(([x, y], i) => createFx(brazier, { x, y, seed: i + 1 }));
  const cam = { x: 0, y: 0, look: 0 };
  let acc = 0;

  const near = (fx, m = 80) => {
    const { x, y } = fx.options;
    return x > cam.x - m && x < cam.x + W + m && y > cam.y - m && y < cam.y + H + m * 2;
  };

  function follow(dt) {
    // la caméra regarde un peu devant le chevalier et reste dans le niveau
    cam.look += (hero.face * 36 - cam.look) * Math.min(1, dt * 2.5);
    const tx = hero.x + cam.look - W / 2, ty = hero.y - H * 0.62;
    cam.x += (tx - cam.x) * Math.min(1, dt * 6);
    cam.y += (ty - cam.y) * Math.min(1, dt * 4);
    cam.x = Math.max(0, Math.min(level.pxW - W, cam.x));
    cam.y = Math.max(0, Math.min(level.pxH - H, cam.y));
  }

  return {
    frame, hero, level, cam,
    step(dt, keys) {
      acc += Math.min(dt, 0.1);
      while (acc >= STEP) {
        acc -= STEP;
        hero.step(STEP, keys, level);
        cape.step(STEP, hero);
      }
      follow(dt);
      for (const t of fires) if (near(t)) t.update(dt);
    },
    draw() {
      frame.ox = Math.round(cam.x);
      frame.oy = Math.round(cam.y);
      frame.light.fill(0);
      drawBackdrop(frame, cam);
      for (const t of fires) if (near(t)) t.draw(frame, "back");
      drawTiles(frame, level);
      for (const t of fires) if (near(t)) t.draw(frame, "front");
      cape.draw(painterFor(frame));
      drawKnight(frame, hero);
      return frame;
    },
  };
}
