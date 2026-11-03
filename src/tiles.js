// Le décor, dessiné en code comme les effets : un ciel, des silhouettes au loin, des blocs de pierre, des planches.
// Les couleurs viennent du thème du niveau (src/levels/*.js) ; le bois et la lune sont communs.

import { hex, mix, rand } from "pixelfx";
import { TILE } from "./level.js";

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const C = Object.fromEntries(
  Object.entries({
    star: "#cfc8ff", moon: "#efe6c8", moonD: "#b9ab88", window: "#e8a83e", windowD: "#a0582a",
    wood: "#8a5a32", woodL: "#b9884f", woodD: "#5a3820", woodK: "#2a1810",
  }).map(([k, v]) => [k, hex(v)]),
);
// le thème en couleurs prêtes à peindre, calculé une fois par thème
const themes = new WeakMap();
function colors(theme) {
  let T = themes.get(theme);
  if (T) return T;
  const st = Object.fromEntries(Object.entries(theme.stone).map(([k, v]) => [k, hex(v)]));
  T = { ...st, skyTop: hex(theme.sky[0]), skyLow: hex(theme.sky[1]), far: hex(theme.far[0]), farLit: hex(theme.far[1]), near: hex(theme.near[0]), nearEdge: hex(theme.near[1]), moss: theme.moss?.map(hex) };
  themes.set(theme, T);
  return T;
}

// ---- l'arrière-plan, en coordonnées d'écran, décalé par la caméra (parallaxe)
const towerAt = (i, seed) => {
  const r = rand(i, 0, seed);
  return { h: 40 + Math.floor(r * 50), w: 18 + Math.floor(rand(i, 1, seed) * 14), win: rand(i, 2, seed) > 0.45 };
};

export function drawBackdrop(frame, cam, theme) {
  const { w: W, h: H, color } = frame, T = colors(theme);
  const farX = cam.x * 0.15, nearX = cam.x * 0.4, yOff = cam.y * 0.1;
  for (let y = 0; y < H; y++) {
    const t = y / H;
    for (let x = 0; x < W; x++) {
      const d = BAYER[((y & 3) << 2) | (x & 3)] / 16;
      let c = mix(T.skyTop, T.skyLow, Math.min(1, Math.floor(t * 5 + d) / 4));
      const sx = Math.floor(x + cam.x * 0.03), r = rand(sx, y, 91);
      if (theme.stars && r > 0.9965 && y < 110) c = mix(c, C.star, 0.3 + (r - 0.9965) * 200);
      color[y * W + x] = c;
    }
  }
  // la lune, avec un croissant d'ombre
  if (theme.moon) moon(frame, cam);
  skyline(frame, farX, 118 - yOff, 64, T.far, T.farLit, 7, false);
  skyline(frame, nearX, 140 - yOff, 92, T.near, T.nearEdge, 11, theme.windows);
}

function moon(frame, cam) {
  const { w: W, color } = frame;
  const mx = 250 - Math.floor(cam.x * 0.02), my = 34;
  for (let y = -11; y <= 11; y++)
    for (let x = -11; x <= 11; x++) {
      const px = mx + x, py = my + y;
      if (px < 0 || px >= W || x * x + y * y > 110) continue;
      const lit = (x + 4) * (x + 4) + (y - 3) * (y - 3) > 70 && x > 2;
      color[py * W + px] = lit || rand(x, y, 3) > 0.93 ? C.moonD : C.moon;
    }
}

// une rangée de tours crénelées ; les plus proches ont des fenêtres éclairées
function skyline(frame, scroll, base, span, body, edge, seed, windows) {
  const { w: W, h: H, color } = frame;
  for (let x = 0; x < W; x++) {
    const wx = x + Math.floor(scroll), i = Math.floor(wx / span), lx = wx - i * span, T = towerAt(i, seed);
    const tx0 = (span - T.w) >> 1, inTower = lx >= tx0 && lx < tx0 + T.w;
    // un mur bas entre les tours, crénelé tous les 6 px
    let top = base - 14 - ((Math.floor(wx / 6) & 1) ? 0 : 3);
    if (inTower) top = base - T.h - (((lx - tx0) >> 2) & 1 ? 0 : 4);
    for (let y = Math.max(0, Math.floor(top)); y < H; y++) {
      let c = y === Math.floor(top) ? edge : body;
      if (inTower && windows && T.win) {
        const wy = Math.floor(base - T.h + 12), cx = tx0 + (T.w >> 1);
        if (Math.abs(lx - cx) <= 1 && y >= wy && y < wy + 6) c = y === wy ? C.windowD : C.window;
      }
      color[y * W + x] = c;
    }
  }
}

// ---- les tuiles, en coordonnées du monde
const stoneCache = new Map();
function stoneTile(level, tx, ty) {
  const C = colors(level.theme), open = (dx, dy) => !level.solid(tx + dx, ty + dy);
  const up = open(0, -1), left = open(-1, 0), right = open(1, 0), down = open(0, 1);
  const key = `${level.def.id}${up}${left}${right}${down}${(tx * 7 + ty * 3) & 3}`;
  let t = stoneCache.get(key);
  if (t) return t;
  t = new Uint32Array(TILE * TILE);
  const v = (tx * 7 + ty * 3) & 3;
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const row = y >> 3, off = (row + v) & 1 ? 8 : 0, bx = (x + off) & 15, by = y & 7;
      let c = by === 7 || bx === 0 ? C.mortar : by === 0 || bx === 1 ? C.brickL : by >= 5 || bx >= 13 ? C.brickD : C.brick;
      if (rand(x + v * 16, y, 5) > 0.93 && c !== C.mortar) c = C.brickD;
      if (left && x === 0) c = C.shade;
      if (right && x === 15) c = C.mortar;
      if (down && y === 15) c = C.mortar;
      if (up && y === 0) c = C.edge;
      else if (up && y === 1) c = C.edgeD;
      else if (up && y === 2 && C.moss && rand(x, v, 9) > 0.55) c = C.moss[rand(x, v, 4) > 0.5 ? 0 : 1];
      t[y * TILE + x] = c;
    }
  stoneCache.set(key, t);
  return t;
}

function plank(x, y) {
  // une planche de 5 px de haut, avec deux taquets dessous
  if (y === 0) return C.woodL;
  if (y < 3) return x % 8 === 7 ? C.woodK : C.wood;
  if (y === 3) return C.woodD;
  if (y === 4) return C.woodK;
  if ((x === 3 || x === 12) && y < 9) return y === 8 ? C.woodK : C.woodD;
  return 0;
}

export function drawTiles(frame, level) {
  const { w: W, h: H, color, ox, oy } = frame;
  const tx0 = Math.floor(ox / TILE), ty0 = Math.floor(oy / TILE);
  for (let ty = ty0; ty <= ty0 + Math.ceil(H / TILE); ty++)
    for (let tx = tx0; tx <= tx0 + Math.ceil(W / TILE); tx++) {
      const ch = level.at(tx, ty);
      if (ch !== "#" && ch !== "=") continue;
      const tile = ch === "#" ? stoneTile(level, tx, ty) : null;
      for (let y = 0; y < TILE; y++) {
        const py = ty * TILE + y - oy;
        if (py < 0 || py >= H) continue;
        for (let x = 0; x < TILE; x++) {
          const px = tx * TILE + x - ox;
          if (px < 0 || px >= W) continue;
          const c = tile ? tile[y * TILE + x] : plank(x, y);
          if (c) color[py * W + px] = c;
        }
      }
    }
}
