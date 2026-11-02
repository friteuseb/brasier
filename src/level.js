// Un niveau : une carte de caractères, des tuiles de 16 px.
//   #  pierre (solide)      =  planche (on la traverse par-dessous)
//   B  brasero posé au sol  P  départ du chevalier
//   M  marchand (l'arbre d'évolution)
//   S  slime   b  chauve-souris   k  crâne de feu   n  serpent   g  fantôme

export const TILE = 16;

export const LEVEL1 = [
  "................................................................................................",
  "................................................................................................",
  "................................................................................................",
  "...................................B.........................................k..................",
  ".................................====........k..................................................",
  "...................................................................................g......b.....",
  "........................b.....B...........................b.......B...........B.................",
  ".................B...........===............B.....g..............###.......S#####.===...........",
  "...............#####.......................####..........................########...............",
  ".P..B......M.#######.S.........n......S.#######......B...===....M...S.###########.......n...B...",
  "#######...#############....#######....#########....####.......###################.....##########",
  "#######...#############....#######....#########....####.......###################.....##########",
];

export class Level {
  constructor(rows) {
    this.h = rows.length;
    this.w = Math.max(...rows.map((r) => r.length));
    this.cells = rows.map((r) => r.padEnd(this.w, "."));
    this.braziers = [];
    this.foes = []; // [lettre, x, y] : les pieds pour ceux qui marchent, le corps pour ceux qui volent
    this.merchants = [];
    this.spawn = { x: TILE, y: TILE };
    this.cells.forEach((row, ty) =>
      [...row].forEach((ch, tx) => {
        const cx = tx * TILE + TILE / 2, foot = (ty + 1) * TILE;
        if (ch === "B") this.braziers.push([cx, foot]);
        if (ch === "P") this.spawn = { x: cx, y: foot };
        if ("Sn".includes(ch)) this.foes.push([ch, cx, foot]);
        if ("bkg".includes(ch)) this.foes.push([ch, cx, ty * TILE + TILE / 2]);
        if (ch === "M") this.merchants.push([cx, foot]);
      }),
    );
    this.pxW = this.w * TILE;
    this.pxH = this.h * TILE;
  }

  at(tx, ty) {
    if (tx < 0 || tx >= this.w) return "#"; // les bords du niveau sont des murs
    if (ty < 0 || ty >= this.h) return ".";
    return this.cells[ty][tx];
  }
  solid(tx, ty) {
    return this.at(tx, ty) === "#";
  }
  oneWay(tx, ty) {
    return this.at(tx, ty) === "=";
  }
}
