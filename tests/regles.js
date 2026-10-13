// Scénarios ciblés vérifiant quelques règles précises.
// Usage : node tests/regles.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const ctx = { console, Math, JSON };
vm.createContext(ctx);
const src = ["js/data.js", "js/engine.js"].map((f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8")).join("\n");
vm.runInContext(src + "\nthis.Engine = Engine;", ctx);
const { Engine } = ctx;

function partie(roles, opts = {}) {
  Engine.nouvellePartie({
    capitaine: !!opts.capitaine,
    joueurs: roles.map((r, i) => ({ nom: "J" + i, role: r, metier: (opts.metiers || [])[i] || null })),
    horsJeu: opts.horsJeu || [],
  });
}
const S = () => Engine.etat();
const etape = () => S().current.t;
const alive = (i) => S().players[i].alive;

// Répond aux étapes jusqu'à atteindre `type`, en passant / continuant les autres.
function jusqua(type, max = 100) {
  for (let k = 0; k < max; k++) {
    if (etape() === type) return Engine.spec();
    const sp = Engine.spec();
    if (sp.fin) throw new Error("Partie finie avant " + type);
    if (sp.input && sp.input.kind === "choice" && !sp.skip) {
      const o = sp.input.options.find((x) => ["non", "garder", "vote", "continuer"].includes(x.v)) || sp.input.options[sp.input.options.length - 1];
      Engine.repondre(o.v);
    } else if (sp.input && sp.input.kind === "players" && !sp.skip) {
      Engine.repondre(sp.input.extra ? "personne" : sp.input.candidats.slice(0, sp.input.min));
    } else Engine.repondre(null);
  }
  throw new Error("Étape " + type + " jamais atteinte (bloqué sur " + etape() + ")");
}
const rep = (type, r) => { jusqua(type); Engine.repondre(r); };

const tests = {
  "Salvateur protège la victime des loups"() {
    partie(["loup-garou", "salvateur", "villageois", "villageois", "villageois"]);
    rep("salvateur", [2]);
    rep("loups", [2]);
    jusqua("vote");
    assert(alive(2));
  },
  "Sorcière sauve puis empoisonne"() {
    partie(["loup-garou", "sorciere", "villageois", "villageois", "villageois", "villageois"]);
    rep("loups", [2]);
    rep("sorciere-vie", 2);
    rep("sorciere-mort", [3]);
    jusqua("vote");
    assert(alive(2));
    assert(!alive(3));
    assert.strictEqual(S().players[3].mort.cause, "sorciere");
  },
  "Ancien survit à la première attaque seulement"() {
    partie(["loup-garou", "ancien", "villageois", "villageois", "villageois", "villageois"]);
    rep("loups", [1]);
    rep("vote", "personne");
    assert(alive(1));
    rep("loups", [1]);
    jusqua("vote");
    assert(!alive(1));
  },
  "Amoureux meurent ensemble et Chasseur tire"() {
    partie(["loup-garou", "cupidon", "chasseur", "villageois", "villageois", "villageois", "villageois"]);
    rep("cupidon", [2, 3]);
    rep("loups", [3]);
    jusqua("chasseur");
    assert(!alive(3) && !alive(2));
    Engine.repondre([0]);
    jusqua("victoire");
    assert.strictEqual(Engine.spec().texte.includes("village gagne"), true);
  },
  "Idiot du village survit au vote"() {
    partie(["loup-garou", "idiot", "villageois", "villageois", "villageois"]);
    rep("vote", [1]);
    jusqua("loups");
    assert(alive(1));
    assert(S().mem.idiotRevele);
  },
  "Bouc émissaire meurt en cas d'égalité"() {
    partie(["loup-garou", "bouc-emissaire", "villageois", "villageois", "villageois"]);
    rep("vote", "egalite");
    rep("bouc", "Seul J2 vote");
    assert(!alive(1));
  },
  "Infect transforme la victime"() {
    partie(["loup-garou", "infect", "voyante", "villageois", "villageois", "villageois"]);
    rep("loups", [2]);
    rep("infect", "oui");
    jusqua("vote");
    assert(alive(2));
    assert.strictEqual(S().players[2].camp, "loups");
  },
  "Grand Méchant Loup perd son pouvoir quand un loup meurt"() {
    partie(["loup-garou", "grand-mechant-loup", "villageois", "villageois", "villageois", "villageois", "villageois"]);
    rep("loups", [2]);
    rep("gml", [3]);
    rep("vote", [0]);
    jusqua("loups");
    Engine.repondre([4]);
    jusqua("vote");
    assert(!S().queue.some((s) => s.t === "gml"));
    assert(!alive(2) && !alive(3) && !alive(4));
  },
  "Enfant Sauvage devient loup quand son modèle meurt"() {
    partie(["loup-garou", "enfant-sauvage", "villageois", "villageois", "villageois", "villageois"]);
    rep("enfant", [2]);
    rep("loups", [2]);
    jusqua("vote");
    assert.strictEqual(S().players[1].camp, "loups");
  },
  "Chevalier : le loup à sa gauche meurt la nuit suivante"() {
    partie(["villageois", "loup-garou", "chevalier", "villageois", "villageois", "loup-garou", "villageois"]);
    rep("loups", [2]);
    rep("vote", "personne");
    rep("loups", [3]);
    jusqua("vote");
    assert(!alive(1), "le loup à gauche (J1) doit mourir");
    assert(alive(5));
  },
  "Renard : perd son pouvoir sans loup"() {
    partie(["villageois", "villageois", "renard", "villageois", "loup-garou", "villageois"]);
    rep("renard", [1]);
    assert(!S().mem.renardActif);
  },
  "Montreur d'ours grogne avec un loup voisin"() {
    partie(["villageois", "montreur-ours", "loup-garou", "villageois", "villageois"]);
    jusqua("ours");
    assert(Engine.spec().dire.includes("GRRRR"));
  },
  "Ange gagne s'il est éliminé au premier vote"() {
    partie(["loup-garou", "ange", "villageois", "villageois", "villageois"]);
    rep("vote", [1]);
    jusqua("victoire");
    assert(Engine.spec().texte.includes("Ange"));
  },
  "Voleur prend une carte hors-jeu"() {
    partie(["loup-garou", "voleur", "villageois", "villageois"], { horsJeu: ["voyante", "villageois"] });
    rep("voleur", 0);
    assert.strictEqual(S().players[1].role, "voyante");
    jusqua("voyante");
  },
  "Annuler revient à l'étape précédente"() {
    partie(["loup-garou", "voyante", "villageois", "villageois"]);
    jusqua("loups");
    Engine.repondre([2]);
    Engine.annuler();
    assert.strictEqual(etape(), "loups");
  },
  "Servante prend le rôle du condamné"() {
    partie(["loup-garou", "servante", "voyante", "villageois", "villageois"]);
    rep("vote", [2]);
    rep("execution", "oui");
    assert.strictEqual(S().players[1].role, "voyante");
    assert(!alive(2));
  },
};

let ok = 0;
for (const [nomTest, f] of Object.entries(tests)) {
  try { f(); ok++; console.log("✓ " + nomTest); } catch (e) { console.log("✗ " + nomTest + "\n   " + e.message); process.exitCode = 1; }
}
console.log(ok + "/" + Object.keys(tests).length + " scénarios OK");
