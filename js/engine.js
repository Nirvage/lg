// Moteur de partie : enchaîne les étapes de la nuit et du jour
// en tenant compte des rôles en jeu et des événements.
//
// L'état S est entièrement sérialisable (JSON) : les étapes sont des objets
// { t: "type", ...params } interprétés par les gestionnaires de H.
// Un gestionnaire renvoie la description de l'écran à afficher (spec), ou
// null si l'étape ne s'applique pas (elle est alors sautée).

const Engine = (() => {
  let S = null;

  // ---------- Création ----------

  function nouvellePartie(setup) {
    const players = setup.joueurs.map((j, i) => ({
      id: i,
      nom: j.nom,
      role: j.role,
      roleInitial: j.role,
      metier: j.metier || null,
      camp: campDeRole(j.role),
      alive: true,
      mort: null,
    }));
    const presents = new Set(players.map((p) => p.role));
    S = {
      version: 1,
      config: {
        capitaine: !!setup.capitaine,
        loupsEntreDevorer: !!setup.loupsEntreDevorer,
        votesDetailles: !!setup.votesDetailles,
      },
      players,
      horsJeu: setup.horsJeu.slice(),
      nuit: 0,
      jour: 0,
      phase: "debut",
      queue: [],
      current: null,
      pending: [],
      night: {},
      mem: {
        couple: null,
        charmes: [],
        capitaine: null,
        capitaineElu: false,
        potionVie: true,
        potionMort: true,
        salvateurDernier: null,
        renardActif: true,
        infectUtilise: false,
        loupMort: false,
        pouvoirsPerdus: false,
        ancienVies: 2,
        idiotRevele: false,
        jugeUtilise: false,
        pyroUtilise: false,
        modele: null,
        groupeAdverse: null,
        corbeau: null,
        medium: null,
        comedienUtilisees: [],
        comedienPouvoir: null,
        chevalierNuit: null,
        chevalierId: null,
        angeGagne: false,
        premierVoteFait: false,
        tavernierImmun: true,
        rebouteuxUtilise: false,
        confesseurUtilise: false,
        barbierUtilise: false,
        chatelainUtilise: false,
        boucInterdits: null,
        victoireIgnoree: null,
        privesDeVote: [],
      },
      log: [],
      history: [],
      winner: null,
    };
    log("La partie commence avec " + players.length + " joueurs.");
    S.queue = presents.has("ange") ? [{ t: "jour", ange: true }] : [{ t: "nuit" }];
    advance();
    return S;
  }

  function campDeRole(roleId) {
    const r = ROLE_BY_ID[roleId];
    if (!r) return "village";
    if (r.camp === "variable") return "village";
    return r.camp;
  }

  // ---------- Utilitaires ----------

  const P = (id) => S.players.find((p) => p.id === id);
  const vivants = () => S.players.filter((p) => p.alive);
  const nom = (id) => (P(id) ? P(id).nom : "?");
  const roleNom = (roleId) => (ROLE_BY_ID[roleId] ? ROLE_BY_ID[roleId].nom : roleId);
  const metierNom = (id) => (METIER_BY_ID[id] ? METIER_BY_ID[id].nom : id);
  const noms = (ids) => listeFr(ids.map(nom));

  function listeFr(arr) {
    if (arr.length === 0) return "";
    if (arr.length === 1) return arr[0];
    return arr.slice(0, -1).join(", ") + " et " + arr[arr.length - 1];
  }

  function estLoup(p) {
    return p.camp === "loups" || p.role === "loup-blanc";
  }

  // Les villageois perdent leurs pouvoirs si l'Ancien est tué par le village.
  function pouvoirOK(p) {
    if (!S.mem.pouvoirsPerdus) return true;
    return ROLE_BY_ID[p.role] ? ROLE_BY_ID[p.role].camp !== "village" : true;
  }

  // Joueurs vivants pouvant utiliser le pouvoir du rôle (y compris le Comédien
  // qui l'a emprunté pour la nuit).
  function acteurs(roleId) {
    const res = vivants().filter((p) => p.role === roleId && pouvoirOK(p));
    if (S.mem.comedienPouvoir === roleId) {
      vivants()
        .filter((p) => p.role === "comedien" && pouvoirOK(p))
        .forEach((p) => res.push(p));
    }
    return res;
  }
  const acteur = (roleId) => acteurs(roleId)[0] || null;
  const avecRole = (roleId) => vivants().filter((p) => p.role === roleId);
  const avecMetier = (m) => vivants().filter((p) => p.metier === m);
  const enJeu = (roleId) => S.players.some((p) => p.role === roleId);
  const metierEnJeu = () => S.players.some((p) => p.metier);

  // Voisins vivants (ordre de la table) : gauche = précédent, droite = suivant.
  function voisins(id) {
    const n = S.players.length;
    const idx = S.players.findIndex((p) => p.id === id);
    let g = null, d = null;
    for (let k = 1; k < n; k++) {
      const p = S.players[(idx - k + n) % n];
      if (p.alive && p.id !== id) { g = p; break; }
    }
    for (let k = 1; k < n; k++) {
      const p = S.players[(idx + k) % n];
      if (p.alive && p.id !== id) { d = p; break; }
    }
    return { gauche: g, droite: d };
  }

  function phaseLabel() {
    if (S.phase === "nuit") return "Nuit " + S.nuit;
    if (S.phase === "jour") return S.jour === 0 ? "Premier débat" : "Jour " + S.jour;
    if (S.phase === "fin") return "Fin";
    return "Début";
  }

  function log(txt, secret) {
    S.log.push({ p: phaseLabel(), txt, secret: !!secret });
  }

  function info(titre, texte, opts = {}) {
    return { t: "info", titre, texte, ...opts };
  }

  // ---------- Mort et conséquences ----------

  const CAUSES = {
    loups: "dévoré par les loups",
    sorciere: "empoisonné par la Sorcière",
    vote: "éliminé par le vote du village",
    chasseur: "abattu par le Chasseur",
    chagrin: "mort de chagrin",
    tetanos: "mort du tétanos (Chevalier)",
    "loup-blanc": "tué par le Loup-Garou Blanc",
    barbier: "rasé de près par le Barbier",
    vengeance: "éliminé par vengeance",
    incendie: "mort dans l'incendie",
    meneur: "éliminé par le meneur",
    bouc: "éliminé (égalité au vote)",
  };

  function mourir(id, cause) {
    const p = P(id);
    if (!p || !p.alive) return;
    p.alive = false;
    p.mort = { cause, quand: phaseLabel() };
    if (S.mortsGroupes) S.mortsGroupes.push({ id, cause, amoureuxDe: cause === "chagrin" ? S.amoureuxDe : null });
    log(p.nom + " (" + roleNom(p.role) + ") : " + (CAUSES[cause] || cause) + ".");

    if (estLoup(p)) S.mem.loupMort = true;

    // Ange : gagne s'il meurt au premier vote ou la première nuit.
    if (p.role === "ange" && ((S.jour === 0 && S.phase === "jour") || (S.nuit === 1 && S.phase === "nuit"))) {
      S.mem.angeGagne = true;
    }

    // Ancien tué par le village : les villageois perdent leurs pouvoirs.
    if (p.role === "ancien" && ["vote", "sorciere", "chasseur", "bouc", "barbier"].includes(cause) && !S.mem.pouvoirsPerdus) {
      S.mem.pouvoirsPerdus = true;
      S.pending.push(info("L'Ancien est mort", "L'Ancien a été tué par le village : tous les villageois perdent leurs pouvoirs spéciaux jusqu'à la fin de la partie."));
      log("Les villageois perdent leurs pouvoirs (mort de l'Ancien).");
    }

    // Chevalier dévoré : le premier loup à sa gauche mourra la nuit suivante.
    if (p.role === "chevalier" && cause === "loups" && pouvoirOK(p)) {
      S.mem.chevalierNuit = S.nuit + 1;
      S.mem.chevalierId = p.id;
      log("Le Chevalier a contaminé un loup : il mourra la nuit prochaine.", true);
    }

    // Chasseur : tire immédiatement.
    if (p.role === "chasseur" && pouvoirOK(p)) {
      S.pending.push({ t: "chasseur", id: p.id });
    }

    // Capitaine : désigne un successeur.
    if (S.mem.capitaine === p.id) {
      S.pending.push({ t: "successeur", from: p.id });
    }

    // Bâtiment libéré : le Bailli peut l'attribuer à un Vagabond.
    if (p.metier && !["vagabond", "fermier"].includes(p.metier)) {
      S.pending.push({ t: "bailli", metier: p.metier });
    }

    // Enfant Sauvage : devient loup si son modèle meurt.
    if (S.mem.modele === p.id) {
      avecRole("enfant-sauvage").forEach((e) => {
        if (e.camp !== "loups") {
          e.camp = "loups";
          S.pending.push(info("Enfant Sauvage", "Le modèle de l'Enfant Sauvage (" + e.nom + ") est mort : l'Enfant Sauvage devient Loup-Garou. Ne l'annoncez pas ! Il se réveillera avec les loups à partir de la prochaine nuit.", { secret: true }));
          log(e.nom + " (Enfant Sauvage) devient Loup-Garou.", true);
        }
      });
    }

    // Amoureux : l'autre meurt de chagrin.
    if (S.mem.couple && S.mem.couple.includes(p.id)) {
      const autre = S.mem.couple.find((x) => x !== p.id);
      if (P(autre) && P(autre).alive) {
        if (!S.mortsGroupes) S.pending.push(info("Mort de chagrin", nom(autre) + " était amoureux de " + p.nom + " et meurt de chagrin. C'était : " + roleNom(P(autre).role) + "."));
        S.amoureuxDe = p.id;
        mourir(autre, "chagrin");
      }
    }
  }

  // ---------- Victoire ----------

  function victoire() {
    const v = vivants();
    if (S.mem.angeGagne) return { camp: "ange", texte: "L'Ange a été éliminé dès le début : il gagne seul !" };
    if (v.length === 0) return { camp: "personne", texte: "Tout le monde est mort : personne ne gagne." };
    const couple = S.mem.couple;
    if (couple && v.length === 2 && couple.every((id) => P(id).alive)) {
      const camps = couple.map((id) => (estLoup(P(id)) ? "loups" : "village"));
      if (camps[0] !== camps[1] || P(couple[0]).role === "loup-blanc" || P(couple[1]).role === "loup-blanc") {
        return { camp: "amoureux", texte: "Les Amoureux " + noms(couple) + " sont les derniers survivants : ils gagnent ensemble !" };
      }
    }
    const flute = v.find((p) => p.role === "joueur-de-flute");
    if (flute && v.filter((p) => p.id !== flute.id).every((p) => S.mem.charmes.includes(p.id))) {
      return { camp: "flute", texte: "Tous les survivants sont charmés : le Joueur de Flûte (" + flute.nom + ") gagne seul !" };
    }
    const sectaire = v.find((p) => p.role === "abominable-sectaire");
    if (sectaire && S.mem.groupeAdverse && S.mem.groupeAdverse.length && S.mem.groupeAdverse.every((id) => !P(id).alive)) {
      return { camp: "sectaire", texte: "Tous les joueurs de l'autre groupe sont éliminés : l'Abominable Sectaire (" + sectaire.nom + ") gagne seul !" };
    }
    const blanc = v.find((p) => p.role === "loup-blanc");
    if (blanc && v.length === 1) return { camp: "loup-blanc", texte: "Le Loup-Garou Blanc (" + blanc.nom + ") est le dernier survivant : il gagne seul !" };
    const loups = v.filter(estLoup);
    if (loups.length === 0) return { camp: "village", texte: "Il n'y a plus aucun Loup-Garou : le village gagne !" };
    const nonLoups = v.filter((p) => !estLoup(p));
    if (nonLoups.length === 0 && !blanc) return { camp: "loups", texte: "Il ne reste que des Loups-Garous : les loups gagnent !" };
    // Autant de loups que de villageois : les loups gagnent, sauf si un
    // villageois a encore un pouvoir capable de renverser la partie.
    const coupleMixte = couple && couple.every((id) => P(id).alive) && estLoup(P(couple[0])) !== estLoup(P(couple[1]));
    if (!blanc && !coupleMixte && loups.length >= nonLoups.length) {
      const speciaux = nonLoups.filter(roleActif);
      if (speciaux.length === 0) return { camp: "loups", texte: "Il y a autant de Loups-Garous que de villageois et aucun rôle spécial ne peut plus les arrêter : les loups gagnent !" };
    }
    return null;
  }

  // Un villageois dont le rôle peut encore changer l'issue de la partie.
  function roleActif(p) {
    if (!pouvoirOK(p)) return false;
    if (["villageois", "villageois-villageois", "cupidon", "voleur", "petite-fille", "servante"].includes(p.role)) return false;
    if (p.role === "sorciere" && !S.mem.potionVie && !S.mem.potionMort) return false;
    if (p.role === "idiot" && S.mem.idiotRevele) return false;
    if (p.role === "renard" && !S.mem.renardActif) return false;
    return true;
  }

  const cleVictoire = (v) => v.camp + ":" + vivants().map((p) => p.id).join(",");
  // Vrai si une victoire est atteinte et que le meneur ne l'a pas écartée.
  const partieGagnee = () => {
    const v = victoire();
    return !!v && S.mem.victoireIgnoree !== cleVictoire(v);
  };

  // ---------- Construction des phases ----------

  function etapesNuit() {
    const n1 = S.nuit === 1;
    const e = [{ t: "dormir" }];
    if (n1) {
      e.push({ t: "voleur" }, { t: "cupidon" }, { t: "amoureux" }, { t: "enfant" }, { t: "chienloup" },
        { t: "sectaire" }, { t: "juge-signe" });
    }
    e.push({ t: "fratrie", role: "deux-soeurs" }, { t: "fratrie", role: "trois-freres" });
    e.push({ t: "comedien" }, { t: "salvateur" }, { t: "voyante" }, { t: "renard" }, { t: "gitane" });
    e.push({ t: "loups" }, { t: "infect" }, { t: "gml" }, { t: "loup-blanc" }, { t: "boulanger" });
    e.push({ t: "sorciere-vie" }, { t: "sorciere-mort" });
    e.push({ t: "flute" }, { t: "charmes" }, { t: "pyromane" }, { t: "corbeau" });
    e.push({ t: "aube" });
    return e;
  }

  function etapesJour(ange) {
    const e = [];
    if (ange) e.push(info("Premier débat", "L'Ange est en jeu : la partie commence par un débat et un vote, avant la première nuit. Si l'Ange est éliminé maintenant, il gagne."));
    if (S.config.capitaine && !S.mem.capitaineElu) e.push({ t: "election" });
    e.push({ t: "ours" }, { t: "gitane-matin" }, { t: "actions-jour" }, { t: "vote", n: 1 });
    e.push({ t: "nuit" });
    return e;
  }

  // ---------- Gestionnaires d'étapes ----------

  const choixJoueurs = (ids, min = 1, max = 1) => ({ kind: "players", candidats: ids, min, max });
  const ids = (arr) => arr.map((p) => p.id);
  const reveil = (roleNomTxt) => roleNomTxt + ", réveille-toi.";

  const H = {
    info: (s) => ({
      titre: s.titre,
      texte: s.texte,
      secret: s.secret,
      apply() {},
    }),

    nuit: () => ({
      auto: true,
      apply() {
        S.nuit += 1;
        S.phase = "nuit";
        S.night = { victimeLoups: null, victimeGml: null, victimeBlanc: null, protege: null, sauve: null, poison: null, infecte: null, chefMeute: null };
        S.mem.comedienPouvoir = null;
        log("La nuit tombe.");
        S.queue.unshift(...etapesNuit());
      },
    }),

    jour: (s) => ({
      auto: true,
      apply() {
        S.phase = "jour";
        if (!s.ange) S.jour += 1;
        S.queue.unshift(...etapesJour(s.ange));
      },
    }),

    dormir: () => ({
      titre: "La nuit tombe",
      dire: "C'est la nuit, tout le village s'endort. Fermez les yeux.",
      texte: S.nuit === 1 ? "Première nuit : les personnages qui n'agissent qu'au début de la partie vont être appelés." : "",
      apply() {},
    }),

    voleur: () => {
      const p = acteur("voleur");
      if (!p || S.horsJeu.length === 0) return null;
      const cartes = S.horsJeu.map((r, i) => ({ v: i, label: "Prendre : " + roleNom(r) }));
      const deuxLoups = S.horsJeu.length >= 2 && S.horsJeu.every((r) => campDeRole(r) === "loups");
      return {
        titre: "Le Voleur",
        dire: reveil("Voleur") + " Tu peux échanger ta carte avec l'une de ces cartes.",
        texte: "Voleur : " + p.nom + ". Montrez-lui les cartes non distribuées." + (deuxLoups ? " Les deux cartes sont des Loups-Garous : il est obligé d'en prendre une." : ""),
        input: { kind: "choice", options: (deuxLoups ? [] : [{ v: "garder", label: "Garder sa carte de Voleur" }]).concat(cartes) },
        apply(a) {
          if (a === "garder" || a === null) { log(p.nom + " (Voleur) garde sa carte.", true); return; }
          const nouveau = S.horsJeu[a];
          S.horsJeu[a] = "voleur";
          p.role = nouveau;
          p.camp = campDeRole(nouveau);
          log(p.nom + " (Voleur) devient " + roleNom(nouveau) + ".", true);
        },
        dodo: "Voleur, rendors-toi.",
      };
    },

    cupidon: () => {
      const p = acteur("cupidon");
      if (!p) return null;
      return {
        titre: "Cupidon",
        dire: reveil("Cupidon") + " Désigne deux joueurs qui seront amoureux.",
        texte: "Cupidon : " + p.nom + ". Il peut se choisir lui-même.",
        input: choixJoueurs(ids(vivants()), 2, 2),
        apply(a) {
          S.mem.couple = a;
          log(noms(a) + " sont amoureux.", true);
        },
        dodo: "Cupidon, rendors-toi.",
      };
    },

    amoureux: () => {
      if (!S.mem.couple) return null;
      return {
        titre: "Les Amoureux",
        dire: "Je vais toucher les deux amoureux. Amoureux, réveillez-vous et reconnaissez-vous.",
        texte: "Touchez " + noms(S.mem.couple) + " sur l'épaule. Rappel : si l'un meurt, l'autre meurt de chagrin.",
        apply() {},
        dodo: "Amoureux, rendormez-vous.",
      };
    },

    enfant: () => {
      const p = acteur("enfant-sauvage");
      if (!p) return null;
      return {
        titre: "L'Enfant Sauvage",
        dire: reveil("Enfant Sauvage") + " Désigne ton modèle.",
        texte: "Enfant Sauvage : " + p.nom + ". Si le modèle meurt, il deviendra Loup-Garou.",
        input: choixJoueurs(ids(vivants().filter((x) => x.id !== p.id))),
        apply(a) {
          S.mem.modele = a[0];
          log(p.nom + " (Enfant Sauvage) choisit " + nom(a[0]) + " comme modèle.", true);
        },
        dodo: "Enfant Sauvage, rendors-toi.",
      };
    },

    chienloup: () => {
      const p = acteur("chien-loup");
      if (!p) return null;
      return {
        titre: "Le Chien-Loup",
        dire: reveil("Chien-Loup") + " Veux-tu être un simple Villageois ou un Loup-Garou ?",
        texte: "Chien-Loup : " + p.nom + ".",
        input: { kind: "choice", options: [{ v: "village", label: "🧑‍🌾 Villageois" }, { v: "loups", label: "🐺 Loup-Garou" }] },
        apply(a) {
          p.camp = a === "loups" ? "loups" : "village";
          log(p.nom + " (Chien-Loup) choisit le camp " + CAMPS[p.camp].nom + ".", true);
        },
        dodo: "Chien-Loup, rendors-toi.",
      };
    },

    sectaire: () => {
      const p = avecRole("abominable-sectaire")[0];
      if (!p) return null;
      return {
        titre: "L'Abominable Sectaire",
        texte: "Annoncez (ou avez annoncé) au village la séparation en deux groupes selon un critère visible. Le Sectaire (" + p.nom + ") ne se réveille pas. Sélectionnez les joueurs du groupe ADVERSE (celui qui n'est pas celui du Sectaire).",
        input: choixJoueurs(ids(vivants().filter((x) => x.id !== p.id)), 1, S.players.length),
        apply(a) {
          S.mem.groupeAdverse = a;
          log("Groupe adverse du Sectaire : " + noms(a) + ".", true);
        },
      };
    },

    "juge-signe": () => {
      const p = acteur("juge-begue");
      if (!p) return null;
      return {
        titre: "Le Juge Bègue",
        dire: reveil("Juge Bègue") + " Montre-moi le signe que tu feras pour demander un second vote.",
        texte: "Juge Bègue : " + p.nom + ". Retenez son signe : il ne pourra l'utiliser qu'une fois.",
        apply() {},
        dodo: "Juge Bègue, rendors-toi.",
      };
    },

    fratrie: (s) => {
      const membres = avecRole(s.role).filter(pouvoirOK);
      if (membres.length < 2) return null;
      const r = ROLE_BY_ID[s.role];
      const n1 = S.nuit === 1;
      return {
        titre: r.nom,
        dire: (s.role === "deux-soeurs" ? "Les Sœurs, réveillez-vous" : "Les Frères, réveillez-vous") + (n1 ? " et reconnaissez-vous." : " et concertez-vous en silence."),
        texte: noms(ids(membres)) + "." + (n1 ? "" : " Facultatif : passez si vous ne voulez pas les réveiller cette nuit."),
        skip: !n1,
        apply() {},
        dodo: s.role === "deux-soeurs" ? "Les Sœurs, rendormez-vous." : "Les Frères, rendormez-vous.",
      };
    },

    comedien: () => {
      const p = avecRole("comedien").find(pouvoirOK);
      if (!p) return null;
      const dispo = [...new Set(S.horsJeu)].filter((r) => !S.mem.comedienUtilisees.includes(r) && ROLE_BY_ID[r] && ROLE_BY_ID[r].camp === "village" && r !== "villageois");
      if (dispo.length === 0) return null;
      return {
        titre: "Le Comédien",
        dire: reveil("Comédien") + " Choisis le personnage dont tu veux utiliser le pouvoir.",
        texte: "Comédien : " + p.nom + ". Le pouvoir choisi sera appelé à son tour cette nuit, comme si le Comédien avait ce rôle. La carte est ensuite retirée.",
        input: { kind: "choice", options: dispo.map((r) => ({ v: r, label: ROLE_BY_ID[r].icone + " " + roleNom(r) })) },
        skip: true,
        apply(a) {
          if (!a) return;
          S.mem.comedienPouvoir = a;
          S.mem.comedienUtilisees.push(a);
          log(p.nom + " (Comédien) emprunte le pouvoir : " + roleNom(a) + ".", true);
        },
        dodo: "Comédien, rendors-toi.",
      };
    },

    salvateur: () => {
      const p = acteur("salvateur");
      if (!p) return null;
      const dernier = S.mem.salvateurDernier;
      return {
        titre: "Le Salvateur",
        dire: reveil("Salvateur") + " Qui veux-tu protéger cette nuit ?",
        texte: "Salvateur : " + p.nom + ". Il peut se protéger lui-même." + (dernier !== null && P(dernier) ? " Il ne peut pas protéger " + nom(dernier) + " (protégé la nuit dernière)." : ""),
        input: choixJoueurs(ids(vivants().filter((x) => x.id !== dernier))),
        skip: true,
        apply(a) {
          S.night.protege = a ? a[0] : null;
          S.mem.salvateurDernier = a ? a[0] : null;
          if (a) log(p.nom + " (Salvateur) protège " + nom(a[0]) + ".", true);
        },
        dodo: "Salvateur, rendors-toi.",
      };
    },

    voyante: () => {
      const p = acteur("voyante");
      if (!p) return null;
      return {
        titre: "La Voyante",
        dire: reveil("Voyante") + " Désigne le joueur dont tu veux connaître la carte.",
        texte: "Voyante : " + p.nom + ".",
        input: choixJoueurs(ids(vivants().filter((x) => x.id !== p.id))),
        skip: true,
        apply(a) {
          if (!a) return;
          const c = P(a[0]);
          let t = c.nom + " est : " + ROLE_BY_ID[c.role].icone + " " + roleNom(c.role) + ".";
          if (c.camp === "loups" && campDeRole(c.role) !== "loups") t += " (Attention : ce joueur est désormais dans le camp des loups, mais sa carte reste " + roleNom(c.role) + ".)";
          log(p.nom + " (Voyante) sonde " + c.nom + " : " + roleNom(c.role) + ".", true);
          S.queue.unshift(info("Montrez la carte à la Voyante", t, { dodo: "Voyante, rendors-toi." }));
        },
      };
    },

    renard: () => {
      const p = acteur("renard");
      if (!p || !S.mem.renardActif) return null;
      return {
        titre: "Le Renard",
        dire: reveil("Renard") + " Veux-tu flairer un groupe de trois joueurs ? Désigne celui du milieu.",
        texte: "Renard : " + p.nom + ". L'appli calcule le groupe (le joueur désigné et ses deux voisins vivants).",
        input: choixJoueurs(ids(vivants())),
        skip: true,
        apply(a) {
          if (!a) return;
          const v = voisins(a[0]);
          const groupe = [v.gauche, P(a[0]), v.droite].filter(Boolean).filter((x, i, arr) => arr.findIndex((y) => y.id === x.id) === i);
          const loup = groupe.some(estLoup);
          if (!loup) S.mem.renardActif = false;
          log(p.nom + " (Renard) flaire " + listeFr(groupe.map((g) => g.nom)) + " : " + (loup ? "un loup !" : "aucun loup, il perd son pouvoir."), true);
          S.queue.unshift(info("Résultat du Renard", "Groupe : " + listeFr(groupe.map((g) => g.nom)) + ". " + (loup ? "👍 Faites un signe positif : il y a au moins un Loup-Garou dans ce groupe." : "👎 Signe négatif : aucun Loup-Garou. Le Renard perd son pouvoir."), { dodo: "Renard, rendors-toi." }));
        },
      };
    },

    gitane: () => {
      const p = acteur("gitane");
      if (!p) return null;
      return {
        titre: "La Gitane",
        dire: reveil("Gitane") + " Veux-tu utiliser une carte Spiritisme ? Si oui, désigne le Médium.",
        texte: "Gitane : " + p.nom + ". Au matin, le Médium posera la question aux morts.",
        input: choixJoueurs(ids(vivants())),
        skip: true,
        apply(a) {
          S.mem.medium = a ? a[0] : null;
          if (a) log(p.nom + " (Gitane) désigne " + nom(a[0]) + " comme Médium.", true);
        },
        dodo: "Gitane, rendors-toi.",
      };
    },

    loups: () => {
      const loups = vivants().filter(estLoup);
      const cibles = S.config.loupsEntreDevorer ? vivants() : vivants().filter((x) => !estLoup(x));
      if (loups.length === 0 || cibles.length === 0) return null;
      const notes = ["Loups : " + listeFr(loups.map((l) => l.nom + (l.role !== "loup-garou" ? " (" + roleNom(l.role) + ")" : "")))];
      const tav = avecMetier("tavernier")[0];
      if (tav && S.mem.tavernierImmun) notes.push("🍺 " + tav.nom + " est le Tavernier : s'il est désigné, il ne mourra pas.");
      if (!S.config.loupsEntreDevorer) notes.push("Les loups ne peuvent pas se dévorer entre eux.");
      if (avecRole("petite-fille").some(pouvoirOK)) notes.push("La Petite Fille (" + avecRole("petite-fille").map((x) => x.nom).join(", ") + ") peut espionner : si les loups la surprennent, elle meurt (utilisez « Mort manuelle » dans le menu).");
      return {
        titre: "Les Loups-Garous",
        dire: "Les Loups-Garous, réveillez-vous, reconnaissez-vous et désignez votre victime.",
        texte: notes.join(" "),
        input: choixJoueurs(ids(cibles)),
        apply(a) {
          S.night.victimeLoups = a && a.length ? a[0] : null;
          if (a) log("Les loups attaquent " + nom(a[0]) + ".", true);
        },
        dodo: "Les Loups-Garous, rendormez-vous.",
      };
    },

    infect: () => {
      const p = acteur("infect");
      const v = S.night.victimeLoups;
      if (!p || S.mem.infectUtilise || v === null || estLoup(P(v))) return null;
      return {
        titre: "L'Infect Père des Loups",
        dire: "Infect Père des Loups, veux-tu infecter la victime ?",
        texte: "Infect : " + p.nom + ". Victime : " + nom(v) + ". Une seule fois par partie : la victime ne meurt pas et devient secrètement Loup-Garou (elle garde son pouvoir).",
        input: { kind: "choice", options: [{ v: "oui", label: "🦠 Infecter " + nom(v) }, { v: "non", label: "Non, elle sera dévorée" }] },
        apply(a) {
          if (a !== "oui") return;
          S.mem.infectUtilise = true;
          S.night.infecte = v;
          P(v).camp = "loups";
          log(nom(v) + " est infecté et devient Loup-Garou.", true);
          S.queue.unshift(info("Prévenir l'infecté", "Touchez " + nom(v) + " : il est désormais Loup-Garou et se réveillera avec les loups dès la prochaine nuit. Il garde son pouvoir de " + roleNom(P(v).role) + "."));
        },
      };
    },

    gml: () => {
      const p = acteur("grand-mechant-loup");
      if (!p || S.mem.loupMort) return null;
      return {
        titre: "Le Grand Méchant Loup",
        dire: "Grand Méchant Loup, réveille-toi et désigne une seconde victime.",
        texte: "Grand Méchant Loup : " + p.nom + ". Aucun loup n'est encore mort, il dévore une seconde victime (pas un loup).",
        input: choixJoueurs(ids(vivants().filter((x) => !estLoup(x) && x.id !== S.night.victimeLoups))),
        skip: true,
        apply(a) {
          S.night.victimeGml = a ? a[0] : null;
          if (a) log("Le Grand Méchant Loup attaque " + nom(a[0]) + ".", true);
        },
        dodo: "Grand Méchant Loup, rendors-toi.",
      };
    },

    "loup-blanc": () => {
      const p = avecRole("loup-blanc")[0];
      if (!p || S.nuit % 2 !== 0) return null;
      const cibles = vivants().filter((x) => estLoup(x) && x.id !== p.id);
      return {
        titre: "Le Loup-Garou Blanc",
        dire: "Loup-Garou Blanc, réveille-toi. Veux-tu éliminer un Loup-Garou ?",
        texte: "Loup Blanc : " + p.nom + " (une nuit sur deux)." + (cibles.length ? "" : " Il n'y a plus d'autre loup."),
        input: cibles.length ? choixJoueurs(ids(cibles)) : null,
        skip: true,
        apply(a) {
          S.night.victimeBlanc = a ? a[0] : null;
          if (a) log("Le Loup Blanc attaque " + nom(a[0]) + ".", true);
        },
        dodo: "Loup-Garou Blanc, rendors-toi.",
      };
    },

    boulanger: () => {
      const p = avecMetier("boulanger")[0];
      if (!p) return null;
      return {
        titre: "Le Boulanger",
        dire: "Les Loups-Garous se rendorment… (le Boulanger peut ouvrir les yeux.)",
        texte: "Boulanger : " + p.nom + ". Laissez-lui un instant pour voir les loups regagner leur place.",
        apply() {},
      };
    },

    "sorciere-vie": () => {
      const p = acteur("sorciere");
      if (!p || !S.mem.potionVie) return null;
      const N = S.night;
      const victimes = [N.victimeLoups, N.victimeGml, N.victimeBlanc].filter((v) => v !== null && v !== N.infecte);
      const uniq = [...new Set(victimes)];
      return {
        titre: "La Sorcière — potion de vie",
        dire: reveil("Sorcière") + (uniq.length ? " Voici la victime de cette nuit. Veux-tu utiliser ta potion de guérison ?" : " Personne n'a été attaqué cette nuit."),
        texte: "Sorcière : " + p.nom + ". " + (uniq.length ? "Victime(s) : " + noms(uniq) + "." : "") + (N.protege !== null && uniq.includes(N.protege) ? " (" + nom(N.protege) + " est déjà protégé par le Salvateur.)" : ""),
        input: uniq.length ? { kind: "choice", options: uniq.map((v) => ({ v, label: "🧪 Sauver " + nom(v) })).concat([{ v: "non", label: "Ne pas utiliser" }]) } : null,
        dodo: S.mem.potionMort ? "" : "Sorcière, rendors-toi.",
        apply(a) {
          if (a === null || a === "non" || a === undefined) return;
          S.night.sauve = a;
          S.mem.potionVie = false;
          log(p.nom + " (Sorcière) sauve " + nom(a) + ".", true);
        },
      };
    },

    "sorciere-mort": () => {
      const p = acteur("sorciere");
      if (!p || !S.mem.potionMort) return null;
      return {
        titre: "La Sorcière — potion de mort",
        dire: (S.mem.potionVie || S.night.sauve !== null ? "" : reveil("Sorcière") + " ") + "Veux-tu utiliser ta potion d'empoisonnement ?",
        texte: "Sorcière : " + p.nom + ". Sélectionnez la cible ou passez.",
        input: choixJoueurs(ids(vivants())),
        skip: true,
        apply(a) {
          if (!a) return;
          S.night.poison = a[0];
          S.mem.potionMort = false;
          log(p.nom + " (Sorcière) empoisonne " + nom(a[0]) + ".", true);
        },
        dodo: "Sorcière, rendors-toi.",
      };
    },

    flute: () => {
      const p = acteur("joueur-de-flute");
      if (!p) return null;
      const cand = vivants().filter((x) => x.id !== p.id && !S.mem.charmes.includes(x.id));
      if (cand.length === 0) return null;
      return {
        titre: "Le Joueur de Flûte",
        dire: reveil("Joueur de Flûte") + " Désigne deux joueurs à charmer.",
        texte: "Joueur de Flûte : " + p.nom + ". Déjà charmés : " + (S.mem.charmes.filter((id) => P(id).alive).map(nom).join(", ") || "aucun") + ".",
        input: choixJoueurs(ids(cand), Math.min(2, cand.length), Math.min(2, cand.length)),
        apply(a) {
          S.mem.charmes.push(...a);
          S.night.nouveauxCharmes = a;
          log(p.nom + " (Joueur de Flûte) charme " + noms(a) + ".", true);
        },
        dodo: "Joueur de Flûte, rendors-toi.",
      };
    },

    charmes: () => {
      const c = S.mem.charmes.filter((id) => P(id).alive);
      if (!S.night.nouveauxCharmes || c.length === 0) return null;
      return {
        titre: "Les joueurs charmés",
        dire: "Je vais toucher les joueurs nouvellement charmés. Joueurs charmés, réveillez-vous et reconnaissez-vous.",
        texte: "Touchez " + noms(S.night.nouveauxCharmes) + ". Tous les charmés à réveiller : " + noms(c) + ".",
        apply() {},
        dodo: "Joueurs charmés, rendormez-vous.",
      };
    },

    pyromane: () => {
      const p = acteur("pyromane");
      if (!p || S.mem.pyroUtilise) return null;
      const cand = vivants().filter((x) => x.metier && x.metier !== "vagabond");
      return {
        titre: "Le Pyromane",
        dire: reveil("Pyromane") + " Veux-tu mettre le feu à un bâtiment ?",
        texte: "Pyromane : " + p.nom + ". Usage unique. " + (metierEnJeu() ? "Choisissez l'occupant du bâtiment incendié." : "Aucun bâtiment (métier) en jeu : sélectionnez quand même un joueur si vous jouez sans les bâtiments."),
        input: choixJoueurs(ids(cand.length ? cand : vivants())),
        skip: true,
        apply(a) {
          if (!a) return;
          S.mem.pyroUtilise = true;
          const c = P(a[0]);
          const ancien = c.metier;
          if (c.metier) c.metier = "vagabond";
          log(p.nom + " (Pyromane) incendie la maison de " + c.nom + (ancien ? " (" + metierNom(ancien) + ")" : "") + ".");
          if (c.id === S.night.victimeLoups) {
            const loups = vivants().filter(estLoup);
            if (loups.length) S.queue.unshift({ t: "chef-meute" });
          }
        },
        dodo: "Pyromane, rendors-toi.",
      };
    },

    "chef-meute": () => ({
      titre: "Incendie !",
      texte: "La maison incendiée est celle de la victime des loups : le chef de meute qui l'attaquait périt dans l'incendie. Désignez ce loup.",
      input: choixJoueurs(ids(vivants().filter(estLoup))),
      skip: true,
      apply(a) { S.night.chefMeute = a ? a[0] : null; },
    }),

    corbeau: () => {
      const p = acteur("corbeau");
      if (!p) return null;
      return {
        titre: "Le Corbeau",
        dire: reveil("Corbeau") + " Désigne un joueur qui aura deux voix de plus contre lui demain.",
        texte: "Corbeau : " + p.nom + "." + (avecMetier("vagabond").length ? " Il ne peut pas désigner un Vagabond." : ""),
        input: choixJoueurs(ids(vivants().filter((x) => x.metier !== "vagabond"))),
        skip: true,
        apply(a) {
          S.mem.corbeau = a ? a[0] : null;
          if (a) log(p.nom + " (Corbeau) accuse " + nom(a[0]) + ".", true);
        },
        dodo: "Corbeau, rendors-toi.",
      };
    },

    aube: () => ({
      auto: true,
      apply() {
        const N = S.night;
        const morts = [];
        const notes = [];
        const ajouter = (id, cause) => { if (id !== null && !morts.some((m) => m.id === id) && P(id).alive) morts.push({ id, cause }); };
        const attaque = (id, cause) => {
          if (id === null || id === N.infecte) return;
          const p = P(id);
          if (!p.alive) return;
          if (N.protege === id) { notes.push(p.nom + " a été protégé par le Salvateur."); return; }
          if (N.sauve === id) { notes.push(p.nom + " a été sauvé par la Sorcière."); return; }
          if (p.role === "ancien" && pouvoirOK(p) && S.mem.ancienVies > 1 && cause === "loups") {
            S.mem.ancienVies -= 1;
            notes.push("L'Ancien (" + p.nom + ") a résisté à l'attaque des loups (il n'a plus qu'une vie).");
            return;
          }
          if (p.metier === "tavernier" && S.mem.tavernierImmun) { notes.push("Le Tavernier (" + p.nom + ") ne peut pas être dévoré."); return; }
          ajouter(id, cause);
        };
        attaque(N.victimeLoups, "loups");
        attaque(N.victimeGml, "loups");
        attaque(N.victimeBlanc, "loup-blanc");
        if (N.poison !== null) ajouter(N.poison, "sorciere");
        if (N.chefMeute !== null) ajouter(N.chefMeute, "incendie");
        if (S.mem.chevalierNuit === S.nuit) {
          // Premier loup vivant à gauche du Chevalier (ordre de la table).
          const n = S.players.length;
          const idx = S.players.findIndex((p) => p.id === S.mem.chevalierId);
          for (let k = 1; k < n; k++) {
            const p = S.players[(idx - k + n) % n];
            if (p.alive && estLoup(p)) { ajouter(p.id, "tetanos"); break; }
          }
          S.mem.chevalierNuit = null;
        }

        S.queue.unshift({ t: "jour" });
        // Les morts en cascade (amoureux) sont annoncées avec celles de la nuit.
        S.mortsGroupes = [];
        morts.forEach((m) => mourir(m.id, m.cause));
        const tous = S.mortsGroupes;
        S.mortsGroupes = null;
        const texte = tous.length
          ? "Annoncez : " + tous.map((m) => nom(m.id) + " (" + roleNom(P(m.id).role) + ", " + (CAUSES[m.cause] || m.cause) + (m.amoureuxDe !== null ? ", amoureux de " + nom(m.amoureuxDe) : "") + ")").join(" ; ") + "."
          : "Personne n'est mort cette nuit !";
        S.pending.unshift(info("Le village se réveille", texte, { dire: "C'est le matin, le village se réveille… sauf " + (tous.length ? listeFr(tous.map((m) => nom(m.id))) : "personne cette nuit") + ".", notes: notes.length ? "Pour le MJ : " + notes.join(" ") : "" }));
      },
    }),

    election: () => {
      const v = vivants();
      const fermiers = avecMetier("fermier");
      const cand = fermiers.length ? fermiers : v;
      return {
        titre: "Élection du Capitaine",
        dire: "Le village doit élire son Capitaine. Qui se présente ?",
        texte: "Le vote du Capitaine compte double et il tranche les égalités." + (fermiers.length ? " Le Village : seuls les Fermiers peuvent être candidats et voter." : ""),
        input: choixJoueurs(ids(cand)),
        skip: true,
        apply(a) {
          if (!a) return;
          S.mem.capitaine = a[0];
          S.mem.capitaineElu = true;
          log(nom(a[0]) + " est élu Capitaine.");
        },
      };
    },

    successeur: (s) => {
      if (partieGagnee()) return null;
      const fermiers = avecMetier("fermier");
      const cand = fermiers.length ? fermiers : vivants();
      if (cand.length === 0) return null;
      return {
        titre: "Succession du Capitaine",
        dire: nom(s.from) + ", tu étais Capitaine : désigne ton successeur.",
        texte: fermiers.length ? "Le successeur doit être un Fermier." : "",
        input: choixJoueurs(ids(cand)),
        skip: true,
        apply(a) {
          S.mem.capitaine = a ? a[0] : null;
          if (a) log(nom(a[0]) + " devient Capitaine.");
        },
      };
    },

    chasseur: (s) => {
      const cand = vivants();
      if (cand.length === 0) return null;
      return {
        titre: "Le Chasseur tire !",
        dire: nom(s.id) + ", tu étais Chasseur : désigne le joueur que tu emportes avec toi.",
        input: choixJoueurs(ids(cand)),
        skip: true,
        apply(a) {
          if (!a) return;
          const c = P(a[0]);
          S.pending.push(info("Tir du Chasseur", c.nom + " est abattu. C'était : " + roleNom(c.role) + "."));
          mourir(a[0], "chasseur");
        },
      };
    },

    bailli: (s) => {
      if (partieGagnee()) return null;
      const b = avecMetier("bailli")[0];
      const vag = avecMetier("vagabond");
      if (!b || vag.length === 0) return null;
      return {
        titre: "Le Bailli",
        dire: "Le bâtiment du " + metierNom(s.metier) + " est libre. Bailli, à quel Vagabond l'attribues-tu ?",
        texte: "Bailli : " + b.nom + ".",
        input: choixJoueurs(ids(vag)),
        skip: true,
        apply(a) {
          if (!a) return;
          P(a[0]).metier = s.metier;
          log(nom(a[0]) + " devient " + metierNom(s.metier) + ".");
        },
      };
    },

    ours: () => {
      const p = acteur("montreur-ours");
      if (!p) return null;
      const v = voisins(p.id);
      const grogne = [v.gauche, v.droite].some((x) => x && estLoup(x));
      return {
        titre: "Le Montreur d'Ours",
        dire: grogne ? "🐻 GRRRR ! L'ours du Montreur grogne !" : "L'ours du Montreur reste silencieux.",
        texte: "Montreur : " + p.nom + ". Voisins vivants : " + [v.gauche, v.droite].filter(Boolean).map((x) => x.nom).join(" et ") + ".",
        apply() {},
      };
    },

    "gitane-matin": () => {
      if (S.mem.medium === null) return null;
      const m = S.mem.medium;
      if (!P(m).alive) return null;
      const premierMort = S.players.filter((p) => !p.alive)[0];
      return {
        titre: "Question aux esprits",
        dire: nom(m) + ", tu es le Médium : lis à voix haute la question de la carte Spiritisme.",
        texte: premierMort ? "Le premier joueur éliminé (" + premierMort.nom + ") répond par oui ou non." : "Aucun mort pour répondre : la question reste sans réponse.",
        apply() { S.mem.medium = null; },
      };
    },

    "actions-jour": () => {
      const opts = [];
      const ok = (m) => avecMetier(m).length > 0;
      if (ok("barbier") && !S.mem.barbierUtilise) opts.push({ v: "barbier", label: "💈 Le Barbier rase quelqu'un" });
      if (ok("confesseur") && !S.mem.confesseurUtilise) opts.push({ v: "confesseur", label: "⛪ Le Confesseur confesse quelqu'un" });
      if (ok("rebouteux") && !S.mem.rebouteuxUtilise) opts.push({ v: "rebouteux", label: "🦴 Le Rebouteux rend un pouvoir" });
      if (opts.length === 0) return null;
      opts.push({ v: "vote", label: "➡️ Passer au vote", primary: true });
      return {
        titre: "Pouvoirs du jour (Le Village)",
        texte: "Un métier veut-il agir avant le vote ?",
        input: { kind: "choice", options: opts },
        apply(a) {
          if (!a || a === "vote") return;
          S.queue.unshift({ t: a }, { t: "actions-jour" });
        },
      };
    },

    barbier: () => {
      const b = avecMetier("barbier")[0];
      if (!b) return null;
      return {
        titre: "Le Barbier",
        texte: "Barbier : " + b.nom + ". Qui rase-t-il ? (pas un Vagabond). S'il tue un villageois, il meurt aussi.",
        input: choixJoueurs(ids(vivants().filter((x) => x.id !== b.id && x.metier !== "vagabond"))),
        skip: true,
        apply(a) {
          if (!a) return;
          S.mem.barbierUtilise = true;
          const c = P(a[0]);
          const loup = estLoup(c);
          S.pending.push(info("Le Barbier", c.nom + " est éliminé (" + roleNom(c.role) + "). " + (loup ? "C'était un loup : le Barbier est félicité !" : "C'était un villageois : le Barbier est éliminé à son tour.")));
          mourir(c.id, "barbier");
          if (!loup) mourir(b.id, "vengeance");
        },
      };
    },

    confesseur: () => {
      const c = avecMetier("confesseur")[0];
      if (!c) return null;
      return {
        titre: "Le Confesseur",
        texte: "Confesseur : " + c.nom + ". Qui entend-il en confession ?",
        input: choixJoueurs(ids(vivants().filter((x) => x.id !== c.id))),
        skip: true,
        apply(a) {
          if (!a) return;
          S.mem.confesseurUtilise = true;
          const t = P(a[0]);
          log(c.nom + " (Confesseur) découvre que " + t.nom + " est " + roleNom(t.role) + ".", true);
          S.queue.unshift(info("Confession", "Montrez discrètement au Confesseur : " + t.nom + " est " + roleNom(t.role) + (estLoup(t) ? " (camp des loups)" : "") + ".", { secret: true }));
        },
      };
    },

    rebouteux: () => {
      const r = avecMetier("rebouteux")[0];
      if (!r) return null;
      return {
        titre: "Le Rebouteux",
        texte: "Rebouteux : " + r.nom + ". À qui rend-il son pouvoir à usage unique ? (potions de la Sorcière, Infect, Renard, Pyromane, Juge Bègue, Barbier, Confesseur, Châtelain…)",
        input: choixJoueurs(ids(vivants().filter((x) => x.id !== r.id))),
        skip: true,
        apply(a) {
          if (!a) return;
          S.mem.rebouteuxUtilise = true;
          const t = P(a[0]);
          const rendus = [];
          const M = S.mem;
          if (t.role === "sorciere") { if (!M.potionVie) rendus.push("potion de vie"); if (!M.potionMort) rendus.push("potion de mort"); M.potionVie = M.potionMort = true; }
          if (t.role === "infect" && M.infectUtilise) { M.infectUtilise = false; rendus.push("infection"); }
          if (t.role === "renard" && !M.renardActif) { M.renardActif = true; rendus.push("flair"); }
          if (t.role === "pyromane" && M.pyroUtilise) { M.pyroUtilise = false; rendus.push("incendie"); }
          if (t.role === "juge-begue" && M.jugeUtilise) { M.jugeUtilise = false; rendus.push("second vote"); }
          if (t.metier === "barbier" && M.barbierUtilise) { M.barbierUtilise = false; rendus.push("rasage"); }
          if (t.metier === "confesseur" && M.confesseurUtilise) { M.confesseurUtilise = false; rendus.push("confession"); }
          if (t.metier === "chatelain" && M.chatelainUtilise) { M.chatelainUtilise = false; rendus.push("grâce"); }
          log(r.nom + " (Rebouteux) soigne " + t.nom + (rendus.length ? " : " + rendus.join(", ") + " rendu(s)." : " (aucun pouvoir à rendre)."));
          S.queue.unshift(info("Le Rebouteux", rendus.length ? t.nom + " récupère : " + rendus.join(", ") + "." : t.nom + " n'avait aucun pouvoir à usage unique déjà utilisé : le Rebouteux a perdu le sien pour rien."));
        },
      };
    },

    vote: (s) => {
      const v = vivants();
      if (v.length < 2) return null;
      const notes = [];
      if (S.mem.capitaine !== null && P(S.mem.capitaine) && P(S.mem.capitaine).alive) notes.push("👑 Capitaine : " + nom(S.mem.capitaine) + " (vote double, tranche les égalités).");
      if (S.mem.corbeau !== null && P(S.mem.corbeau).alive) notes.push("🐦‍⬛ Corbeau : " + nom(S.mem.corbeau) + " a déjà 2 voix contre lui.");
      const idiot = avecRole("idiot")[0];
      if (idiot && S.mem.idiotRevele) notes.push("🤪 " + idiot.nom + " (Idiot révélé) ne vote plus.");
      if (avecMetier("institutrice").length) notes.push("📚 L'Institutrice (" + avecMetier("institutrice")[0].nom + ") peut interdire de vote jusqu'à 2 joueurs ayant un métier ; elle ne vote pas.");
      if (S.mem.boucInterdits) notes.push("🐐 Décision du Bouc Émissaire : " + S.mem.boucInterdits);
      const tav = avecMetier("tavernier")[0];
      if (tav && S.mem.tavernierImmun) notes.push("🍺 " + tav.nom + " (Tavernier) ne peut pas être envoyé au bûcher, tant qu'il n'a jamais voté contre un condamné.");
      const bouc = acteur("bouc-emissaire");
      const instit = avecMetier("institutrice")[0];
      const prives = S.mem.privesDeVote || [];
      if (prives.some((id) => P(id) && P(id).alive)) notes.push("🚫 Ne votent pas : " + prives.filter((id) => P(id) && P(id).alive).map(nom).join(", ") + ".");
      const votants = v.filter((x) => !(x.role === "idiot" && S.mem.idiotRevele) && x !== instit && !prives.includes(x.id));

      const resoudre = (a, tavernierAVote) => {
        S.mem.corbeau = null;
        if (s.n === 1) S.mem.boucInterdits = null;
        let c = null;
        const suite = [];
        if (a === "egalite") {
          if (bouc) {
            c = bouc.id;
            suite.push({ t: "bouc", id: bouc.id });
          } else log("Égalité au vote : personne n'est éliminé.");
        } else if (a === "personne" || a === null) {
          log("Le village n'élimine personne.");
        } else c = a[0];
        if (c !== null && a !== "egalite") {
          if (avecMetier("chatelain").length && !S.mem.chatelainUtilise) suite.push({ t: "chatelain", id: c });
          suite.push({ t: "execution", id: c });
        }
        if (c !== null && a !== "egalite" && tav && S.mem.tavernierImmun && tav.id !== c) {
          if (tavernierAVote === undefined) suite.push({ t: "tavernier", id: c });
          else if (tavernierAVote === c) {
            S.mem.tavernierImmun = false;
            log(tav.nom + " (Tavernier) a voté contre le condamné : il perd son immunité.");
            suite.push(info("Le Tavernier perd son immunité", tav.nom + " a voté contre " + nom(c) + " : il pourra désormais être dévoré ou envoyé au bûcher.", { secret: true }));
          }
        }
        const juge = acteur("juge-begue");
        if (s.n === 1 && juge && !S.mem.jugeUtilise) suite.push({ t: "juge" });
        S.queue.unshift(...suite);
        S.mem.premierVoteFait = true;
      };

      if (S.config.votesDetailles) {
        return {
          titre: s.n === 2 ? "Second vote (Juge Bègue)" : "Vote du village",
          dire: s.n === 2 ? "Le Juge a demandé un second vote : votez immédiatement, sans débat !" : "Le village débat puis vote. Qui sera envoyé au bûcher ?",
          texte: notes.join(" "),
          input: { kind: "votes", votants: ids(votants), candidats: ids(v) },
          apply(votes) {
            votes = votes || {};
            const total = {};
            const detail = [];
            Object.entries(votes).forEach(([qui, cible]) => {
              if (cible === null || cible === undefined || cible === "") return;
              const poids = +qui === S.mem.capitaine ? 2 : 1;
              total[cible] = (total[cible] || 0) + poids;
              detail.push(nom(+qui) + " → " + nom(+cible) + (poids === 2 ? " (×2)" : ""));
            });
            if (S.mem.corbeau !== null && P(S.mem.corbeau).alive) total[S.mem.corbeau] = (total[S.mem.corbeau] || 0) + 2;
            const classement = Object.entries(total).map(([id, n]) => [+id, n]).sort((x, y) => y[1] - x[1]);
            let decision = "personne";
            if (classement.length) {
              const max = classement[0][1];
              const premiers = classement.filter(([, n]) => n === max);
              decision = premiers.length > 1 ? "egalite" : [premiers[0][0]];
            }
            log("Votes : " + (detail.join(", ") || "aucun") + ".");
            const resultat = classement.map(([id, n]) => nom(id) + " : " + n + " voix").join(" ; ") || "aucune voix";
            const conclusion = decision === "personne" ? "Personne n'est éliminé."
              : decision === "egalite" ? "Égalité" + (bouc ? " : le Bouc Émissaire est sacrifié." : " : personne n'est éliminé.")
              : nom(decision[0]) + " est désigné.";
            resoudre(decision, tav ? (votes[tav.id] === undefined || votes[tav.id] === "" ? null : +votes[tav.id]) : undefined);
            S.queue.unshift(info("Résultat du vote", resultat + ". " + conclusion, { notes: detail.length ? "Détail : " + detail.join(", ") + (S.mem.corbeau !== null ? "" : "") : "" }));
          },
        };
      }
      return {
        titre: s.n === 2 ? "Second vote (Juge Bègue)" : "Vote du village",
        dire: s.n === 2 ? "Le Juge a demandé un second vote : votez immédiatement, sans débat !" : "Le village débat puis vote. Qui sera envoyé au bûcher ?",
        texte: notes.join(" "),
        input: {
          kind: "players",
          candidats: ids(v),
          min: 1,
          max: 1,
          extra: [
            { v: "egalite", label: bouc ? "Égalité → 🐐 Bouc Émissaire" : "Égalité (personne)" },
            { v: "personne", label: "Personne n'est éliminé" },
          ],
        },
        apply(a) { resoudre(a); },
      };
    },

    bouc: (s) => ({
      titre: "Le Bouc Émissaire",
      dire: "Égalité ! Le Bouc Émissaire est sacrifié.",
      texte: nom(s.id) + " est éliminé. Avant de mourir, il désigne qui pourra (ou ne pourra pas) voter demain : notez sa décision.",
      input: { kind: "text", placeholder: "Ex. : seuls Alice et Bob voteront demain" },
      apply(a) {
        S.mem.boucInterdits = a || null;
        mourir(s.id, "bouc");
      },
    }),

    chatelain: (s) => {
      const ch = avecMetier("chatelain")[0];
      if (!ch || !P(s.id).alive) return null;
      return {
        titre: "Le Châtelain",
        texte: "Châtelain : " + ch.nom + ". " + nom(s.id) + " demande-t-il la grâce, et le Châtelain l'accorde-t-il ? (usage unique)",
        input: { kind: "choice", options: [{ v: "oui", label: "🏰 Gracier " + nom(s.id) }, { v: "non", label: "Pas de grâce" }] },
        apply(a) {
          if (a !== "oui") return;
          S.mem.chatelainUtilise = true;
          log(ch.nom + " (Châtelain) gracie " + nom(s.id) + ".");
          // Annule l'exécution qui suit.
          const i = S.queue.findIndex((x) => x.t === "execution" && x.id === s.id);
          if (i >= 0) S.queue.splice(i, 1);
          S.queue.unshift(info("Grâce", nom(s.id) + " est gracié par le Châtelain et reste en vie."));
        },
      };
    },

    execution: (s) => {
      const c = P(s.id);
      if (!c.alive) return null;
      const servante = acteur("servante");
      const proposeServante = servante && servante.id !== c.id;
      const executer = () => {
        if (c.role === "idiot" && pouvoirOK(c) && !S.mem.idiotRevele) {
          S.mem.idiotRevele = true;
          if (S.mem.capitaine === c.id) S.mem.capitaine = null;
          log(c.nom + " révèle qu'il est l'Idiot du Village : il est épargné mais ne vote plus.");
          S.queue.unshift(info("L'Idiot du Village", c.nom + " révèle sa carte : c'est l'Idiot du Village ! Il est épargné mais ne pourra plus voter" + (S.mem.capitaineElu ? " et perd son éventuel titre de Capitaine" : "") + "."));
          return;
        }
        if (c.metier === "tavernier" && S.mem.tavernierImmun) {
          log(c.nom + " (Tavernier) ne peut pas être envoyé au bûcher.");
          S.queue.unshift(info("Le Tavernier", c.nom + " est le Tavernier : il ne peut pas être envoyé au bûcher."));
          return;
        }
        S.pending.push(info("Au bûcher !", c.nom + " est éliminé. Révélez sa carte : " + roleNom(c.role) + "."));
        mourir(c.id, "vote");
      };
      if (!proposeServante) {
        return { auto: true, apply: executer };
      }
      return {
        titre: "La Servante Dévouée",
        texte: nom(c.id) + " va être éliminé. Avant la révélation, la Servante (" + servante.nom + ") veut-elle prendre son rôle (" + roleNom(c.role) + ") ?",
        input: { kind: "choice", options: [{ v: "oui", label: "🧹 Oui, elle prend le rôle" }, { v: "non", label: "Non" }] },
        apply(a) {
          if (a === "oui") {
            const role = c.role;
            servante.role = role;
            servante.camp = c.camp;
            c.role = "servante";
            log(servante.nom + " (Servante) prend secrètement le rôle de " + c.nom + " : " + roleNom(role) + ".", true);
            S.pending.push(info("Au bûcher !", c.nom + " est éliminé. Révélez la carte de Servante Dévouée (la Servante a pris son rôle en secret)."));
            mourir(c.id, "vote");
            return;
          }
          executer();
        },
      };
    },

    tavernier: (s) => {
      const t = avecMetier("tavernier")[0];
      if (!t) return null;
      return {
        titre: "Le Tavernier a-t-il voté contre le condamné ?",
        texte: "Tavernier : " + t.nom + ". S'il a voté contre " + nom(s.id) + ", il perd définitivement son immunité.",
        input: { kind: "choice", options: [{ v: "oui", label: "Oui, il perd son immunité" }, { v: "non", label: "Non" }] },
        apply(a) {
          if (a === "oui") { S.mem.tavernierImmun = false; log(t.nom + " (Tavernier) perd son immunité."); }
        },
      };
    },

    juge: () => {
      const j = acteur("juge-begue");
      if (!j || S.mem.jugeUtilise) return null;
      return {
        titre: "Le Juge Bègue",
        texte: "Juge Bègue : " + j.nom + ". A-t-il fait son signe pour demander un second vote ?",
        input: { kind: "choice", options: [{ v: "oui", label: "⚖️ Oui, second vote" }, { v: "non", label: "Non" }] },
        apply(a) {
          if (a !== "oui") return;
          S.mem.jugeUtilise = true;
          log("Le Juge Bègue déclenche un second vote.");
          S.queue.unshift({ t: "vote", n: 2 });
        },
      };
    },

    victoire: () => {
      const v = victoire();
      if (!v) return null;
      const cle = cleVictoire(v);
      if (S.mem.victoireIgnoree === cle) return null;
      return {
        titre: "🏆 Fin de partie ?",
        texte: v.texte,
        input: { kind: "choice", options: [{ v: "fin", label: "Terminer la partie", primary: true }, { v: "continuer", label: "Continuer quand même" }] },
        apply(a) {
          if (a === "fin") {
            S.winner = v;
            S.phase = "fin";
            log("Victoire : " + v.texte);
            S.queue = [{ t: "fin" }];
          } else S.mem.victoireIgnoree = cle;
        },
      };
    },

    fin: () => ({
      titre: "🏆 Partie terminée",
      texte: S.winner ? S.winner.texte : "",
      fin: true,
      apply() {},
    }),

    // Actions du meneur (menu)
    "mort-manuelle": () => ({
      titre: "Mort manuelle",
      texte: "Choisissez le joueur à éliminer (Petite Fille surprise, événement, oubli…). Les conséquences (amoureux, Chasseur, Capitaine…) seront appliquées.",
      input: choixJoueurs(ids(vivants())),
      skip: true,
      apply(a) {
        if (!a) return;
        S.pending.push(info("Élimination", nom(a[0]) + " est éliminé. C'était : " + roleNom(P(a[0]).role) + "."));
        mourir(a[0], "meneur");
      },
    }),

    resurrection: () => {
      const morts = S.players.filter((p) => !p.alive);
      if (morts.length === 0) return null;
      return {
        titre: "Ramener un joueur",
        texte: "Corrige une erreur : le joueur choisi redevient vivant (sans annuler les conséquences de sa mort).",
        input: choixJoueurs(ids(morts)),
        skip: true,
        apply(a) {
          if (!a) return;
          const p = P(a[0]);
          p.alive = true;
          p.mort = null;
          log(p.nom + " est ramené en jeu par le meneur.");
        },
      };
    },
  };

  // ---------- Boucle ----------

  function spec(step) {
    if (!step) return null;
    const h = H[step.t];
    if (!h) return null;
    return h(step);
  }

  function flushPending() {
    if (S.pending.length === 0) return;
    const p = S.pending;
    S.pending = [];
    S.queue.unshift(...p, { t: "victoire" });
  }

  function advance() {
    let garde = 0;
    while (garde++ < 500) {
      if (S.current) return;
      const step = S.queue.shift();
      if (!step) return;
      const sp = spec(step);
      if (!sp) continue;
      if (sp.auto) {
        sp.apply();
        flushPending();
        continue;
      }
      S.current = step;
    }
  }

  function snapshot() {
    const copie = JSON.parse(JSON.stringify({ ...S, history: [] }));
    S.history.push(copie);
    if (S.history.length > 80) S.history.shift();
  }

  function repondre(reponse) {
    const sp = spec(S.current);
    if (!sp) { S.current = null; advance(); return; }
    snapshot();
    S.current = null;
    sp.apply(reponse);
    flushPending();
    advance();
  }

  function annuler() {
    const prev = S.history.pop();
    if (!prev) return false;
    const h = S.history;
    S = prev;
    S.history = h;
    return true;
  }

  // Insère une action du meneur avant l'étape en cours.
  function intercaler(step) {
    snapshot();
    if (S.current) S.queue.unshift(S.current);
    S.current = null;
    S.queue.unshift(step);
    advance();
  }

  // Jeton « peut voter / ne peut pas voter » posé par le meneur.
  function basculerVote(id) {
    snapshot();
    const l = S.mem.privesDeVote || (S.mem.privesDeVote = []);
    const i = l.indexOf(id);
    if (i >= 0) l.splice(i, 1);
    else l.push(id);
    log(nom(id) + (i >= 0 ? " peut de nouveau voter." : " ne peut plus voter."));
  }
  const peutVoter = (id) => !(S.mem.privesDeVote || []).includes(id) && !(P(id).role === "idiot" && S.mem.idiotRevele);

  function noter(txt) {
    snapshot();
    log("📝 " + txt);
  }

  return {
    nouvellePartie,
    charger(etat) { S = etat; if (!S.current) advance(); return S; },
    etat: () => S,
    spec: () => spec(S && S.current),
    repondre,
    annuler,
    intercaler,
    noter,
    basculerVote,
    peutVoter,
    phaseLabel: () => phaseLabel(),
    estLoup,
    voisins,
    nom,
    roleNom,
    metierNom,
  };
})();
