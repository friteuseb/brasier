// L'arbre d'évolution : trois voies de quatre paliers. Chaque palier demande le précédent de sa voie et coûte des
// braises. Les voies se mélangent ; le dernier palier de chacune demande de s'y être engagé jusqu'au bout.
// Un palier est un passif (toujours actif) ou un coup spécial (C en jeu, coûte de l'ardeur, la jauge des combats).

export const BRANCHES = [
  {
    id: "flamme", name: "FLAMME", color: "#ff8a2a", dark: "#5a1c10",
    nodes: [
      { id: "lame-ardente", name: "Lame ardente", cost: 5, desc: "Vos coups d'épée brûlent, et les barricades avec. Le troisième coup inflige 1 dégât de plus." },
      { id: "boule-de-feu", name: "Boule de feu", cost: 10, ardor: 40, desc: "Lance une boule de feu qui explose au contact : 3 dégâts autour d'elle. Brûle les barricades." },
      { id: "brulure", name: "Brûlure", cost: 15, desc: "Vos coups enflamment l'ennemi : 1 dégât par seconde pendant 3 secondes." },
      { id: "meteores", name: "Météore", cost: 25, ardor: 100, desc: "Appelle un météore devant vous : 6 dégâts sur une large zone." },
    ],
  },
  {
    id: "serment", name: "SERMENT", color: "#ffe26b", dark: "#4a3a10",
    nodes: [
      { id: "coeur-vaillant", name: "Cœur vaillant", cost: 5, desc: "Un cœur de plus." },
      { id: "chatiment", name: "Châtiment", cost: 10, ardor: 40, desc: "Un éclair frappe l'ennemi le plus proche devant vous : 4 dégâts. Réveille les plateformes de lumière." },
      { id: "soin", name: "Prière", cost: 15, ardor: 60, desc: "Rend 2 cœurs." },
      { id: "bouclier", name: "Bouclier divin", cost: 25, ardor: 100, desc: "Six secondes intouchable. Les ennemis qui vous heurtent sont repoussés." },
    ],
  },
  {
    id: "acier", name: "ACIER", color: "#a8c8ff", dark: "#1c2a4a",
    nodes: [
      { id: "elan", name: "Élan", cost: 5, desc: "Vous courez plus vite et vos coups d'épée s'enchaînent plus vite." },
      { id: "ruee", name: "Ruée", cost: 10, ardor: 40, desc: "Une ruée intouchable sur six cases : 3 dégâts à tout ce qu'elle traverse. Brise les murs fissurés." },
      { id: "critique", name: "Coup critique", cost: 15, desc: "Le troisième coup du combo inflige double dégât." },
      { id: "seisme", name: "Séisme", cost: 25, ardor: 100, desc: "Bondit et frappe le sol : 5 dégâts autour de vous. Brise les murs fissurés." },
    ],
  },
];

const NODES = new Map(BRANCHES.flatMap((b) => b.nodes.map((n, tier) => [n.id, { ...n, branch: b, tier }])));
export const node = (id) => NODES.get(id);

/** Ce que le chevalier a appris : les paliers achetés et le coup spécial équipé. */
export class Skills {
  constructor() {
    this.owned = new Set();
    this.equipped = null;
  }
  has(id) {
    return this.owned.has(id);
  }
  /** "owned" | "open" (achetable si assez de braises) | "locked" (le palier d'avant manque) */
  state(id) {
    if (this.owned.has(id)) return "owned";
    const n = NODES.get(id);
    return n.tier === 0 || this.owned.has(n.branch.nodes[n.tier - 1].id) ? "open" : "locked";
  }
  /** Acheter un palier ; renvoie le prix payé, ou 0 si impossible. Un coup spécial acheté est équipé. */
  buy(id, purse) {
    const n = NODES.get(id);
    if (this.state(id) !== "open" || purse < n.cost) return 0;
    this.owned.add(id);
    if (n.ardor) this.equipped = id;
    return n.cost;
  }
  equip(id) {
    if (this.owned.has(id) && NODES.get(id).ardor) this.equipped = id;
  }
  /** Passer au coup spécial appris suivant (dans l'ordre de l'arbre) ; renvoie le nouveau, ou null. */
  cycle() {
    const list = BRANCHES.flatMap((b) => b.nodes).filter((n) => n.ardor && this.owned.has(n.id)).map((n) => n.id);
    if (list.length < 2) return null;
    this.equipped = list[(list.indexOf(this.equipped) + 1) % list.length];
    return this.equipped;
  }
  toJSON() {
    return { owned: [...this.owned], equipped: this.equipped };
  }
  load(s) {
    this.owned = new Set((s?.owned ?? []).filter((id) => NODES.has(id)));
    this.equipped = this.owned.has(s?.equipped) ? s.equipped : null;
  }
}
