// Les polices pixelfx ne connaissent que les majuscules sans accents. On en tire deux polices françaises, « fr » (5 x 7)
// et « frmini » (3 x 5) : deux lignes de plus au-dessus pour les accents, une en dessous pour la cédille.
// p.text(str, x, y, c, { font: "fr" }) ; les minuscules s'écrivent en majuscules.

import { FONTS } from "pixelfx";

// les accents, sur deux lignes, pour un glyphe de 3 et de 5 de large
const MARKS = {
  acute: { 3: ["..#", ".#."], 5: ["...#.", "..#.."] },
  grave: { 3: ["#..", ".#."], 5: [".#...", "..#.."] },
  circ: { 3: [".#.", "#.#"], 5: ["..#..", ".#.#."] },
  uml: { 3: ["#.#", "..."], 5: [".#.#.", "....."] },
};
const ACCENTED = {
  À: ["A", "grave"], Â: ["A", "circ"], É: ["E", "acute"], È: ["E", "grave"], Ê: ["E", "circ"], Ë: ["E", "uml"],
  Î: ["I", "circ"], Ï: ["I", "uml"], Ô: ["O", "circ"], Ù: ["U", "grave"], Û: ["U", "circ"], Ü: ["U", "uml"],
};

function frenchFont(base) {
  const glyphs = {}, blank = (w) => Array.from({ length: w }, () => false);
  const pad = (g, above = [blank(g.w), blank(g.w)], below = [blank(g.w)]) => ({ w: g.w, rows: [...above, ...g.rows, ...below] });
  for (const [ch, g] of Object.entries(base.glyphs)) glyphs[ch] = pad(g);
  for (const [ch, [letter, mark]] of Object.entries(ACCENTED)) {
    const g = base.glyphs[letter], src = MARKS[mark][g.w <= 3 ? 3 : 5];
    // centrer l'accent sur la lettre
    const off = Math.floor((g.w - src[0].length) / 2);
    const above = src.map((r) => blank(g.w).map((_, i) => r[i - off] === "#"));
    glyphs[ch] = pad(g, above);
  }
  // la cédille : un crochet sous le C
  const c = base.glyphs.C, mid = Math.floor(c.w / 2);
  glyphs.Ç = pad(c, undefined, [blank(c.w).map((_, i) => i === mid)]);
  return { h: base.h + 3, space: base.space, gap: base.gap, glyphs };
}

FONTS.fr = frenchFont(FONTS.big);
FONTS.frmini = frenchFont(FONTS.mini);
