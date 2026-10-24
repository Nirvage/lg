// Catalogue des cartes des Loups-Garous de Thiercelieux
// (jeu de base + Nouvelle Lune + Le Village + Personnages).

const EXTENSIONS = {
  base: { nom: "Jeu de base", court: "Base" },
  "nouvelle-lune": { nom: "Nouvelle Lune", court: "Nouvelle Lune" },
  village: { nom: "Le Village", court: "Village" },
  personnages: { nom: "Personnages", court: "Personnages" },
};

const CAMPS = {
  village: { nom: "Village", couleur: "village" },
  loups: { nom: "Loups-Garous", couleur: "loups" },
  solo: { nom: "Solitaire", couleur: "solo" },
  variable: { nom: "Variable", couleur: "variable" },
};

// max : nombre maximum d'exemplaires dans une composition (0 = illimité).
// nuit : moment de réveil, affiché dans la liste des cartes.
const ROLES = [
  // ---------- Jeu de base ----------
  {
    id: "loup-garou", nom: "Loup-Garou", ext: "base", camp: "loups", icone: "🐺", max: 0,
    nuit: "Chaque nuit",
    resume: "Dévore un villageois chaque nuit avec les autres loups.",
    effet: "Chaque nuit, les Loups-Garous se réveillent, se reconnaissent et désignent ensemble une victime. Le jour, ils se font passer pour des villageois. Ils gagnent lorsque tous les villageois sont éliminés.",
  },
  {
    id: "villageois", nom: "Simple Villageois", ext: "base", camp: "village", icone: "🧑‍🌾", max: 0,
    nuit: "Ne se réveille pas",
    resume: "Aucun pouvoir, seulement son vote et son flair.",
    effet: "Il n'a aucune compétence particulière. Ses seules armes sont sa capacité d'analyse des comportements pour identifier les Loups-Garous, et sa conviction pour empêcher l'exécution d'un innocent.",
  },
  {
    id: "voyante", nom: "Voyante", ext: "base", camp: "village", icone: "🔮", max: 1,
    nuit: "Chaque nuit",
    resume: "Découvre chaque nuit la carte d'un joueur.",
    effet: "Chaque nuit, elle désigne un joueur et le meneur lui montre secrètement la carte de ce joueur. Elle doit aider les villageois sans se dévoiler trop tôt.",
  },
  {
    id: "sorciere", nom: "Sorcière", ext: "base", camp: "village", icone: "🧪", max: 1,
    nuit: "Chaque nuit, après les loups",
    resume: "Une potion de vie et une potion de mort, une fois chacune.",
    effet: "Elle possède deux potions utilisables une seule fois chacune dans la partie : une potion de guérison pour ressusciter la victime des Loups-Garous, et une potion d'empoisonnement pour éliminer un joueur. Elle peut utiliser les deux la même nuit, et peut se sauver elle-même.",
  },
  {
    id: "chasseur", nom: "Chasseur", ext: "base", camp: "village", icone: "🏹", max: 1,
    nuit: "Ne se réveille pas",
    resume: "En mourant, il élimine immédiatement un joueur.",
    effet: "S'il est éliminé (par les loups ou par le vote du village), il doit immédiatement répliquer en désignant un joueur qui meurt avec lui.",
  },
  {
    id: "cupidon", nom: "Cupidon", ext: "base", camp: "village", icone: "💘", max: 1,
    nuit: "Première nuit",
    resume: "Désigne deux amoureux qui vivent et meurent ensemble.",
    effet: "La première nuit, il désigne deux joueurs (il peut se choisir) qui deviennent Amoureux. Si l'un meurt, l'autre meurt aussitôt de chagrin. Si un Amoureux est Loup-Garou et l'autre villageois, ils forment un camp à part et gagnent s'ils sont les deux derniers survivants.",
  },
  {
    id: "petite-fille", nom: "Petite Fille", ext: "base", camp: "village", icone: "👧", max: 1,
    nuit: "Pendant le tour des loups",
    resume: "Peut espionner les loups en entrouvrant les yeux.",
    effet: "Pendant le tour des Loups-Garous, elle peut entrouvrir les yeux pour les espionner. Si les loups la surprennent, elle meurt immédiatement (à la place de leur victime, selon la règle du meneur).",
  },
  {
    id: "voleur", nom: "Voleur", ext: "base", camp: "variable", icone: "🦹", max: 1,
    nuit: "Première nuit",
    resume: "Peut échanger sa carte contre une des deux cartes restantes.",
    effet: "On ajoute deux cartes à la distribution. La première nuit, le Voleur regarde ces deux cartes et peut échanger la sienne contre l'une d'elles. Si les deux cartes sont des Loups-Garous, il est obligé d'en prendre une.",
  },
  {
    id: "capitaine", nom: "Capitaine", ext: "base", camp: "variable", icone: "👑", max: 0, statut: true,
    nuit: "Élu le premier jour",
    resume: "Carte attribuée par élection : son vote compte double.",
    effet: "Le Capitaine est élu par le village au premier jour, en plus de son rôle. Son vote compte double et il tranche en cas d'égalité. À sa mort, il désigne son successeur.",
  },

  // ---------- Nouvelle Lune ----------
  {
    id: "ancien", nom: "Ancien", ext: "nouvelle-lune", camp: "village", icone: "👴", max: 1,
    nuit: "Ne se réveille pas",
    resume: "Survit à la première attaque des loups.",
    effet: "Il résiste à la première attaque des Loups-Garous. Mais s'il est éliminé par le vote du village, par la Sorcière ou par le Chasseur, tous les villageois perdent leurs pouvoirs jusqu'à la fin de la partie.",
  },
  {
    id: "bouc-emissaire", nom: "Bouc Émissaire", ext: "nouvelle-lune", camp: "village", icone: "🐐", max: 1,
    nuit: "Ne se réveille pas",
    resume: "Éliminé à la place des autres en cas d'égalité au vote.",
    effet: "En cas d'égalité lors du vote du village, c'est lui qui est éliminé. Avant de mourir, il désigne qui pourra (ou ne pourra pas) voter le lendemain.",
  },
  {
    id: "idiot", nom: "Idiot du Village", ext: "nouvelle-lune", camp: "village", icone: "🤪", max: 1,
    nuit: "Ne se réveille pas",
    resume: "Désigné par le vote, il se révèle et survit, mais ne vote plus.",
    effet: "Si le village vote contre lui, il révèle sa carte : le village l'épargne. Il reste en jeu mais perd son droit de vote (et son titre de Capitaine).",
  },
  {
    id: "joueur-de-flute", nom: "Joueur de Flûte", ext: "nouvelle-lune", camp: "solo", icone: "🎶", max: 1,
    nuit: "Chaque nuit",
    resume: "Charme deux joueurs par nuit ; gagne si tous sont charmés.",
    effet: "Chaque nuit, il charme deux joueurs. Le meneur réveille ensuite tous les joueurs charmés pour qu'ils se reconnaissent. Il gagne seul si tous les joueurs encore en vie sont charmés.",
  },
  {
    id: "salvateur", nom: "Salvateur", ext: "nouvelle-lune", camp: "village", icone: "🛡️", max: 1,
    nuit: "Chaque nuit",
    resume: "Protège un joueur des loups chaque nuit.",
    effet: "Chaque nuit, il désigne un joueur qui sera protégé de l'attaque des Loups-Garous. Il peut se protéger lui-même mais ne peut pas protéger le même joueur deux nuits de suite.",
  },
  {
    id: "evenements", nom: "Cartes Événement", ext: "nouvelle-lune", camp: "variable", icone: "🌑", max: 0, statut: true,
    nuit: "Chaque matin (variante)",
    resume: "Un événement tiré au hasard modifie le tour.",
    effet: "Variante de Nouvelle Lune : chaque matin, le meneur tire une carte Événement qui modifie les règles du tour (vote, nuit, pouvoirs...). Dans l'appli, le bouton « Événement » du menu permet de noter l'événement tiré dans le journal.",
  },

  // ---------- Le Village ----------
  {
    id: "corbeau", nom: "Corbeau", ext: "village", camp: "village", icone: "🐦‍⬛", max: 1,
    nuit: "Chaque nuit",
    resume: "Désigne un suspect qui aura 2 voix de plus contre lui.",
    effet: "Chaque nuit, il peut désigner un joueur. Le lendemain, ce joueur reçoit automatiquement deux voix supplémentaires contre lui lors du vote.",
  },
  {
    id: "pyromane", nom: "Pyromane", ext: "village", camp: "village", icone: "🔥", max: 1,
    nuit: "Chaque nuit (usage unique)",
    resume: "Une fois par partie, incendie un bâtiment.",
    effet: "Une fois dans la partie, il met le feu à un bâtiment : le bâtiment et son pouvoir disparaissent, et son occupant devient Vagabond. Si c'est la maison de la victime des loups cette nuit-là, le chef de meute qui l'attaquait périt dans l'incendie.",
  },
  {
    id: "loup-blanc", nom: "Loup-Garou Blanc", ext: "village", camp: "solo", icone: "🤍", max: 1,
    nuit: "Chaque nuit avec les loups, + une nuit sur deux seul",
    resume: "Loup solitaire : une nuit sur deux, il peut tuer un loup.",
    effet: "Il se réveille avec les Loups-Garous et vote avec eux. Une nuit sur deux, il se réveille seul et peut éliminer un Loup-Garou. Il gagne seul s'il est le dernier survivant.",
  },

  // ---------- Personnages ----------
  {
    id: "abominable-sectaire", nom: "Abominable Sectaire", ext: "personnages", camp: "solo", icone: "🕯️", max: 1,
    nuit: "Ne se réveille pas",
    resume: "Le village est coupé en deux groupes ; il doit éliminer l'autre.",
    effet: "Au début de la partie, le meneur sépare le village en deux groupes selon un critère visible (par exemple cheveux longs / courts). Le Sectaire appartient à un groupe et gagne seul quand tous les joueurs de l'autre groupe sont éliminés.",
  },
  {
    id: "ange", nom: "Ange", ext: "personnages", camp: "solo", icone: "😇", max: 1,
    nuit: "Ne se réveille pas",
    resume: "Gagne s'il est éliminé au premier vote ou la première nuit.",
    effet: "Si l'Ange est en jeu, la partie commence par un débat et un vote. S'il est éliminé lors de ce premier vote ou pendant la première nuit, il gagne seul immédiatement. Sinon, il devient un simple villageois.",
  },
  {
    id: "chevalier", nom: "Chevalier à l'Épée Rouillée", ext: "personnages", camp: "village", icone: "🗡️", max: 1,
    nuit: "Ne se réveille pas",
    resume: "Dévoré, il contamine le premier loup à sa gauche.",
    effet: "S'il est dévoré par les Loups-Garous, le premier Loup-Garou situé à sa gauche attrape le tétanos et meurt la nuit suivante (annoncé au matin d'après).",
  },
  {
    id: "chien-loup", nom: "Chien-Loup", ext: "personnages", camp: "variable", icone: "🐕", max: 1,
    nuit: "Première nuit",
    resume: "Choisit d'être Villageois ou Loup-Garou.",
    effet: "La première nuit, il choisit secrètement s'il sera un simple Villageois ou un Loup-Garou. Ce choix est définitif.",
  },
  {
    id: "comedien", nom: "Comédien", ext: "personnages", camp: "village", icone: "🎭", max: 1,
    nuit: "Chaque nuit",
    resume: "Emprunte chaque nuit le pouvoir d'une des 3 cartes mises de côté.",
    effet: "Trois cartes de personnages villageois sont posées face visible au centre. Chaque nuit, il peut choisir l'une d'elles et utiliser son pouvoir jusqu'à la nuit suivante. Chaque carte choisie est ensuite retirée.",
  },
  {
    id: "deux-soeurs", nom: "Deux Sœurs", ext: "personnages", camp: "village", icone: "👭", max: 2,
    nuit: "Première nuit, puis certaines nuits",
    resume: "Se connaissent et peuvent se concerter la nuit.",
    effet: "Les deux Sœurs se réveillent la première nuit pour se reconnaître, puis à certaines nuits au choix du meneur pour se concerter quelques instants en silence. Il faut mettre les deux cartes en jeu.",
  },
  {
    id: "trois-freres", nom: "Trois Frères", ext: "personnages", camp: "village", icone: "👬", max: 3,
    nuit: "Première nuit, puis certaines nuits",
    resume: "Se connaissent et peuvent se concerter la nuit.",
    effet: "Les trois Frères se réveillent la première nuit pour se reconnaître, puis à certaines nuits au choix du meneur pour se concerter. Il faut mettre les trois cartes en jeu.",
  },
  {
    id: "enfant-sauvage", nom: "Enfant Sauvage", ext: "personnages", camp: "variable", icone: "🧒", max: 1,
    nuit: "Première nuit",
    resume: "Choisit un modèle ; si le modèle meurt, il devient loup.",
    effet: "La première nuit, il désigne un joueur comme modèle. Tant que le modèle est vivant, il est villageois. Si le modèle meurt, l'Enfant Sauvage devient Loup-Garou et se réveille avec eux dès la nuit suivante.",
  },
  {
    id: "grand-mechant-loup", nom: "Grand Méchant Loup", ext: "personnages", camp: "loups", icone: "🐺", max: 1,
    nuit: "Chaque nuit, après les loups",
    resume: "Dévore une seconde victime tant qu'aucun loup n'est mort.",
    effet: "Il se réveille avec les Loups-Garous. Ensuite, tant qu'aucun Loup-Garou, Chien-Loup ou Enfant Sauvage devenu loup n'a été éliminé, il se réveille seul et dévore une seconde victime (qui ne peut pas être un loup).",
  },
  {
    id: "infect", nom: "Infect Père des Loups", ext: "personnages", camp: "loups", icone: "🦠", max: 1,
    nuit: "Chaque nuit avec les loups",
    resume: "Une fois, transforme la victime des loups en loup.",
    effet: "Il se réveille avec les Loups-Garous. Une fois par partie, au lieu de laisser la victime mourir, il peut l'infecter : elle devient secrètement Loup-Garou (et conserve son pouvoir éventuel).",
  },
  {
    id: "juge-begue", nom: "Juge Bègue", ext: "personnages", camp: "village", icone: "⚖️", max: 1,
    nuit: "Première nuit (signe convenu)",
    resume: "Une fois, peut provoquer un second vote dans la même journée.",
    effet: "La première nuit, il convient d'un signe avec le meneur. Une fois dans la partie, en faisant ce signe pendant un vote, il déclenche un second vote immédiat, sans débat, juste après le premier.",
  },
  {
    id: "montreur-ours", nom: "Montreur d'Ours", ext: "personnages", camp: "village", icone: "🐻", max: 1,
    nuit: "Chaque matin",
    resume: "Son ours grogne si un loup est assis à côté de lui.",
    effet: "Chaque matin, si au moins un de ses voisins directs encore en vie est un Loup-Garou, le meneur fait grogner l'ours. Les joueurs éliminés ne comptent pas comme voisins.",
  },
  {
    id: "renard", nom: "Renard", ext: "personnages", camp: "village", icone: "🦊", max: 1,
    nuit: "Chaque nuit",
    resume: "Flaire un groupe de trois joueurs ; perd son pouvoir s'il se trompe.",
    effet: "Chaque nuit, il peut désigner un joueur : le meneur lui indique si ce joueur ou l'un de ses deux voisins directs est un Loup-Garou. S'il n'y a aucun loup dans le groupe, il perd son pouvoir.",
  },
  {
    id: "servante", nom: "Servante Dévouée", ext: "personnages", camp: "village", icone: "🧹", max: 1,
    nuit: "Ne se réveille pas",
    resume: "Peut prendre le rôle d'un joueur éliminé par le vote.",
    effet: "Lorsqu'un joueur est éliminé par le vote, avant la révélation de sa carte, elle peut se dévoiler et prendre secrètement son rôle. Elle n'hérite pas des liens (amoureux, charme...).",
  },
  {
    id: "villageois-villageois", nom: "Villageois-Villageois", ext: "personnages", camp: "village", icone: "🧑", max: 1,
    nuit: "Ne se réveille pas",
    resume: "Carte Villageois des deux côtés : un innocent prouvé.",
    effet: "Sa carte montre un Villageois des deux côtés : tout le monde sait qu'il est innocent. Il n'a aucun pouvoir.",
  },
  {
    id: "gitane", nom: "Gitane", ext: "personnages", camp: "village", icone: "🃏", max: 1,
    nuit: "Chaque nuit (au choix)",
    resume: "Fait poser une question aux esprits des morts.",
    effet: "Chaque nuit, elle peut utiliser une carte Spiritisme et désigner un joueur, le Médium. Au matin, le Médium lit à voix haute la question choisie et le premier joueur éliminé répond par oui ou non.",
  },
];

