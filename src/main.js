// Le navigateur : clavier, boucle d'animation, affichage agrandi au pixel près.

import { composite } from "pixelfx";
import { createGame, W, H } from "./game.js";

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
let last = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.step(dt, keys);
  tapped.clear();
  sync();
  composite(game.draw(), img.data, null);
  ctx.putImageData(img, 0, 0);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
