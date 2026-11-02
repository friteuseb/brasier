// Le navigateur : clavier, boucle d'animation, affichage agrandi au pixel près.

import { composite } from "pixelfx";
import { createGame, W, H } from "./game.js";
import * as audio from "./audio.js";

const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
canvas.width = W;
canvas.height = H;
const img = new ImageData(W, H);

// QWERTY et AZERTY : flèches, WASD ou ZQSD
const KEYS = {
  left: ["ArrowLeft", "KeyA", "KeyQ"],
  right: ["ArrowRight", "KeyD"],
  jump: ["Space", "ArrowUp", "KeyW", "KeyZ"],
  attack: ["KeyX", "KeyJ"],
};
// une touche tapée plus vite qu'une image compte quand même : on la garde jusqu'à la fin de l'image suivante
const down = new Set(), tapped = new Set();
const keys = { left: false, right: false, jump: false, attack: false };
const sync = () => { for (const [k, codes] of Object.entries(KEYS)) keys[k] = codes.some((c) => down.has(c) || tapped.has(c)); };
addEventListener("keydown", (e) => {
  // le navigateur n'ouvre le son qu'après un geste ; M coupe et rend le son
  audio.unlock();
  if (e.code === "KeyM" && !e.repeat) game.say(audio.toggleMute() ? "SON COUPÉ" : "SON RÉTABLI");
  if (Object.values(KEYS).flat().includes(e.code)) e.preventDefault();
  down.add(e.code);
  tapped.add(e.code);
  sync();
});
addEventListener("keyup", (e) => { down.delete(e.code); sync(); });
addEventListener("blur", () => { down.clear(); sync(); });

function fit() {
  const k = Math.max(1, Math.floor(Math.min(innerWidth / W, innerHeight / H)));
  canvas.style.width = `${W * k}px`;
  canvas.style.height = `${H * k}px`;
}
addEventListener("resize", fit);
fit();

const game = createGame();
// la partie se garde dans le navigateur à chaque brasero ; un stockage refusé n'empêche pas de jouer
const SAVE = "brasier.save";
try { game.load(JSON.parse(localStorage.getItem(SAVE))); } catch {}
const store = () => { try { localStorage.setItem(SAVE, JSON.stringify(game.save())); } catch {} };
game.onSave = store;
addEventListener("visibilitychange", () => document.hidden && store());
let last = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.step(dt, keys);
  audio.play(game.events, game.cam, W);
  audio.fireLevel(game.fireNear());
  tapped.clear();
  sync();
  composite(game.draw(), img.data, null);
  ctx.putImageData(img, 0, 0);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
