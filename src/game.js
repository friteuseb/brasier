// Le jeu sans navigateur : un état, step(dt, keys) et draw(). main.js l'affiche, tools/shot.mjs le photographie.

import { createFrame, createFx, painterFor, Rng } from "pixelfx";
import * as hitSpark from "pixelfx/fx/impacts/hit-spark";
import * as critHit from "pixelfx/fx/impacts/crit-hit";
import * as poof from "pixelfx/fx/spawn/poof";
import * as burnAway from "pixelfx/fx/transitions/burn-away";
import "./font.js";
import { Embers } from "./embers.js";
import { FIRST, place } from "./levels/index.js";
import { WorldMap, drawSummary, Ending } from "./screens.js";
import { WORLD } from "./levels/index.js";
import { Stage, FLAME } from "./stage.js";
import { Hero, HW, HH } from "./hero.js";
import { Cape, drawKnight } from "./knight.js";
import { KINDS, overlaps, GOO } from "./enemies.js";
import { Merchant } from "./shop.js";
import { Skills, node } from "./skills.js";
import { Special } from "./specials.js";
import { Altar } from "./altar.js";
import { drawHud } from "./hud.js";
import { Orb } from "./hostiles.js";
import { Guardian } from "./boss.js";
import { GUARDIANS } from "./guardians.js";
import * as darkExplosion from "pixelfx/fx/shadow/dark-explosion";

// le nombre d'éclats dans tout le royaume : les « * » de toutes les cartes
const SHARDS_MAX = WORLD.reduce((n, w) => n + (w.def ? w.def.rows.join("").split("*").length - 1 : 0), 0);
// les ennemis par lettre de carte ; Z est le gardien du niveau (sa fiche est nommée par le niveau)
const foe = (ch, x, y, i, def) => (ch === "Z" ? new Guardian(GUARDIANS[def.guardian ?? "noir"], x, y) : new KINDS[ch](x, y, i + 1));

export const W = 320, H = 180;
const STEP = 1 / 120;
const SAVE_VERSION = 2; // à augmenter quand le format change ; load() reprend la version 1
const KEYS = ["left", "right", "up", "down", "jump", "attack", "special", "cycle", "confirm", "back"];
const ARDOR_HIT = 10, ARDOR_KILL = 20;

