// Simule des centaines de parties aléatoires pour vérifier que le moteur
// ne plante jamais et que chaque partie se termine.
// Usage : node tests/simulation.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ctx = { console, Math, JSON };
vm.createContext(ctx);
const src = ["js/data.js", "js/engine.js"].map((f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8")).join("\n");
vm.runInContext(src + "\nthis.ROLES = ROLES; this.METIERS = METIERS; this.Engine = Engine;", ctx);
const { Engine, ROLES, METIERS } = ctx;

const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];
const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);

function partie() {
  const n = 6 + rnd(15);
  const speciaux = shuffle(ROLES.filter((r) => !r.statut && r.max === 1).map((r) => r.id)).slice(0, rnd(Math.min(n - 2, 14)));
  const nbLoups = Math.max(1, Math.round(n / 4));
  let cartes = [...speciaux];
  if (Math.random() < 0.2) cartes.push("deux-soeurs", "deux-soeurs");
  if (Math.random() < 0.2) cartes.push("trois-freres", "trois-freres", "trois-freres");
  const sansLoup = Math.random() < 0.1;
  for (let i = 0; i < (sansLoup ? 0 : nbLoups); i++) cartes.push("loup-garou");
  while (cartes.length < n + 5) cartes.push("villageois");
  cartes = shuffle(cartes);
  const metiers = Math.random() < 0.4 ? shuffle(METIERS.map((m) => m.id)) : [];
  const setup = {
    capitaine: Math.random() < 0.7,
    loupsEntreDevorer: Math.random() < 0.5,
    votesDetailles: Math.random() < 0.5,
    voteConfiance: Math.random() < 0.3,
    pesteNoire: Math.random() < 0.3,
    joueurs: Array.from({ length: n }, (_, i) => ({ nom: "J" + i, role: cartes[i], metier: metiers.length ? metiers[i] || "vagabond" : null })),
    horsJeu: cartes.slice(n, n + 3),
  };
  let S = Engine.nouvellePartie(setup);
  let etapes = 0;
  const vus = new Set();
  while (etapes++ < 3000) {
    S = Engine.etat();
    const sp = Engine.spec();
    if (!sp) throw new Error("Aucune étape courante, queue=" + JSON.stringify(S.queue));
    vus.add(S.current.t);
    if (sp.fin) return { etapes, vus, winner: S.winner.camp };
    if (Math.random() < 0.03 && S.history.length) { Engine.annuler(); continue; }
    if (Math.random() < 0.01) { Engine.intercaler({ t: pick(["mort-manuelle", "resurrection"]) }); continue; }
    const inp = sp.input;
    let rep = null;
    if (sp.skip && Math.random() < 0.15) rep = null;
    else if (!inp) rep = null;
    else if (inp.kind === "players") {
      if (inp.extra && Math.random() < 0.15) rep = pick(inp.extra).v;
      else {
        const k = inp.min + rnd(inp.max - inp.min + 1);
        rep = shuffle(inp.candidats).slice(0, k);
        if (rep.length < inp.min) rep = sp.skip ? null : rep;
      }
    } else if (inp.kind === "choice") {
      rep = S.current.t === "victoire" ? (Math.random() < 0.9 ? "fin" : "continuer") : pick(inp.options).v;
    } else if (inp.kind === "text") rep = "note";
    else if (inp.kind === "votes") {
      rep = {};
      inp.votants.forEach((id) => { rep[id] = Math.random() < 0.1 ? "" : pick(inp.candidats); });
    }
    Engine.repondre(rep);
    JSON.stringify(Engine.etat());
  }
  throw new Error("Partie sans fin : " + JSON.stringify({ config: Engine.etat().config, vivants: Engine.etat().players.filter((p) => p.alive).map((p) => p.role + "/" + p.camp), etape: Engine.etat().current, nuit: Engine.etat().nuit }));
}

const N = +(process.argv[2] || 500);
const gagnants = {};
const tous = new Set();
for (let i = 0; i < N; i++) {
  const r = partie();
  gagnants[r.winner] = (gagnants[r.winner] || 0) + 1;
  r.vus.forEach((t) => tous.add(t));
}
console.log(N + " parties OK. Victoires :", gagnants);
console.log("Étapes rencontrées :", [...tous].sort().join(", "));