// Métiers / bâtiments de l'extension Le Village (attribués en plus du rôle).
const METIERS = [
  {
    id: "fermier", nom: "Fermier", icone: "🌾", max: 0, usage: "permanent",
    effet: "Seuls les Fermiers peuvent se présenter et voter à l'élection du Capitaine. Si le Capitaine meurt, son successeur doit être un Fermier vivant.",
  },
  {
    id: "vagabond", nom: "Vagabond", icone: "🎒", max: 0, usage: "permanent",
    effet: "Il n'a pas de bâtiment. Quand un bâtiment se libère, le Bailli peut l'attribuer à un Vagabond, qui prend alors ce métier.",
  },
  {
    id: "rebouteux", nom: "Rebouteux", icone: "🦴", max: 1, usage: "unique",
    effet: "Une fois dans la partie, il rend à un joueur le pouvoir à usage unique que celui-ci a déjà utilisé. Il perd alors le sien.",
  },
  {
    id: "confesseur", nom: "Confesseur", icone: "⛪", max: 1, usage: "unique",
    effet: "Une fois dans la partie, il entend un joueur en confession : il découvre secrètement le rôle de ce joueur.",
  },
  {
    id: "institutrice", nom: "Institutrice", icone: "📚", max: 1, usage: "permanent",
    effet: "Chaque jour avant le vote, elle peut interdire de vote jusqu'à deux joueurs ayant un métier. Elle ne vote jamais et n'a pas d'effet sur les Vagabonds.",
  },
  {
    id: "boulanger", nom: "Boulanger", icone: "🥖", max: 1, usage: "permanent",
    effet: "Chaque nuit, il ouvre les yeux juste après que le meneur a annoncé que les Loups-Garous se rendorment, et peut ainsi les apercevoir regagner leur place.",
  },
  {
    id: "bailli", nom: "Bailli", icone: "📜", max: 1, usage: "permanent",
    effet: "Il attribue les bâtiments libérés aux Vagabonds de son choix. S'il est éliminé, plus aucun bâtiment n'est redistribué.",
  },
  {
    id: "barbier", nom: "Barbier", icone: "💈", max: 1, usage: "unique",
    effet: "Une fois dans la partie, il peut éliminer un joueur qui n'est pas Vagabond. S'il élimine un Loup-Garou il est félicité ; s'il élimine un villageois, il est aussitôt éliminé à son tour.",
  },
  {
    id: "tavernier", nom: "Tavernier", icone: "🍺", max: 1, usage: "permanent",
    effet: "Il ne peut être ni dévoré par les loups ni envoyé au bûcher, tant qu'il n'a jamais voté contre la personne envoyée au bûcher.",
  },
  {
    id: "chatelain", nom: "Châtelain", icone: "🏰", max: 1, usage: "unique",
    effet: "Une fois dans la partie, après un vote, il peut gracier le condamné (à la demande de celui-ci). Il peut se gracier lui-même.",
  },
];

