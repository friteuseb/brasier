// Les commandes tactiles : des boutons HTML par-dessus le jeu, seulement sur un écran tactile. Chaque bouton tient une
// « touche » virtuelle (Touch:left, Touch:jump...) que main.js traite comme une vraie touche. Plusieurs doigts à la fois.
// À gauche : ◀ ▶ pour courir, ▲ ▼ pour les menus. À droite : saut, épée, sort, changer de sort. En haut : son, plein écran.

const LEFT = [
  { code: "Touch:left", label: "◀", cls: "dir l" },
  { code: "Touch:right", label: "▶", cls: "dir r" },
  { code: "Touch:up", label: "▲", cls: "small u" },
  { code: "Touch:down", label: "▼", cls: "small d" },
];
const RIGHT = [
  { code: "Touch:jump", label: "SAUT", cls: "act jump" },
  { code: "Touch:attack", label: "ÉPÉE", cls: "act sword" },
  { code: "Touch:special", label: "SORT", cls: "act spell" },
  { code: "Touch:cycle", label: "⟳", cls: "small cycle" },
];

// ?tactile dans l'adresse force les boutons, pour les essayer sur ordinateur
export const isTouch = () => matchMedia("(pointer: coarse)").matches || "ontouchstart" in window || new URLSearchParams(location.search).has("tactile");

/** press(code) et release(code) : comme une touche du clavier ; onFirst() : au premier contact (ouvrir le son). */
export function setupTouch({ press, release, onFirst, onMute }) {
  if (!isTouch()) return;
  document.body.classList.add("touch");
  const pad = document.createElement("div");
  pad.id = "pad";
  pad.innerHTML = '<div class="side left"></div><div class="side right"></div><div class="top"><button class="small mute">SON</button><button class="small full">⛶</button></div>';
  document.body.append(pad);
  const add = (side, b) => {
    const el = document.createElement("button");
    el.className = b.cls;
    el.textContent = b.label;
    // chaque doigt garde son bouton jusqu'à ce qu'il se lève, même s'il glisse un peu
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      onFirst();
      el.setPointerCapture(e.pointerId);
      el.classList.add("on");
      press(b.code);
    });
    const up = () => { el.classList.remove("on"); release(b.code); };
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("lostpointercapture", up);
    pad.querySelector(side).append(el);
  };
  LEFT.forEach((b) => add(".left", b));
  RIGHT.forEach((b) => add(".right", b));
  pad.querySelector(".mute").addEventListener("pointerdown", (e) => { e.preventDefault(); onFirst(); onMute(); });
  // le plein écran, et le paysage si le navigateur sait le verrouiller
  pad.querySelector(".full").addEventListener("pointerdown", async (e) => {
    e.preventDefault();
    onFirst();
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
      await screen.orientation?.lock?.("landscape");
    } catch {}
  });
  // pas de menu au long appui, pas de sélection, pas de zoom au double tap
  addEventListener("contextmenu", (e) => e.preventDefault());
}