export function createGame() {
  const skills = new Skills();
  const hero = new Hero(0, 0, skills);
  const cape = new Cape();
  const frame = createFrame(W, H);
  const embers = new Embers(), R = new Rng(7);
  let purse = 0; // les braises ramassées
  let streak = 0, streakT = 0; // les braises ramassées d'affilée font monter le tintement
  const toast = { text: "", t: 0 };
  // la progression : pour chaque niveau, terminé ou non, ses braseros allumés et le dernier visité
  let progress = {}, current = FIRST;
  // ce qui appartient au niveau en cours : enter() le refait ; stage porte le lieu, le reste les combats
  let stage, level, enemies, merchants, stats;
  const shardTotal = () => Object.values(progress).reduce((n, p) => n + (p.shards?.length ?? 0), 0);
  // les effets ponctuels en cours ; speed fait jouer un effet plus vite
  let fxs = [], projectiles = [], later = [], orbs = [], shieldFx = null;
  // mode : "play", "summary" (bilan) ou "map" (carte du royaume) ; trans : la transition d'écran en cours
  let mode = "play", altar = null, map = null, summaryT = 0, trans = null, prev = {}, ending = null;
  const cam = { x: 0, y: 0, look: 0 };
  let acc = 0, freeze = 0, shakeT = 0, shake0 = 1, amp = 0;
  // un gardien vaincu ne revient pas
  const spawnEnemies = () => (enemies = level.foes.filter(([ch]) => ch !== "Z" || !progress[current].boss).map(([ch, x, y], i) => foe(ch, x, y, i, level.def)));

  /** Entrer dans un niveau : au dernier brasero visité, ou au départ. */
  function enter(id) {
    current = id;
    const node = place(id), pr = (progress[id] ??= { done: false, lit: [], checkpoint: null });
    pr.shards ??= [];
    stage = new Stage(node.def, pr);
    level = stage.level;
    hero.spawnAt = stage.respawn;
    hero.reset();
    // tous les 3 éclats, un cœur de plus
    hero.bonusHp = Math.floor(shardTotal() / 3);
    hero.hp = hero.maxHp;
    hero.oathT = 0;
    spawnEnemies();
    merchants = level.merchants.map(([x, y, school], i) => new Merchant(x, y, i + 1, school));
    fxs = []; projectiles = []; later = []; orbs = []; shieldFx = null; embers.list = []; altar = null;
    cam.x = Math.max(0, Math.min(level.pxW - W, hero.x - W / 2));
    cam.y = Math.max(0, Math.min(level.pxH - H, hero.y - H * 0.62));
    stats = { name: node.name, embers: 0, kills: 0, foes: enemies.length, time: 0, shards: pr.shards.length, shardsMax: stage.shards.length };
    mode = "play";
  }
  /** Une transition d'écran : les flammes couvrent l'écran, then() change ce qu'il y a dessous, puis elles s'ouvrent. */
  function transition(then) {
    trans = { fx: createFx(burnAway, { seed: 3 }), t: 0, swapped: false, then };
    game.emit("ignite");
  }
  function toMap() {
    mode = "map";
    map = new WorldMap(current);
    game.onSave?.(game.save());
  }

  const near = (x, y, m = 80) => x > cam.x - m && x < cam.x + W + m && y > cam.y - m && y < cam.y + H + m * 2;
  const merchantHere = () => merchants.find((m) => m.reach(hero));

  function follow(dt) {
    // la caméra regarde un peu devant le chevalier et reste dans le niveau
    cam.look += (hero.face * 36 - cam.look) * Math.min(1, dt * 2.5);
    const tx = hero.x + cam.look - W / 2, ty = hero.y - H * 0.62;
    cam.x += (tx - cam.x) * Math.min(1, dt * 6);
    cam.y += (ty - cam.y) * Math.min(1, dt * 4);
    cam.x = Math.max(0, Math.min(level.pxW - W, cam.x));
    cam.y = Math.max(0, Math.min(level.pxH - H, cam.y));
  }

  function kill(s) {
    // le slime meurt en éclaboussure verte, les autres en nuage de leur couleur
    const palette = s.kind === "slime" ? GOO : s.palette.slice(1);
    game.addFx(createFx(poof, { x: s.x, y: s.kind === "slime" || s.kind === "snake" ? s.y : s.y + 10, seed: 3, palette, light: 0.6 }), 1.3);
    embers.burst(s.x, s.y - 8, s.loot, () => R.next());
    game.emit("kill", { x: s.x });
    hero.ardor = Math.min(100, hero.ardor + ARDOR_KILL);
    stats.kills++;
    if (s.boss) {
      // le gardien tombe : une explosion d'ombre, une pluie de braises, et le Grand Brasier se laisse rallumer
      progress[current].boss = true;
      game.addFx(createFx(darkExplosion, { x: s.x, y: s.y, seed: 4 }));
      game.shake(0.8, 4);
      game.say(`${s.name} EST TOMBÉ`);
      game.emit("boom", { x: s.x });
      services.save();
    }
  }

  // un impact : { box, dmg, stop, shake, amp, push, sword, stroke, crit, once, always, sound }
  function strike(imp) {
    let touched = false;
    // un coup d'épée pare les orbes des monstres
    if (imp.sword) for (const o of orbs) if (!o.dead && overlaps(imp.box, o.box())) { o.dead = true; touched = true; game.addFx(createFx(hitSpark, { x: o.x, y: o.y + 6, height: 6, seed: 2 })); }
    for (const s of enemies) {
      if (s.hp <= 0 || !overlaps(imp.box, s.box()) || imp.once?.has(s)) continue;
      imp.once?.add(s);
      touched = true;
      let dmg = imp.dmg;
      // les passifs de l'épée : le troisième coup brûle plus fort, frappe en critique, et les coups enflamment
      if (imp.sword && imp.stroke === 2 && skills.has("lame-ardente")) dmg += 1;
      const crit = imp.crit || (imp.sword && imp.stroke === 2 && skills.has("critique"));
      if (imp.sword && imp.stroke === 2 && skills.has("critique")) dmg *= 2;
      if (imp.sword && skills.has("brulure")) s.burn = 3;
      if (imp.sword) hero.ardor = Math.min(100, hero.ardor + ARDOR_HIT);
      const dead = s.hit(hero.x, dmg, imp.push ?? 2);
      game.emit("hit", { x: s.x, heavy: (imp.stop ?? 0) >= 0.14 });
      game.addFx(createFx(crit ? critHit : hitSpark, { x: s.x, y: s.y, height: crit ? 14 : 10, flip: hero.x > s.x, seed: Math.floor(hero.time * 60) }));
      if (dead) kill(s);
    }
    // les passages d'école : le feu brûle les barricades ; la ruée et le séisme brisent les murs fissurés
    const fire = imp.fire || (imp.sword && skills.has("lame-ardente"));
    if (fire) for (const [x, y] of level.breakIn("%", imp.box)) {
      game.addFx(createFx(poof, { x, y: y + 8, seed: 5, palette: ["#1a0f0a", "#3a2418", "#6a4a30", "#9a7a58"] }), 1.2);
      game.addFx(createFx(hitSpark, { x, y: y + 8, height: 8, palette: FLAME, seed: 7 }));
      game.emit("ignite", { x });
      touched = true;
    }
    if (imp.quake || imp.smash) for (const [x, y] of level.breakIn("X", imp.box)) {
      game.addFx(createFx(poof, { x, y: y + 8, seed: 6, palette: ["#16131f", "#2c273d", "#4f4669", "#7b6f9c"] }), 1.2);
      game.emit("boom", { x });
      touched = true;
    }
    // un coup qui porte gèle le monde et secoue l'image ; un coup dans le vide, non (sauf une explosion)
    if (touched || imp.always) {
      freeze = Math.max(freeze, imp.stop ?? 0.06);
      game.shake(imp.shake ?? 0.12, imp.amp ?? 1);
      if (imp.sound) game.emit(imp.sound, { x: (imp.box.x0 + imp.box.x1) / 2 });
    }
  }

  // la transition se dessine par-dessus tout, à l'écran
  function drawTransition() {
    if (!trans) return;
    const [ox, oy] = burnAway.meta.origin;
    trans.fx.options.x = frame.ox + ox;
    trans.fx.options.y = frame.oy + oy;
    trans.fx.draw(frame);
  }

  // ce que la scène peut demander au jeu
  const services = {
    emit: (t, e) => game.emit(t, e),
    say: (t) => game.say(t),
    shake: (t, a) => game.shake(t, a),
    addFx: (fx, s) => game.addFx(fx, s),
    save: () => game.onSave?.(game.save()),
    onShard() {
      stats.shards++;
      const total = shardTotal();
      hero.bonusHp = Math.floor(total / 3);
      if (total % 3 === 0) hero.hp = hero.maxHp;
      game.say(total % 3 === 0 ? "UN CŒUR DE PLUS !" : `ÉCLAT DE BRASIER  ${total % 3} / 3`);
      services.save();
    },
    /** Le Grand Brasier est-il encore gardé ? */
    guarded: () => enemies.some((e) => e.boss && e.hp > 0),
    onLevelDone() {
      if (!trans && mode === "play") transition(() => { mode = "summary"; summaryT = 0; });
    },
  };

  const game = {
    frame, hero, cam, skills,
    get level() { return level; },
    get mode() { return mode; },
    // les événements de l'image (pour les sons) : { type, x, y, ... } ; main.js les lit après step()
    events: [],
    emit(type, e = {}) { game.events.push({ type, ...e }); },
    /** 0 loin de tout feu, 1 tout près d'un brasero allumé. */
    fireNear() {
      const k = stage.fireNear(hero);
      return mode !== "play" ? 0 : altar ? k * 0.5 : k;
    },
    get enemies() { return enemies; },
    get purse() { return purse; },
    get altarOpen() { return !!altar; },
    spend(n) { purse -= n; },
    say(text) { toast.text = text; toast.t = 2; },
    addFx(fx, speed = 1) { fxs.push({ fx, speed }); },
    addProjectile(p) { projectiles.push(p); },
    /** Un impact qui tombera dans delay secondes (le météore, l'éclair). */
    later(delay, imp) { later.push({ t: delay, imp }); },
    addShield(fx) { shieldFx?.stop(); shieldFx = fx; },
    shake(t, a) { shakeT = shake0 = Math.max(shakeT, t); amp = Math.max(amp * (shakeT > 0 ? 1 : 0), a); },

    /** Ce qu'on garde d'une partie à l'autre : braises, arbre, progression, et où l'on en est. */
    save() {
      if (progress[current] && mode === "play") Object.assign(progress[current], stage.save());
      return { v: SAVE_VERSION, purse, skills: skills.toJSON(), progress, current, where: mode === "map" ? "map" : "level" };
    },
    load(s) {
      if (!s) return;
      // la version 1 ne connaissait qu'un niveau, les Remparts
      if (s.v === 1) s = { purse: s.purse, skills: s.skills, progress: { remparts: { done: false, lit: s.lit ?? [], checkpoint: s.checkpoint ?? null } }, current: "remparts", where: "level" };
      else if (s.v !== SAVE_VERSION) return;
      purse = s.purse ?? 0;
      skills.load(s.skills);
      progress = s.progress ?? {};
      if (s.where === "map") { current = place(s.current) ? s.current : FIRST; toMap(); }
      else enter(place(s.current)?.def ? s.current : FIRST);
    },

    // un pas de 1/120 s : le chevalier, ses coups, les ennemis, les contacts
    tick(dt, keys) {
      for (const imp of hero.step(dt, keys, level, game)) strike(imp);
      cape.step(dt, hero);
      for (const p of projectiles) for (const imp of p.step(dt, game)) strike(imp);
      projectiles = projectiles.filter((p) => !p.dead);
      for (const l of later) if ((l.t -= dt) <= 0) strike(l.imp);
      later = later.filter((l) => l.t > 0);

      for (const m of merchants) m.step(dt, hero);
      hero.oathT = Math.max(0, (hero.oathT ?? 0) - dt);
      stage.tick(dt, hero, services);
      for (const s of enemies) {
        if (s.hp <= 0 || !near(s.x, s.y, 200)) continue;
        s.step(dt, level, hero, services);
        if (s.landed) game.emit("plop", { x: s.x });
        // les attaques des monstres s'entendent : plongeon, charge, morsure
        for (const [flag, sound] of [["swooped", "swoop"], ["charged", "charge"], ["struck", "lunge"]])
          if (s[flag]) { s[flag] = false; game.emit(sound, { x: s.x }); }
        if (s.shot) { const o = s.shot; orbs.push(new Orb(o.x, o.y, o.vx, o.vy)); s.shot = null; game.emit("cast", { x: s.x }); }
        // la brûlure : 1 dégât par seconde, une flammèche à chaque fois
        if (s.burn > 0) {
          s.burn -= dt;
          s.burnT = (s.burnT ?? 0) + dt;
          if (s.burnT >= 1) {
            s.burnT -= 1;
            s.hp -= 1;
            s.flash = 0.08;
            game.addFx(createFx(hitSpark, { x: s.x, y: s.y, height: 12, palette: FLAME, seed: 11 }));
            if (s.hp <= 0) kill(s);
          }
        }
        const me = { x0: hero.x - HW, x1: hero.x + HW, y0: hero.y - HH, y1: hero.y };
        if (s.hp <= 0 || s.stun > 0 || !overlaps(me, s.box())) continue;
        if (hero.shieldT > 0) {
          // le bouclier repousse ce qui le heurte
          s.hit(hero.x, 0, 3);
          game.emit("hit", { x: s.x });
        } else if (hero.hurt(s.x)) {
          game.emit("hurt", { x: hero.x });
          freeze = 0.08;
          game.shake(0.2, 2);
        }
      }
      enemies = enemies.filter((s) => s.hp > 0);
      for (const o of orbs)
        if (o.step(dt, level, hero) && hero.hurt(o.x)) {
          game.emit("hurt", { x: hero.x });
          game.shake(0.2, 2);
        }
      orbs = orbs.filter((o) => !o.dead);
      if (shieldFx) {
        shieldFx.options.x = hero.x;
        shieldFx.options.y = hero.y;
        shieldFx.options.flip = hero.face < 0;
        if (hero.shieldT <= 0) shieldFx.stop();
      }

      const got = embers.step(dt, level, hero);
      for (let i = 0; i < got; i++) game.emit("ember", { x: hero.x, streak: streak++ });
      if (got) streakT = 0.6;
      streakT -= dt;
      if (streakT <= 0) streak = 0;
      purse += got;
      stats.embers += got;
      // plus de cœurs : retour au dernier brasero, les ennemis reviennent
      if (hero.dead) {
        hero.reset();
        stage.died();
        spawnEnemies();
        game.say("VOUS REPRENEZ AU BRASIER");
        game.emit("death");
      }
    },

    step(dt, keys) {
      game.events.length = 0;
      // pendant une transition, les touches ne comptent pas
      if (trans) keys = {};
      const pressed = Object.fromEntries(KEYS.map((k) => [k, !!keys[k] && !prev[k]]));
      prev = { ...keys };
      if (trans) {
        trans.t += dt;
        trans.fx.update(dt);
        if (!trans.swapped && trans.t >= 1.4) { trans.swapped = true; trans.then(); }
        if (trans.fx.done()) trans = null;
      }
      toast.t = Math.max(0, toast.t - dt);
      if (mode === "summary") {
        summaryT += dt;
        // après la Citadelle, la fin du jeu ; sinon la carte
        const last = current === WORLD[WORLD.length - 1].id;
        if (summaryT > 1.5 && !trans && (pressed.attack || pressed.confirm || pressed.jump))
          transition(last ? () => { mode = "ending"; ending = new Ending(shardTotal(), SHARDS_MAX); } : toMap);
        return;
      }
      if (mode === "ending") {
        ending.update(dt);
        if (ending.t > 6.5 && !trans && (pressed.attack || pressed.confirm || pressed.jump)) transition(toMap);
        return;
      }
      if (mode === "map") {
        map.update(dt);
        const id = trans ? null : map.input(pressed, progress, game.emit);
        if (id) transition(() => enter(id));
        return;
      }
      stats.time += dt;
      stage.update(dt, near);

      // l'autel ouvert : le monde attend
      if (altar) {
        altar.update(dt);
        if (altar.input(pressed, game) === "close") {
          altar = null;
          game.emit("close");
        }
        return;
      }
      // V : passer au coup spécial suivant parmi ceux qu'on a appris
      if (pressed.cycle) {
        const id = skills.cycle();
        if (id) {
          game.emit("equip");
          game.say(node(id).name.toUpperCase());
        }
      }
      // C : l'échoppe devant un marchand, sinon le coup spécial équipé
      if (pressed.special) {
        if (merchantHere() && !hero.busy) {
          altar = new Altar(merchantHere().school);
          game.emit("open");
          return;
        }
        const n = skills.equipped && node(skills.equipped);
        if (n && !hero.busy && hero.ardor >= n.ardor) {
          hero.ardor -= n.ardor;
          hero.special = new Special(n.id, hero);
          // un sort du Serment fait apparaître les plateformes de lumière pour 8 s
          if (n.branch.id === "serment") hero.oathT = 8;
        } else if (n) game.emit("deny");
      }

      shakeT = Math.max(0, shakeT - dt);
      // gel à l'impact : rien ne bouge, sauf les braseros (le feu ne s'arrête pas)
      if (freeze > 0) {
        freeze -= dt;
        acc = 0;
        return;
      }
      acc += Math.min(dt, 0.1);
      while (acc >= STEP) {
        acc -= STEP;
        game.tick(STEP, keys);
      }
      for (const e of fxs) e.fx.update(dt * e.speed);
      fxs = fxs.filter((e) => !e.fx.done());
      if (shieldFx) {
        shieldFx.update(dt);
        if (shieldFx.done()) shieldFx = null;
      }
      follow(dt);
    },

    draw() {
      if (mode !== "play") {
        frame.ox = frame.oy = 0;
        if (mode === "summary") drawSummary(frame, stats, summaryT);
        else if (mode === "ending") ending.draw(frame);
        else map.draw(frame, progress);
        drawTransition();
        return frame;
      }
      const k = shakeT > 0 ? amp * (shakeT / shake0) : 0, n = Math.floor(shakeT * 60);
      frame.ox = Math.round(cam.x + Math.sin(n * 2.4) * k);
      frame.oy = Math.round(cam.y + Math.cos(n * 3.7) * k * 0.7);
      frame.light.fill(0);
      stage.drawBack(frame, cam, near);
      const p = painterFor(frame);
      for (const m of merchants) if (near(m.x, m.y)) { m.drawBack(frame, p.place(0, 0)); m.drawMage(frame); m.drawFront(frame, painterFor(frame)); }
      for (const s of enemies) if (near(s.x, s.y)) s.draw(frame);
      for (const e of fxs) e.fx.draw(frame, "back");
      shieldFx?.draw(frame, "back");
      cape.draw(painterFor(frame));
      drawKnight(frame, hero);
      shieldFx?.draw(frame, "front");
      for (const e of fxs) e.fx.draw(frame, "front");
      for (const p of projectiles) p.draw(frame);
      for (const o of orbs) o.draw(painterFor(frame));
      stage.drawFront(frame, near);
      stage.drawDark(frame, hero, [...merchants.map((m) => [m.x, m.y - 20, 70]), ...enemies.filter((e) => e.boss).map((e) => [e.x, e.y - 20, 90])]);
      embers.draw(painterFor(frame), hero.time);
      const at = merchantHere();
      const gate = !altar && !enemies.some((e) => e.boss && e.active) && stage.gateNear(hero);
      const boss = enemies.find((e) => e.boss && e.active);
      drawHud(frame, { boss: boss && { name: boss.name, hp: boss.hp, max: boss.max }, hp: hero.hp, maxHp: hero.maxHp, purse, toast, ardor: hero.ardor, equipped: skills.equipped, specials: [...skills.owned].filter((id) => node(id).ardor).length, altarHint: at && !altar ? [at.x, at.y] : null, gate });
      if (altar) altar.draw(frame, game);
      drawTransition();
      return frame;
    },
  };
  enter(FIRST);
  return game;
}
