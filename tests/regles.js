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
    loupsEntreDevorer: !!opts.loupsEntreDevorer,
    votesDetailles: !!opts.votesDetailles,
    voteConfiance: !!opts.voteConfiance,
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
      Engine.repondre(sp.input.extra ? "personne" : sp.input.candidats.slice(-sp.input.min));
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

Object.assign(tests, {
  "Les loups ne peuvent pas se dévorer, sauf option"() {
    partie(["loup-garou", "loup-garou", "villageois", "villageois", "villageois", "villageois"]);
    assert(!jusqua("loups").input.candidats.includes(1));
    assert(!Engine.spec().skip, "les loups doivent voter");
    partie(["loup-garou", "loup-garou", "villageois", "villageois", "villageois", "villageois"], { loupsEntreDevorer: true });
    assert(jusqua("loups").input.candidats.includes(1));
  },
  "Le récap du matin annonce l'amoureux mort de chagrin"() {
    partie(["loup-garou", "cupidon", "villageois", "villageois", "villageois", "villageois", "villageois"]);
    rep("cupidon", [2, 3]);
    rep("loups", [2]);
    jusqua("info");
    while (Engine.spec().titre !== "Le village se réveille") Engine.repondre(null);
    const t = Engine.spec().texte;
    assert(t.includes("J2") && t.includes("J3") && t.includes("amoureux de J2"), t);
    Engine.repondre(null);
    assert.notStrictEqual(Engine.spec().titre, "Mort de chagrin");
  },
  "Parité loups / villageois : victoire des loups sans rôle spécial"() {
    partie(["loup-garou", "loup-garou", "villageois", "villageois", "villageois"]);
    rep("loups", [2]);
    jusqua("victoire");
    assert(Engine.spec().texte.includes("autant de Loups-Garous"));
  },
  "Parité : la partie continue s'il reste une Sorcière avec potion"() {
    partie(["loup-garou", "loup-garou", "sorciere", "villageois", "villageois"]);
    rep("loups", [3]);
    rep("sorciere-vie", "non");
    jusqua("vote");
  },
  "Pas de successeur au Capitaine quand la partie est finie"() {
    partie(["loup-garou", "villageois", "villageois", "villageois"], { capitaine: true });
    rep("loups", [1]);
    rep("election", [0]);
    rep("vote", [0]);
    jusqua("victoire");
    assert(!S().queue.some((x) => x.t === "successeur"));
  },
  "Le Corbeau ne peut pas désigner un Vagabond"() {
    partie(["loup-garou", "corbeau", "villageois", "villageois", "villageois"], { metiers: ["vagabond", "barbier", "vagabond", "fermier", "fermier"] });
    const c = jusqua("corbeau").input.candidats;
    assert(!c.includes(0) && !c.includes(2) && c.includes(1));
  },
  "Votes détaillés : décompte, Capitaine double, Tavernier"() {
    partie(["loup-garou", "villageois", "villageois", "villageois", "villageois", "villageois"], { votesDetailles: true, capitaine: true, metiers: ["fermier", "fermier", "tavernier", "fermier", "fermier", "fermier"] });
    rep("election", [1]);
    // J1 (Capitaine, ×2) et J0 votent J3, J2 (Tavernier), J3 et J4 votent J0 : 3 contre 3 → égalité.
    jusqua("vote");
    assert.strictEqual(Engine.spec().input.kind, "votes");
    Engine.repondre({ 0: 3, 1: 3, 2: 0, 3: 0, 4: 0 });
    assert(Engine.spec().texte.includes("Égalité"));
    assert(alive(0) && alive(3));
    assert(S().mem.tavernierImmun);
    jusqua("vote");
    Engine.repondre({ 0: 4, 1: 0, 2: 0, 3: 0 });
    jusqua("victoire");
    assert(!alive(0));
    assert(!S().mem.tavernierImmun, "le Tavernier a voté contre le condamné");
  },
  "Jeton de vote : un joueur privé de vote n'apparaît pas parmi les votants"() {
    partie(["loup-garou", "villageois", "villageois", "villageois", "villageois"], { votesDetailles: true });
    jusqua("vote");
    Engine.basculerVote(2);
    assert(!Engine.spec().input.votants.includes(2));
    assert(!Engine.peutVoter(2));
    Engine.basculerVote(2);
    assert(Engine.spec().input.votants.includes(2));
  },
  "Vote de confiance : choix classique à un tour"() {
    partie(["loup-garou", "villageois", "villageois", "villageois", "villageois", "villageois"], { voteConfiance: true });
    jusqua("vote");
    Engine.repondre("classique");
    assert(Engine.spec().input.extra, "vote classique attendu");
  },
  "Vote de confiance : chaîne depuis le Capitaine jusqu'au dernier suspect"() {
    partie(["loup-garou", "villageois", "villageois", "villageois", "villageois", "villageois"], { voteConfiance: true, capitaine: true });
    rep("election", [2]);
    jusqua("vote");
    assert.strictEqual(Engine.spec().input.kind, "choice");
    Engine.repondre("confiance");
    let sp = Engine.spec();
    assert(sp.dire.includes("J2"));
    assert(!sp.input.candidats.includes(2));
    Engine.repondre([3]);              // J2 innocente J3
    assert(!Engine.spec().input.candidats.includes(3));
    Engine.repondre([4]);              // J3 innocente J4
    Engine.repondre([2]);              // J4 innocente J2 (le Capitaine)
    Engine.repondre([1]);              // J2 innocente J1 → reste J0
    assert(Engine.spec().texte.includes("J0"));
    jusqua("victoire");
    assert(!alive(0));
  },
  "Ancien empoisonné par la Sorcière : les villageois perdent leurs pouvoirs"() {
    partie(["loup-garou", "ancien", "sorciere", "voyante", "villageois", "villageois"]);
    rep("loups", [5]);
    rep("sorciere-vie", "non");
    rep("sorciere-mort", [1]);
    jusqua("vote");
    assert(!alive(1));
    assert(S().mem.pouvoirsPerdus);
    Engine.repondre("personne");
    jusqua("loups");
  },
  "Ancien abattu par le Chasseur : les villageois perdent leurs pouvoirs"() {
    partie(["loup-garou", "ancien", "chasseur", "voyante", "villageois", "villageois", "villageois"]);
    rep("loups", [2]);
    rep("chasseur", [1]);
    jusqua("vote");
    assert(S().mem.pouvoirsPerdus);
    Engine.repondre("personne");
    for (let k = 0; k < 20 && etape() !== "loups"; k++) {
      assert.notStrictEqual(etape(), "voyante", "la Voyante ne doit plus être appelée");
      Engine.repondre(null);
    }
  },
  "Comédien avec le pouvoir de l'Ancien : survit à l'attaque des loups"() {
    partie(["loup-garou", "comedien", "villageois", "villageois", "villageois"], { horsJeu: ["ancien", "chasseur", "voyante"] });
    rep("comedien", "ancien");
    rep("loups", [1]);
    jusqua("vote");
    assert(alive(1));
  },
  "Comédien avec le pouvoir du Chasseur : tire en mourant"() {
    partie(["loup-garou", "comedien", "villageois", "villageois", "villageois", "villageois"], { horsJeu: ["chasseur", "voyante", "ancien"] });
    rep("comedien", "chasseur");
    rep("loups", [1]);
    jusqua("chasseur");
  },
  "Le Comédien se réveille en premier, avant Cupidon"() {
    partie(["loup-garou", "comedien", "cupidon", "voleur", "villageois"], { horsJeu: ["voyante", "villageois", "chasseur"] });
    jusqua("comedien");
    assert(!S().history.some((h) => h.current && ["voleur", "cupidon"].includes(h.current.t)));
  },
});

let ok = 0;
for (const [nomTest, f] of Object.entries(tests)) {
  try { f(); ok++; console.log("✓ " + nomTest); } catch (e) { console.log("✗ " + nomTest + "\n   " + e.message); process.exitCode = 1; }
}
console.log(ok + "/" + Object.keys(tests).length + " scénarios OK");
