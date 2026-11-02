// Le jeu sans navigateur : un état, step(dt, keys) et draw(). main.js l'affiche, tools/shot.mjs le photographie.

import { createFrame, createFx, painterFor, hex } from "pixelfx";
import * as brazier from "pixelfx/fx/fire/brazier";
import * as hitSpark from "pixelfx/fx/impacts/hit-spark";
import * as poof from "pixelfx/fx/spawn/poof";
import { Level, LEVEL1 } from "./level.js";
import { Hero, HW, HH, MAX_HP } from "./hero.js";
import { Cape, drawKnight } from "./knight.js";
import { Slime, overlaps, GOO } from "./enemies.js";
import { drawBackdrop, drawTiles } from "./tiles.js";

export const W = 320, H = 180;
const STEP = 1 / 120;

export function createGame() {
  const level = new Level(LEVEL1);
  const hero = new Hero(level.spawn.x, level.spawn.y);
  const cape = new Cape();
  const frame = createFrame(W, H);
  const fires = level.braziers.map(([x, y], i) => createFx(brazier, { x, y, seed: i + 1 }));
  let slimes = [];
  const spawnSlimes = () => (slimes = level.slimes.map(([x, y], i) => new Slime(x, y, i + 1)));
  spawnSlimes();
  // les effets ponctuels en cours : coups d'épée, étincelles, nuages ; speed fait jouer un effet plus vite
  let fxs = [];
  const cam = { x: 0, y: 0, look: 0 };
  let acc = 0, freeze = 0, shakeT = 0, shake0 = 1, amp = 0;

  const near = (x, y, m = 80) => x > cam.x - m && x < cam.x + W + m && y > cam.y - m && y < cam.y + H + m * 2;

  function follow(dt) {
    // la caméra regarde un peu devant le chevalier et reste dans le niveau
    cam.look += (hero.face * 36 - cam.look) * Math.min(1, dt * 2.5);
    const tx = hero.x + cam.look - W / 2, ty = hero.y - H * 0.62;
    cam.x += (tx - cam.x) * Math.min(1, dt * 6);
    cam.y += (ty - cam.y) * Math.min(1, dt * 4);
    cam.x = Math.max(0, Math.min(level.pxW - W, cam.x));
    cam.y = Math.max(0, Math.min(level.pxH - H, cam.y));
  }

  const game = {
    frame, hero, level, cam,
    get slimes() { return slimes; },
    addFx(fx, speed = 1) { fxs.push({ fx, speed }); },
    shake(t, a) { shakeT = shake0 = Math.max(shakeT, t); amp = Math.max(amp * (shakeT > 0 ? 1 : 0), a); },

    // un pas de 1/120 s : le chevalier, ses coups, les ennemis, les contacts
    tick(dt, keys) {
      const impacts = hero.step(dt, keys, level, game);
      cape.step(dt, hero);
      for (const { hit, box, dmg } of impacts) {
        let touched = false;
        for (const s of slimes) {
          if (!overlaps(box, s.box())) continue;
          touched = true;
          const dead = s.hit(hero.x, dmg, hit.push ?? 2);
          game.addFx(createFx(hitSpark, { x: s.x, y: s.y, height: 10, flip: hero.x > s.x, seed: Math.floor(hero.time * 60) }));
          // il meurt en éclaboussure de sa propre couleur, plus discrète qu'un nuage gris
          if (dead) game.addFx(createFx(poof, { x: s.x, y: s.y, seed: 3, palette: GOO, light: 0.6 }), 1.3);
        }
        // un coup qui porte gèle le monde et secoue l'image ; un coup dans le vide, non
        if (touched) {
          freeze = Math.max(freeze, hit.stop ?? 0.06);
          game.shake(hit.shake ?? 0.12, hit.amp ?? 1);
        }
      }
      slimes = slimes.filter((s) => s.hp > 0);
      for (const s of slimes) {
        if (!near(s.x, s.y, 200)) continue;
        s.step(dt, level);
        const me = { x0: hero.x - HW, x1: hero.x + HW, y0: hero.y - HH, y1: hero.y };
        if (s.stun <= 0 && overlaps(me, s.box()) && hero.hurt(s.x)) {
          freeze = 0.08;
          game.shake(0.2, 2);
        }
      }
      // plus de cœurs : tout recommence au départ
      if (hero.dead) {
        hero.reset();
        spawnSlimes();
      }
    },

    step(dt, keys) {
      shakeT = Math.max(0, shakeT - dt);
      // gel à l'impact : rien ne bouge, sauf les braseros (le feu ne s'arrête pas)
      if (freeze > 0) {
        freeze -= dt;
        acc = 0;
      } else {
        acc += Math.min(dt, 0.1);
        while (acc >= STEP) {
          acc -= STEP;
          game.tick(STEP, keys);
        }
        for (const e of fxs) e.fx.update(dt * e.speed);
        fxs = fxs.filter((e) => !e.fx.done());
        follow(dt);
      }
      for (const f of fires) if (near(f.options.x, f.options.y)) f.update(dt);
    },

    draw() {
      const k = shakeT > 0 ? amp * (shakeT / shake0) : 0, n = Math.floor(shakeT * 60);
      frame.ox = Math.round(cam.x + Math.sin(n * 2.4) * k);
      frame.oy = Math.round(cam.y + Math.cos(n * 3.7) * k * 0.7);
      frame.light.fill(0);
      drawBackdrop(frame, cam);
      for (const f of fires) if (near(f.options.x, f.options.y)) f.draw(frame, "back");
      drawTiles(frame, level);
      for (const f of fires) if (near(f.options.x, f.options.y)) f.draw(frame, "front");
      for (const s of slimes) if (near(s.x, s.y)) s.draw(frame);
      for (const e of fxs) e.fx.draw(frame, "back");
      cape.draw(painterFor(frame));
      drawKnight(frame, hero);
      for (const e of fxs) e.fx.draw(frame, "front");
      drawHearts(frame, hero.hp);
      return frame;
    },
  };
  return game;
}

// les cœurs, en haut à gauche de l'écran
const HEART = [".##.##.", "#hh#ll#", "#hllll#", "#lllll#", ".#lll#.", "..#l#..", "...#..."];
const HC = { "#": hex("#1a0c12"), h: hex("#ffd0d8"), l: hex("#e0303e"), e: hex("#3a2a3a") };
function drawHearts(frame, hp) {
  const { w: W, color } = frame;
  for (let i = 0; i < MAX_HP; i++)
    HEART.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch === ".") return;
        const c = i < hp ? HC[ch] : ch === "#" ? HC["#"] : HC.e;
        color[(6 + y) * W + 6 + i * 9 + x] = c;
      }),
    );
}
