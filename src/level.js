// Un niveau : une carte de caractères, des tuiles de 16 px.
//   #  pierre (solide)      =  planche (on la traverse par-dessous)
//   B  brasero posé au sol  P  départ du chevalier
//   S  slime

export const TILE = 16;

export const LEVEL1 = [
  "................................................................................................",
  "................................................................................................",
  "................................................................................................",
  "...................................B............................................................",
  ".................................====...........................................................",
  "................................................................................................",
  "..............................B...................................B...........B.................",
  ".................B...........===............B....................###.......S#####.===...........",
  "...............#####.......................####..........................########...............",
  ".P..B........#######.S.........S......S.#######......B...===....S...S.###########.......S...B...",
  "#######...#############....#######....#########....####.......###################.....##########",
  "#######...#############....#######....#########....####.......###################.....##########",
];

export class Level {
  constructor(rows) {
    this.h = rows.length;
    this.w = Math.max(...rows.map((r) => r.length));
    this.cells = rows.map((r) => r.padEnd(this.w, "."));
    this.braziers = [];
    this.slimes = [];
    this.spawn = { x: TILE, y: TILE };
    this.cells.forEach((row, ty) =>
      [...row].forEach((ch, tx) => {
        const cx = tx * TILE + TILE / 2, foot = (ty + 1) * TILE;
        if (ch === "B") this.braziers.push([cx, foot]);
        if (ch === "P") this.spawn = { x: cx, y: foot };
        if (ch === "S") this.slimes.push([cx, foot]);
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