const ROLE_BY_ID = Object.fromEntries(ROLES.map((r) => [r.id, r]));
const METIER_BY_ID = Object.fromEntries(METIERS.map((m) => [m.id, m]));

// Rôles qu'on peut mettre dans une composition (pas les statuts comme Capitaine).
const ROLES_JOUABLES = ROLES.filter((r) => !r.statut);

// Visuel d'une carte, par ordre de priorité :
// 1. la photo de la carte prise dans l'appli (page Cartes), gardée dans ce navigateur ;
// 2. l'image déposée dans img/cartes/<id>.png ;
// 3. l'icône.
const CLE_PHOTOS = "lg-mj-photos";
const PHOTOS = (() => {
  try { return JSON.parse(localStorage.getItem(CLE_PHOTOS)) || {}; } catch (e) { return {}; }
})();
function enregistrerPhoto(id, dataUrl) {
  if (dataUrl) PHOTOS[id] = dataUrl;
  else delete PHOTOS[id];
  try {
    localStorage.setItem(CLE_PHOTOS, JSON.stringify(PHOTOS));
    return true;
  } catch (e) {
    return false;
  }
}
const IMAGES_ABSENTES = new Set();
function visuelCarte(id, classe) {
  const r = ROLE_BY_ID[id];
  const icone = r ? r.icone : "?";
  if (PHOTOS[id]) return `<span class="visuel photo ${classe || ""}"><img src="${PHOTOS[id]}" alt="${r ? r.nom : ""}"></span>`;
  if (IMAGES_ABSENTES.has(id)) return `<span class="visuel sans-image ${classe || ""}"><span class="repli">${icone}</span></span>`;
  return `<span class="visuel ${classe || ""}"><img src="img/cartes/${id}.png" alt="" data-carte="${id}"><span class="repli">${icone}</span></span>`;
}
if (typeof document !== "undefined") {
  document.addEventListener("error", (e) => {
    const img = e.target;
    if (img && img.tagName === "IMG" && img.dataset.carte) {
      IMAGES_ABSENTES.add(img.dataset.carte);
      img.parentNode.classList.add("sans-image");
    }
  }, true);
}

