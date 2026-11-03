// Un niveau : une carte de caractères, des tuiles de 16 px.
//   #  pierre (solide)      =  planche (on la traverse par-dessous)
//   B  brasero posé au sol  P  départ du chevalier   G  Grand Brasier (la fin du niveau)
//   M  marchand (l'arbre d'évolution)
//   S  slime   b  chauve-souris   k  crâne de feu   n  serpent   g  fantôme   f  grenouille   p  nuage de poison
// Les passages d'école : ils barrent un chemin tant que la bonne école ne les a pas ouverts.
//   %  barricade de bois (la Flamme la brûle)   X  mur fissuré (le Séisme de l'Acier le brise)
//   ~  plateforme de lumière (elle porte pendant 8 s après un sort du Serment)   *  éclat de brasier

export const TILE = 16;


export class Level {
  constructor(def) {
    const rows = def.rows;
    this.def = def;
    this.theme = def.theme;
    this.grand = null;
    this.h = rows.length;
    this.w = Math.max(...rows.map((r) => r.length));
    this.cells = rows.map((r) => r.padEnd(this.w, "."));
    this.braziers = [];
    this.foes = []; // [lettre, x, y] : les pieds pour ceux qui marchent, le corps pour ceux qui volent
    this.merchants = [];
    this.poisons = [];
    this.shards = [];
    this.broken = new Set(); // les barricades brûlées et les murs brisés, "tx,ty"
    this.lightOn = false; // les plateformes de lumière portent-elles ?
    this.spawn = { x: TILE, y: TILE };
    this.cells.forEach((row, ty) =>
      [...row].forEach((ch, tx) => {
        const cx = tx * TILE + TILE / 2, foot = (ty + 1) * TILE;
        if (ch === "B") this.braziers.push([cx, foot]);
        if (ch === "P") this.spawn = { x: cx, y: foot };
        if ("Snf".includes(ch)) this.foes.push([ch, cx, foot]);
        if (ch === "p") this.poisons.push([cx, foot]);
        if (ch === "*") this.shards.push([cx, ty * TILE + TILE / 2]);
        if ("bkg".includes(ch)) this.foes.push([ch, cx, ty * TILE + TILE / 2]);
        if (ch === "M") this.merchants.push([cx, foot]);
        if (ch === "G") this.grand = [cx, foot];
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
    const ch = this.at(tx, ty);
    return ch === "#" || ((ch === "%" || ch === "X") && !this.broken.has(`${tx},${ty}`));
  }
  oneWay(tx, ty) {
    const ch = this.at(tx, ty);
    return ch === "=" || (ch === "~" && this.lightOn);
  }
  /** Ouvrir les passages d'un type ("%" ou "X") qui touchent une boîte du monde ; renvoie les cases ouvertes. */
  breakIn(kind, box) {
    const out = [];
    for (let ty = Math.floor(box.y0 / TILE); ty <= Math.floor(box.y1 / TILE); ty++)
      for (let tx = Math.floor(box.x0 / TILE); tx <= Math.floor(box.x1 / TILE); tx++) {
        const k = `${tx},${ty}`;
        if (this.at(tx, ty) === kind && !this.broken.has(k)) {
          this.broken.add(k);
          out.push([tx * TILE + TILE / 2, ty * TILE + TILE / 2]);
        }
      }
    return out;
  }
}
