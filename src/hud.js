// L'interface en jeu : cœurs, braises, jauge d'ardeur et coup spécial équipé en haut à gauche ; un message au centre ;
// « C : AUTEL » au-dessus d'un brasero allumé. Elle ne prend pas la lumière du décor.

import { hex, painterFor } from "pixelfx";
import { node } from "./skills.js";

const HEART = [".##.##.", "#hh#ll#", "#hllll#", "#lllll#", ".#lll#.", "..#l#..", "...#..."];
const HC = { "#": hex("#1a0c12"), h: hex("#ffd0d8"), l: hex("#e0303e"), e: hex("#3a2a3a") };
const EMBER = ["..#..", ".#o#.", "#oyo#", "#oyo#", ".###."];
const EC = { "#": hex("#5a1410"), o: hex("#f2561d"), y: hex("#ffe26b") };
const INK = hex("#120c18"), TEXT = hex("#f4e6c8"), GOLD = hex("#ffc23d"), DIM = hex("#6a5e7a");
const BAR = [hex("#2a1a2a"), hex("#c9281f"), hex("#ff8a2a"), hex("#ffe26b")];

export function drawHud(frame, s) {
  const { w: W, color, light } = frame;
  // on éteint la lueur sous chaque pixel que l'interface peint
  const before = color.slice();
  const sprite = (rows, ox, oy, pick) =>
    rows.forEach((row, y) => [...row].forEach((ch, x) => ch !== "." && (color[(oy + y) * W + ox + x] = pick(ch))));
  for (let i = 0; i < s.maxHp; i++) sprite(HEART, 6 + i * 9, 6, (ch) => (i < s.hp ? HC[ch] : ch === "#" ? HC["#"] : HC.e));
  sprite(EMBER, 7, 16, (ch) => EC[ch]);
  const p = painterFor(frame);
  p.place(frame.ox, frame.oy);
  p.text(String(s.purse), 15, 15, GOLD, { font: "frmini", outline: INK });

  // l'ardeur : une jauge de 50 px ; le coup équipé s'allume quand elle suffit
  if (s.equipped) {
    const n = node(s.equipped), ready = s.ardor >= n.ardor, y = 27;
    // la jauge et le coup équipé
    p.rect(6, y, 52, 4, INK);
    p.rect(7, y + 1, 50, 2, BAR[0]);
    p.rect(7, y + 1, Math.round(s.ardor / 2), 2, ready ? BAR[3] : BAR[2]);
    p.rect(7 + n.ardor / 2 - 1, y, 1, 4, TEXT); // le seuil du coup équipé
    p.text(`C : ${n.name}`, 62, y - 3, ready ? GOLD : DIM, { font: "frmini", outline: INK });
    if (s.specials > 1) p.text("V : CHANGER", 62, y + 5, DIM, { font: "frmini", outline: INK });
  }
  // la barre de vie d'un gardien, en bas de l'écran
  if (s.boss) {
    const w = 200, x = (W - w) / 2, y = frame.h - 16, k = Math.max(0, s.boss.hp / s.boss.max);
    p.text(s.boss.name, W / 2, y - 11, TEXT, { font: "frmini", align: "center", outline: INK });
    p.rect(x - 1, y - 1, w + 2, 6, INK);
    p.rect(x, y, w, 4, BAR[0]);
    p.rect(x, y, Math.round(w * k), 4, hex("#8048b8"));
    p.rect(x, y, Math.round(w * k), 1, hex("#c8a0f0"));
  }
  if (s.toast.t > 0) p.text(s.toast.text, W / 2, 34, TEXT, { font: "fr", align: "center", outline: INK, a: Math.min(1, s.toast.t / 0.4) });
  if (s.altarHint) {
    const [x, y] = s.altarHint;
    p.text("C : BOUTIQUE", x - frame.ox, y - frame.oy - 74, TEXT, { font: "frmini", align: "center", outline: INK });
  }
  if (s.gate) {
    // l'indice d'un passage d'école, au-dessus de lui, gardé dans l'écran
    const w = p.measure(s.gate.text, { font: "frmini" })[0], x = Math.max(w / 2 + 4, Math.min(W - w / 2 - 4, s.gate.x - frame.ox));
    p.text(s.gate.text, x, Math.max(40, s.gate.y - frame.oy - 12), TEXT, { font: "frmini", align: "center", outline: INK });
  }
  for (let i = 0; i < color.length; i++) if (color[i] !== before[i]) light[i] = 0;
}