// ---------- Partage de la composition (QR code) ----------

// Adresse publique du site (GitHub Pages), utilisée quand l'appli tourne
// ailleurs (ex. aperçu) pour que le QR code mène quand même à la page.
const URL_SITE = "https://nirvage.github.io/lg/";

// cartes / metiers : listes d'ids (avec répétitions).
function lienCompo(cartes, metiers) {
  const compter = (l) => {
    const n = {};
    l.forEach((id) => { n[id] = (n[id] || 0) + 1; });
    // Ordre fixe (celui des cartes) : l'ordre des joueurs ne doit rien révéler.
    const rang = (id) => { const i = ROLES.findIndex((r) => r.id === id); return i < 0 ? 999 + METIERS.findIndex((m) => m.id === id) : i; };
    return Object.entries(n).sort(([x], [y]) => rang(x) - rang(y)).map(([id, k]) => (k > 1 ? id + "*" + k : id)).join(",");
  };
  const local = /^https?:$/.test(location.protocol) && !/claude|anthropic|usercontent/.test(location.hostname);
  const base = local ? new URL("compo.html", location.href).href : URL_SITE + "compo.html";
  return base + "#r=" + compter(cartes) + (metiers && metiers.length ? "&m=" + compter(metiers) : "");
}

function lireCompo(hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const lire = (s) => (s || "").split(",").filter(Boolean).map((x) => {
    const [id, k] = x.split("*");
    return { id, n: +k || 1 };
  });
  return {
    roles: lire(params.get("r")).filter((x) => ROLE_BY_ID[x.id]),
    metiers: lire(params.get("m")).filter((x) => METIER_BY_ID[x.id]),
  };
}

// QR code en SVG (bibliothèque qrcode-generator).
function qrSvg(texte) {
  const qr = qrcode(0, "M");
  qr.addData(texte);
  qr.make();
  return qr.createSvgTag({ cellSize: 6, margin: 4, scalable: true });
}
