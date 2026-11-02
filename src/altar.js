// L'autel du brasier : l'écran de l'arbre d'évolution. Trois colonnes (les voies), quatre paliers chacune.
// Flèches : choisir ; X ou Entrée : acheter, ou équiper un coup spécial déjà appris ; C ou Échap : fermer.

import { hex, mix, painterFor } from "pixelfx";
import { BRANCHES, node } from "./skills.js";

const C = Object.fromEntries(
  Object.entries({ ink: "#0d0a14", panel: "#1a1526", edge: "#3a3050", text: "#f4e6c8", dim: "#7a6e8a", lock: "#4a4258", gold: "#ffc23d", red: "#e0503e" }).map(([k, v]) => [k, hex(v)]),
);
const COLS = [55, 160, 265], BOX_W = 96, BOX_H = 20, TOP = 46, GAP = 25;

export class Altar {
  constructor() {
    this.col = 0;
    this.row = 0;
    this.flash = 0; // l'éclat d'un achat
    this.msg = "";
  }

  /** pressed : les touches tout juste appuyées. Renvoie "close" pour fermer. */
  input(pressed, game) {
    if (pressed.special || pressed.back) return "close";
    if (pressed.left) this.col = (this.col + 2) % 3;
    if (pressed.right) this.col = (this.col + 1) % 3;
    if (pressed.up) this.row = Math.max(0, this.row - 1);
    if (pressed.down) this.row = Math.min(3, this.row + 1);
    if (pressed.left || pressed.right || pressed.up || pressed.down) {
      this.msg = "";
      game.emit("tick");
    }
    if (pressed.attack || pressed.confirm) {
      const n = BRANCHES[this.col].nodes[this.row], sk = game.skills, st = sk.state(n.id);
      if (st === "owned") {
        if (n.ardor && sk.equipped !== n.id) {
          sk.equip(n.id);
          this.msg = `${n.name} équipé (V en jeu change de coup)`;
          game.emit("equip");
        }
      } else if (st === "locked") {
        this.msg = "Apprenez d'abord le palier précédent";
        game.emit("deny");
      } else {
        const paid = sk.buy(n.id, game.purse);
        if (paid) {
          game.spend(paid);
          this.flash = 0.5;
          this.msg = `${n.name} appris`;
          game.emit("learn");
          game.onSave?.(game.save());
        } else {
          this.msg = `Il vous manque ${n.cost - game.purse} braises`;
          game.emit("deny");
        }
      }
    }
  }

  update(dt) {
    this.flash = Math.max(0, this.flash - dt);
  }

  draw(frame, game) {
    const { w: W, h: H, color, light } = frame;
    // le jeu s'assombrit derrière l'autel ; l'autel ne prend pas la lumière
    for (let i = 0; i < color.length; i++) {
      color[i] = mix(color[i], C.ink, 0.72);
      light[i] = 0;
    }
    const p = painterFor(frame);
    p.place(frame.ox, frame.oy);
    p.text("AUTEL DU BRASIER", W / 2, 6, C.text, { font: "fr", align: "center", outline: C.ink });
    p.text(`${game.purse} BRAISES`, W - 8, 9, C.gold, { font: "frmini", align: "right", outline: C.ink });
    const sk = game.skills;
    BRANCHES.forEach((b, ci) => {
      const cx = COLS[ci], bc = hex(b.color), bd = hex(b.dark);
      p.text(b.name, cx, 26, bc, { font: "fr", align: "center", outline: C.ink });
      b.nodes.forEach((n, ri) => {
        const x = cx - BOX_W / 2, y = TOP + ri * GAP, st = sk.state(n.id), sel = ci === this.col && ri === this.row;
        // le fil qui relie les paliers d'une voie
        if (ri > 0) p.rect(cx - 1, y - GAP + BOX_H, 2, GAP - BOX_H, st === "locked" ? C.lock : bc);
        const fill = st === "owned" ? bd : C.panel, edge = sel ? C.text : st === "owned" ? bc : st === "open" ? C.edge : C.lock;
        p.rect(x, y, BOX_W, BOX_H, edge);
        p.rect(x + 1, y + 1, BOX_W - 2, BOX_H - 2, fill);
        if (sel && this.flash > 0) p.rect(x + 1, y + 1, BOX_W - 2, BOX_H - 2, bc, this.flash * 1.6);
        const tc = st === "locked" ? C.dim : C.text;
        p.text(n.name, x + 4, y + 2, tc, { font: "frmini" });
        // le prix, ou ce que c'est une fois appris
        const tag = st === "owned" ? (n.ardor ? (sk.equipped === n.id ? "ÉQUIPÉ" : "SPÉCIAL") : "APPRIS") : `${n.cost} BRAISES`;
        const tagC = st === "owned" ? bc : game.purse >= n.cost && st === "open" ? C.gold : C.dim;
        p.text(tag, x + BOX_W - 4, y + 10, tagC, { font: "frmini", align: "right" });
        if (n.ardor) p.text(`${n.ardor}%`, x + 4, y + 10, st === "locked" ? C.lock : C.dim, { font: "frmini" });
      });
    });
    const n = node(BRANCHES[this.col].nodes[this.row].id);
    wrap(n.desc, 76).forEach((line, i) => p.text(line, 12, 145 + i * 9, C.text, { font: "frmini", outline: C.ink }));
    // en bas : le résultat du dernier choix, sinon l'aide des touches
    if (this.msg) p.text(this.msg, W / 2, H - 11, C.gold, { font: "frmini", align: "center", outline: C.ink });
    else p.text("FLÈCHES : CHOISIR   X : APPRENDRE OU ÉQUIPER   C : FERMER", W / 2, H - 11, C.dim, { font: "frmini", align: "center" });
  }
}

// couper un texte en lignes d'au plus n caractères
function wrap(text, n) {
  const lines = [];
  let cur = "";
  for (const w of text.split(" ")) {
    if ((cur + " " + w).trim().length > n) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}
