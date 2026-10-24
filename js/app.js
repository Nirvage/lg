// Interface : préparation de la partie (joueurs, composition, distribution)
// puis déroulé pas à pas piloté par Engine.

(() => {
  const CLE_CONFIG = "lg-mj-config";
  const CLE_PARTIE = "lg-mj-partie";
  const app = document.getElementById("app");

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function lire(cle) {
    try { return JSON.parse(localStorage.getItem(cle)); } catch (e) { return null; }
  }
  function ecrire(cle, val) {
    try { localStorage.setItem(cle, JSON.stringify(val)); } catch (e) { /* stockage indisponible */ }
  }
  function effacer(cle) {
    try { localStorage.removeItem(cle); } catch (e) { /* rien */ }
  }

  const config = Object.assign(
    {
      joueurs: Array.from({ length: 8 }, (_, i) => "Joueur " + (i + 1)),
      compo: {},
      metiers: {},
      extensions: { base: true, "nouvelle-lune": true, village: true, personnages: true },
      capitaine: true,
      loupsEntreDevorer: false,
      votesDetailles: false,
      voteConfiance: false,
      pesteNoire: false,
      voleurVole: false,
      distribution: [],
    },
    lire(CLE_CONFIG) || {}
  );
  const sauverConfig = () => ecrire(CLE_CONFIG, config);

  let vue = "joueurs";
  let selection = [];
  let cleEtape = null;
  // Sections repliables de l'écran de partie restant ouvertes entre deux rendus.
  const ouverts = { joueurs: true, outils: false, journal: false };
  const ouvert = (k) => (ouverts[k] ? "open" : "");
  let rolesReveles = false; // rôles des vivants masqués par défaut dans la liste

  const partieSauvee = lire(CLE_PARTIE);
  if (partieSauvee && partieSauvee.players && partieSauvee.phase !== "fin") {
    Engine.charger(partieSauvee);
    vue = "partie";
  }

  // ---------- Calculs de composition ----------

  const extensionsActives = () => Object.keys(EXTENSIONS).filter((e) => config.extensions[e]);
  const rolesVisibles = () => ROLES_JOUABLES.filter((r) => config.extensions[r.ext]);
  const totalCompo = () => Object.entries(config.compo).reduce((s, [id, n]) => s + (ROLE_BY_ID[id] && config.extensions[ROLE_BY_ID[id].ext] ? n : 0), 0);
  const totalMetiers = () => (config.extensions.village ? Object.values(config.metiers).reduce((s, n) => s + n, 0) : 0);
  const nbJoueurs = () => config.joueurs.length;

  function cartesSupplementaires() {
    let n = 0;
    if (config.compo.voleur && config.extensions.base && !config.voleurVole) n += 2;
    if (config.compo.comedien && config.extensions.personnages) n += 3;
    return n;
  }

  function avertissementsCompo() {
    const w = [];
    const attendu = nbJoueurs() + cartesSupplementaires();
    const total = totalCompo();
    if (total < nbJoueurs()) w.push("Il manque " + (nbJoueurs() - total) + " carte(s) pour " + nbJoueurs() + " joueurs.");
    else if (total !== attendu) w.push(total + " cartes au lieu de " + attendu + " attendues" + (cartesSupplementaires() ? " (joueurs + cartes du Voleur/Comédien)" : "") + ".");
    const loups = Object.entries(config.compo).filter(([id, n]) => n && ROLE_BY_ID[id] && ROLE_BY_ID[id].camp === "loups").reduce((s, [, n]) => s + n, 0);
    if (loups === 0 && !config.compo["loup-blanc"] && !config.pesteNoire) w.push("Aucun Loup-Garou dans la composition.");
    if (config.compo["deux-soeurs"] && config.compo["deux-soeurs"] !== 2) w.push("Il faut exactement 2 Sœurs.");
    if (config.compo["trois-freres"] && config.compo["trois-freres"] !== 3) w.push("Il faut exactement 3 Frères.");
    if (totalMetiers() > nbJoueurs()) w.push("Plus de bâtiments que de joueurs.");
    return w;
  }

  function compoRapide() {
    const n = nbJoueurs();
    const c = {};
    c["loup-garou"] = Math.max(1, Math.round(n / 4));
    const speciaux = ["voyante", "sorciere", "chasseur", "cupidon", "petite-fille", "salvateur", "ancien", "idiot", "renard"];
    let reste = n - c["loup-garou"];
    for (const id of speciaux) {
      if (reste <= Math.ceil(n / 4)) break;
      if (!config.extensions[ROLE_BY_ID[id].ext]) continue;
      c[id] = 1;
      reste--;
    }
    if (reste > 0) c.villageois = reste;
    config.compo = c;
    sauverConfig();
  }

  // Liste à plat des cartes de la composition (un élément par carte).
  function paquet() {
    const res = [];
    rolesVisibles().forEach((r) => {
      for (let i = 0; i < (config.compo[r.id] || 0); i++) res.push(r.id);
    });
    return res;
  }
  function paquetMetiers() {
    const res = [];
    if (!config.extensions.village) return res;
    METIERS.forEach((m) => {
      for (let i = 0; i < (config.metiers[m.id] || 0); i++) res.push(m.id);
    });
    return res;
  }

  function normaliserDistribution() {
    const n = nbJoueurs();
    config.distribution = Array.from({ length: n }, (_, i) => config.distribution[i] || { role: "", metier: "" });
  }

  function melanger(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function distribuerHasard() {
    const cartes = melanger(paquet());
    const metiers = melanger(paquetMetiers());
    config.distribution = config.joueurs.map((_, i) => ({ role: cartes[i] || "", metier: metiers[i] || (metiers.length ? "vagabond" : "") }));
    sauverConfig();
  }

  function cartesRestantes() {
    const reste = paquet();
    config.distribution.forEach((d) => {
      const i = reste.indexOf(d.role);
      if (i >= 0) reste.splice(i, 1);
    });
    return reste;
  }

  function erreursDistribution() {
    const e = [];
    const compte = {};
    config.distribution.forEach((d, i) => {
      if (!d.role) e.push(config.joueurs[i] + " n'a pas de rôle.");
      else compte[d.role] = (compte[d.role] || 0) + 1;
    });
    Object.entries(compte).forEach(([id, n]) => {
      if (n > (config.compo[id] || 0)) e.push(ROLE_BY_ID[id].nom + " attribué " + n + " fois pour " + (config.compo[id] || 0) + " carte(s).");
    });
    if (config.extensions.village) {
      const cm = {};
      config.distribution.forEach((d) => { if (d.metier) cm[d.metier] = (cm[d.metier] || 0) + 1; });
      Object.entries(cm).forEach(([id, n]) => {
        const m = METIER_BY_ID[id];
        if (m && m.max && n > m.max) e.push(m.nom + " attribué " + n + " fois.");
      });
    }
    return e;
  }

  // ---------- Rendu ----------

  function etapesSetup(actif) {
    const noms = [["joueurs", "1. Joueurs"], ["compo", "2. Composition"], ["distrib", "3. Rôles"]];
    return '<div class="steps">' + noms.map(([v, l]) => '<span class="' + (v === actif ? "actif" : "") + '">' + l + "</span>").join("") + "</div>";
  }

  function render() {
    if (vue === "joueurs") renderJoueurs();
    else if (vue === "compo") renderCompo();
    else if (vue === "distrib") renderDistrib();
    else renderPartie();
  }

  function renderJoueurs() {
    const reprise = lire(CLE_PARTIE);
    app.innerHTML = `
      ${reprise && reprise.phase !== "fin" ? `<div class="panel row"><span class="grow">Une partie est en cours.</span><button class="primary" data-a="reprendre">Reprendre</button></div>` : ""}
      ${etapesSetup("joueurs")}
      <div class="panel">
        <h2 style="margin-top:0">Joueurs (${nbJoueurs()})</h2>
        <p class="muted small">Saisissez les joueurs <strong>dans l'ordre de la table</strong> (sens des aiguilles d'une montre). L'ordre sert au Renard, au Montreur d'Ours et au Chevalier.</p>
        <div id="liste-joueurs">
          ${config.joueurs.map((n, i) => `
            <div class="joueur-ligne">
              <span class="num">${i + 1}</span>
              <input type="text" value="${esc(n)}" data-joueur="${i}" aria-label="Nom du joueur ${i + 1}">
              <button class="small ghost" data-a="monter" data-i="${i}" ${i === 0 ? "disabled" : ""} aria-label="Monter">▲</button>
              <button class="small ghost" data-a="descendre" data-i="${i}" ${i === nbJoueurs() - 1 ? "disabled" : ""} aria-label="Descendre">▼</button>
              <button class="small danger" data-a="suppr" data-i="${i}" aria-label="Supprimer">✕</button>
            </div>`).join("")}
        </div>
        <div class="row" style="margin-top:10px">
          <button data-a="ajouter-joueur">＋ Ajouter un joueur</button>
        </div>
      </div>
      <button class="primary block" data-a="vers-compo" ${nbJoueurs() < 3 ? "disabled" : ""}>Suivant : composition →</button>
    `;
  }

  function compteur(id, val, attr) {
    return `<div class="compteur">
      <button class="small" data-a="moins" data-${attr}="${id}" ${val ? "" : "disabled"} aria-label="Retirer">−</button>
      <span class="val ${val ? "" : "zero"}">${val}</span>
      <button class="small" data-a="plus" data-${attr}="${id}" aria-label="Ajouter">＋</button>
    </div>`;
  }

  function renderCompo() {
    const w = avertissementsCompo();
    const total = totalCompo();
    app.innerHTML = `
      ${etapesSetup("compo")}
      <div class="panel">
        <h2 style="margin-top:0">Extensions</h2>
        ${Object.entries(EXTENSIONS).map(([id, e]) => `
          <label class="check"><input type="checkbox" data-ext="${id}" ${config.extensions[id] ? "checked" : ""}> ${esc(e.nom)}</label>`).join("")}
        <h2>Options</h2>
        <label class="check"><input type="checkbox" data-opt="capitaine" ${config.capitaine ? "checked" : ""}> Élire un Capitaine le premier jour</label>
        <label class="check"><input type="checkbox" data-opt="loupsEntreDevorer" ${config.loupsEntreDevorer ? "checked" : ""}> Les loups peuvent se dévorer entre eux</label>
        <label class="check"><input type="checkbox" data-opt="votesDetailles" ${config.votesDetailles ? "checked" : ""}> Noter le vote de chaque joueur (l'appli fait le décompte)</label>
        <label class="check"><input type="checkbox" data-opt="voteConfiance" ${config.voteConfiance ? "checked" : ""}> Proposer le vote de confiance (à chaque vote, vous choisissez : classique ou confiance)</label>
        <label class="check"><input type="checkbox" data-opt="pesteNoire" ${config.pesteNoire ? "checked" : ""}> Peste noire possible (la compo peut n'avoir aucun loup ; le village peut voter « la peste »)</label>
        <label class="check"><input type="checkbox" data-opt="voleurVole" ${config.voleurVole ? "checked" : ""}> Variante du Voleur : chaque nuit, le Voleur vole la carte d'un joueur, qui devient le Voleur à son tour (pas de cartes en plus)</label>
        <div class="row" style="margin-top:8px">
          <button data-a="compo-rapide">⚡ Compo suggérée</button>
          <button class="ghost" data-a="compo-vide">Tout remettre à zéro</button>
        </div>
      </div>
      ${extensionsActives().map((ext) => {
        const roles = rolesVisibles().filter((r) => r.ext === ext);
        const nb = roles.reduce((s, r) => s + (config.compo[r.id] || 0), 0);
        return `<details class="panel compo-ext" ${ext === "base" || nb ? "open" : ""}>
          <summary>${esc(EXTENSIONS[ext].nom)} ${nb ? `<span class="muted">(${nb})</span>` : ""}</summary>
          ${roles.map((r) => `
            <div class="compo-role">
              ${visuelCarte(r.id, "ico")}
              <span class="nom">${esc(r.nom)} <span class="pastille camp-${r.camp}">${esc(CAMPS[r.camp].nom)}</span><small>${esc(r.resume)}</small></span>
              ${compteur(r.id, config.compo[r.id] || 0, "role")}
            </div>`).join("")}
        </details>`;
      }).join("")}
      ${config.extensions.village ? `
        <details class="panel compo-ext" ${totalMetiers() ? "open" : ""}>
          <summary>Bâtiments du Village (métiers) ${totalMetiers() ? `<span class="muted">(${totalMetiers()})</span>` : ""}</summary>
          <p class="muted small">Facultatif. Chaque joueur reçoit un bâtiment en plus de son rôle ; les joueurs sans bâtiment sont Vagabonds.</p>
          ${METIERS.map((m) => `
            <div class="compo-role">
              <span class="ico">${m.icone}</span>
              <span class="nom">${esc(m.nom)}<small>${esc(m.effet)}</small></span>
              ${compteur(m.id, config.metiers[m.id] || 0, "metier")}
            </div>`).join("")}
        </details>` : ""}
      <div class="bilan">
        <strong>${total} carte${total > 1 ? "s" : ""}</strong>
        <span class="muted">pour ${nbJoueurs()} joueurs${cartesSupplementaires() ? " (+" + cartesSupplementaires() + " hors-jeu)" : ""}</span>
        <span class="grow small ${w.length ? "ko" : "ok"}">${w.length ? esc(w.join(" ")) : "✓ Composition complète"}</span>
        <button data-a="vers-joueurs">←</button>
        <button class="primary" data-a="vers-distrib" ${total < nbJoueurs() ? "disabled" : ""}>Rôles →</button>
      </div>
    `;
  }

  // Résumé de la composition, regroupé par camp.
  function resumeCompo(cartes, horsJeu) {
    const parCamp = {};
    cartes.forEach((id) => {
      const r = ROLE_BY_ID[id];
      (parCamp[r.camp] = parCamp[r.camp] || {})[id] = (parCamp[r.camp][id] || 0) + 1;
    });
    const lignes = Object.keys(CAMPS).filter((c) => parCamp[c]).map((c) => {
      const roles = Object.entries(parCamp[c]);
      const n = roles.reduce((t, [, k]) => t + k, 0);
      return `<div class="resume-ligne"><span class="pastille camp-${c}">${esc(CAMPS[c].nom)} · ${n}</span>
        <span>${roles.map(([id, k]) => esc(ROLE_BY_ID[id].nom) + (k > 1 ? " ×" + k : "")).join(", ")}</span></div>`;
    });
    if (horsJeu && horsJeu.length) lignes.push(`<div class="resume-ligne"><span class="pastille">Hors-jeu · ${horsJeu.length}</span><span>${horsJeu.map((id) => esc(ROLE_BY_ID[id].nom)).join(", ")}</span></div>`);
    return `<div class="resume">${lignes.join("")}</div>`;
  }

  function renderDistrib() {
    normaliserDistribution();
    const cartes = [...new Set(paquet())];
    const metiers = config.extensions.village && totalMetiers() ? METIERS : [];
    const errs = erreursDistribution();
    const reste = cartesRestantes();
    app.innerHTML = `
      ${etapesSetup("distrib")}
      <div class="panel">
        <h2 style="margin-top:0">Composition</h2>
        <p class="muted small">${nbJoueurs()} joueurs, ${paquet().length} cartes.</p>
        ${resumeCompo(paquet())}
        <button class="small" data-a="qr-compo" style="margin-top:8px">📱 QR code de la compo</button>
      </div>
      <div class="panel">
        <h2 style="margin-top:0">Qui a quel rôle ?</h2>
        <p class="muted small">Distribuez les cartes physiques puis notez les rôles, ou laissez l'appli tirer au sort et montrez-les aux joueurs avec le téléphone.</p>
        <div class="row" style="margin-bottom:12px">
          <button data-a="hasard">🎲 Distribuer au hasard</button>
          <button data-a="montrer" ${errs.length ? "disabled" : ""}>👁️ Montrer les rôles aux joueurs</button>
        </div>
        <div class="distrib">
          ${config.joueurs.map((n, i) => {
            const d = config.distribution[i];
            return `<div class="ligne ${metiers.length ? "avec-metier" : ""}">
              <span class="nomj">${i + 1}. ${esc(n)}</span>
              <select data-distrib-role="${i}" aria-label="Rôle de ${esc(n)}">
                <option value="">— rôle —</option>
                ${cartes.map((id) => `<option value="${id}" ${d.role === id ? "selected" : ""}>${ROLE_BY_ID[id].icone} ${esc(ROLE_BY_ID[id].nom)}</option>`).join("")}
              </select>
              ${metiers.length ? `<select data-distrib-metier="${i}" aria-label="Bâtiment de ${esc(n)}">
                <option value="">— bâtiment —</option>
                ${metiers.map((m) => `<option value="${m.id}" ${d.metier === m.id ? "selected" : ""}>${m.icone} ${esc(m.nom)}</option>`).join("")}
              </select>` : ""}
            </div>`;
          }).join("")}
        </div>
        ${reste.length ? `<p class="small" style="margin-top:12px"><strong>Cartes hors-jeu :</strong> ${reste.map((id) => ROLE_BY_ID[id].icone + " " + esc(ROLE_BY_ID[id].nom)).join(", ")}
          <br><span class="muted">Elles servent au Voleur et/ou au Comédien.</span></p>` : ""}
        ${errs.length ? `<p class="small ko" style="color:#ffb3b3">${esc(errs.join(" "))}</p>` : ""}
      </div>
      <div class="row">
        <button data-a="vers-compo">← Composition</button>
        <button class="primary grow" data-a="commencer" ${errs.length ? "disabled" : ""}>🌙 Commencer la partie</button>
      </div>
    `;
  }

  // ---------- Partie ----------

  // secrets = false : n'affiche que les infos publiques (capitaine, métier, corbeau…)
  function badges(p, S, secrets = true) {
    const b = [];
    if (S.mem.capitaine === p.id) b.push("👑");
    if (secrets && S.mem.couple && S.mem.couple.includes(p.id)) b.push("❤️");
    if (secrets && S.mem.charmes.includes(p.id)) b.push("🎶");
    if (secrets && S.phase === "nuit" && S.night && S.night.protege === p.id) b.push("🛡️");
    if (secrets && p.camp === "loups" && ROLE_BY_ID[p.role] && ROLE_BY_ID[p.role].camp !== "loups") b.push("🐺");
    if (p.metier) b.push(METIER_BY_ID[p.metier].icone);
    if (S.mem.corbeau === p.id) b.push("🐦‍⬛");
    if (p.metier === "tavernier" && S.mem.tavernierImmun) b.push("🛡️🍺");
    return b.join(" ");
  }

  function libelleJoueur(p) {
    const r = ROLE_BY_ID[p.role];
    return r ? r.nom : p.role;
  }

  function renderPartie() {
    const S = Engine.etat();
    if (!S) { vue = "joueurs"; render(); return; }
    const sp = Engine.spec();
    const cle = JSON.stringify(S.current) + "|" + S.history.length;
    if (cle !== cleEtape) { selection = []; cleEtape = cle; }
    const nuit = S.phase === "nuit";

    let corps = "";
    if (sp) {
      const inp = sp.input;
      let saisie = "";
      let peutValider = true;
      if (inp && inp.kind === "players") {
        const cands = S.players.filter((p) => inp.candidats.includes(p.id));
        saisie = `<div class="choix-joueurs">${cands.map((p) => `
          <button data-a="sel" data-id="${p.id}" class="${selection.includes(p.id) ? "sel" : ""}">
            ${visuelCarte(p.role, "mini")}
            <span class="txt"><span>${esc(p.nom)} ${badges(p, S)}</span><span class="r">${esc(libelleJoueur(p))}</span></span>
          </button>`).join("")}</div>`;
        if (inp.extra) saisie += `<div class="choix-options">${inp.extra.map((o) => `<button data-a="opt" data-v="${esc(o.v)}">${esc(o.label)}</button>`).join("")}</div>`;
        peutValider = selection.length >= inp.min && selection.length <= inp.max;
        if (inp.max > 1) saisie = `<p class="muted small">Sélectionnez ${inp.min === inp.max ? inp.min : "de " + inp.min + " à " + inp.max} joueur(s). (${selection.length} choisi(s))</p>` + saisie;
      } else if (inp && inp.kind === "choice") {
        saisie = `<div class="choix-options">${inp.options.map((o) => `<button data-a="opt" data-v="${esc(o.v)}" class="${o.primary ? "primary" : ""}">${esc(o.label)}</button>`).join("")}</div>`;
      } else if (inp && inp.kind === "text") {
        saisie = `<input type="text" id="saisie-texte" placeholder="${esc(inp.placeholder || "")}">`;
      } else if (inp && inp.kind === "votes") {
        const cibles = S.players.filter((p) => inp.candidats.includes(p.id));
        saisie = `<p class="muted small">Pour chaque votant, choisissez contre qui il vote. Le Capitaine compte double et les 2 voix du Corbeau sont ajoutées automatiquement.</p>
          <div class="votes">${S.players.filter((p) => inp.votants.includes(p.id)).map((p) => `
            <label class="vote-ligne"><span>${esc(p.nom)}${S.mem.capitaine === p.id ? " 👑" : ""}</span>
              <select data-vote="${p.id}" aria-label="Vote de ${esc(p.nom)}">
                <option value="">— abstention —</option>
                ${cibles.filter((c) => c.id !== p.id).map((c) => `<option value="${c.id}">${esc(c.nom)}</option>`).join("")}
              </select>
            </label>`).join("")}</div>`;
        if (inp.extra) saisie += `<div class="choix-options">${inp.extra.map((o) => `<button data-a="opt" data-v="${esc(o.v)}">${esc(o.label)}</button>`).join("")}</div>`;
      }
      const boutonValider = sp.fin
        ? `<button class="primary" data-a="nouvelle">🔁 Nouvelle partie</button>`
        : inp && inp.kind === "choice"
          ? ""
          : `<button class="primary" data-a="valider" ${peutValider ? "" : "disabled"}>${inp && inp.kind === "players" ? "Valider" : inp && inp.kind === "votes" ? "Valider le vote" : "Continuer"} →</button>`;
      corps = `
        <div class="etape ${nuit ? "nuit" : ""}">
          <h2>${esc(sp.titre || "")}</h2>
          ${sp.dire ? `<div class="dire">${esc(sp.dire)}</div>` : ""}
          ${sp.secret ? `<div class="secret">🤫 Information secrète, ne pas annoncer.</div>` : ""}
          ${sp.texte ? `<div class="texte">${esc(sp.texte)}</div>` : ""}
          ${sp.notes ? `<div class="notes">${esc(sp.notes)}</div>` : ""}
          ${saisie}
          ${sp.dodo ? `<div class="dodo">${esc(sp.dodo)}</div>` : ""}
          <div class="actions">
            ${S.history.length ? `<button data-a="annuler" title="Revenir à l'étape précédente">↶ Retour</button>` : ""}
            ${sp.skip ? `<button data-a="passer">Passer</button>` : ""}
            ${boutonValider}
          </div>
        </div>`;
    }

    const vivants = S.players.filter((p) => p.alive).length;
    app.innerHTML = `
      <div class="phase-bandeau">
        <span class="phase ${nuit ? "nuit" : S.phase === "jour" ? "jour" : ""}">${esc(Engine.phaseLabel())}</span>
        <span class="muted grow">${vivants} vivant${vivants > 1 ? "s" : ""} / ${S.players.length}</span>
      </div>
      ${S.phase === "fin" ? "" : chronoHtml()}
      ${corps}
      <details class="panel section" data-k="joueurs" ${ouvert("joueurs")}>
        <summary>Joueurs</summary>
        ${S.phase === "fin" ? "" : `<button class="small" data-a="voir-roles" style="margin-top:8px">${rolesReveles ? "🙈 Masquer les rôles" : "👁️ Afficher les rôles"}</button>`}
        <div class="joueurs-partie" style="margin-top:8px">
          ${S.players.map((p) => { const vu = rolesReveles || !p.alive || S.phase === "fin"; return `
            <div class="jp ${p.alive ? "" : "mort"}">
              ${vu ? visuelCarte(p.role, "ico") : `<span class="ico cache" aria-hidden="true">🂠</span>`}
              <span class="n">${esc(p.nom)}</span>
              <span class="r">${vu ? esc(ROLE_BY_ID[p.role] ? ROLE_BY_ID[p.role].nom : p.role) : "Rôle caché"}${p.metier ? " · " + esc(METIER_BY_ID[p.metier].nom) : ""}${p.alive ? "" : " — " + esc(p.mort.quand)}</span>
              <span class="badges">${badges(p, S, vu)}</span>
              ${p.alive ? `<button class="small jeton ${Engine.peutVoter(p.id) ? "" : "prive"}" data-a="jeton-vote" data-id="${p.id}" title="Peut voter ou non" aria-label="${Engine.peutVoter(p.id) ? "Peut voter" : "Ne peut pas voter"} : ${esc(p.nom)}">${Engine.peutVoter(p.id) ? "🗳️" : "🚫"}</button>` : ""}
            </div>`; }).join("")}
        </div>
        <p class="muted small">Touchez 🗳️ / 🚫 pour indiquer qui peut voter (Bouc Émissaire, Institutrice…).</p>
        <p class="muted small">👑 Capitaine · ❤️ Amoureux · 🎶 Charmé · 🛡️ Protégé · 🐺 Devenu loup · 🐦‍⬛ Accusé par le Corbeau · 🛡️🍺 Tavernier immunisé</p>
      </details>
      <details class="panel section" data-k="compo" ${ouvert("compo")}>
        <summary>Composition</summary>
        <div style="margin-top:8px">${resumeCompo(S.players.map((p) => p.roleInitial), S.horsJeu)}</div>
        <button class="small" data-a="qr-compo" style="margin-top:8px">📱 QR code de la compo</button>
      </details>
      <details class="panel section" data-k="outils" ${ouvert("outils")}>
        <summary>Outils du meneur</summary>
        <div class="row" style="margin-top:8px">
          <button data-a="mort-manuelle">☠️ Mort manuelle</button>
          <button data-a="resurrection">↺ Ramener un joueur</button>
          <button data-a="note">📝 Événement / note</button>
          <button class="danger" data-a="abandon">Arrêter la partie</button>
        </div>
      </details>
      <details class="panel section" data-k="journal" ${ouvert("journal")}>
        <summary>Journal</summary>
        <div class="journal" style="margin-top:8px">
          ${S.log.slice().reverse().map((l) => `<div class="${l.secret ? "secret" : ""}"><span class="p">${esc(l.p)}</span>${l.secret ? "🤫 " : ""}${esc(l.txt)}</div>`).join("")}
        </div>
      </details>
    `;
  }

  // ---------- Chronomètre (débats, votes…) ----------

  const chrono = { duree: 0, debut: null, accumule: 0, sonne: false };
  const ecoule = () => chrono.accumule + (chrono.debut ? Date.now() - chrono.debut : 0);
  const format = (ms) => {
    const t = Math.ceil(Math.abs(ms) / 1000);
    return String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0");
  };
  function texteChrono() {
    if (!chrono.duree) return format(ecoule());
    const reste = chrono.duree - ecoule();
    return reste > 0 ? format(reste) : "Temps écoulé !";
  }
  function chronoHtml() {
    const fini = chrono.duree && ecoule() >= chrono.duree;
    return `<div class="chrono panel">
      <span id="chrono-val" class="chrono-val ${fini ? "fini" : ""}" aria-live="off">${texteChrono()}</span>
      <div class="chrono-boutons">
        ${[1, 2, 3, 5].map((m) => `<button class="small ${chrono.duree === m * 60000 ? "actif" : ""}" data-a="chrono" data-v="${m * 60}">${m} min</button>`).join("")}
        <button class="small ${chrono.duree === 0 && (chrono.debut || chrono.accumule) ? "actif" : ""}" data-a="chrono" data-v="libre" title="Chronomètre sans limite, qui compte vers le haut">⏱️ Libre</button>
        <button class="small" data-a="chrono" data-v="pause" aria-label="${chrono.debut ? "Pause" : "Démarrer"}">${chrono.debut ? "⏸" : "▶"}</button>
        <button class="small" data-a="chrono" data-v="zero" aria-label="Remettre à zéro">↺</button>
      </div>
    </div>`;
  }
  // Le son doit être « débloqué » pendant un appui (iPhone, Android) : on
  // prépare le contexte audio dès qu'on touche un bouton du chrono.
  let audio = null;
  function preparerSon() {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
      const b = audio.createBuffer(1, 1, 22050);
      const src = audio.createBufferSource();
      src.buffer = b;
      src.connect(audio.destination);
      src.start(0);
    } catch (e) { /* son indisponible */ }
  }
  function sonner() {
    try { navigator.vibrate && navigator.vibrate([300, 150, 300]); } catch (e) { /* rien */ }
    try {
      if (!audio) return;
      if (audio.state === "suspended") audio.resume();
      const ctx = audio;
      [0, 0.35, 0.7, 1.4, 1.75, 2.1].forEach((t) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.6, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
        o.connect(g).connect(ctx.destination);
        o.start(ctx.currentTime + t);
        o.stop(ctx.currentTime + t + 0.3);
      });
    } catch (e) { /* son indisponible */ }
  }
  function actionChrono(v) {
    preparerSon();
    if (v === "pause") {
      if (chrono.debut) { chrono.accumule = ecoule(); chrono.debut = null; }
      else chrono.debut = Date.now();
    } else if (v === "zero") {
      chrono.accumule = 0;
      chrono.debut = null;
      chrono.sonne = false;
    } else {
      chrono.duree = v === "libre" ? 0 : +v * 1000;
      chrono.accumule = 0;
      chrono.debut = Date.now();
      chrono.sonne = false;
    }
  }
  setInterval(() => {
    const el = document.getElementById("chrono-val");
    if (!chrono.debut) return;
    if (chrono.duree && ecoule() >= chrono.duree) {
      chrono.accumule = chrono.duree;
      chrono.debut = null;
      if (!chrono.sonne) { chrono.sonne = true; sonner(); }
      if (vue === "partie") render();
      return;
    }
    if (el) el.textContent = texteChrono();
  }, 250);

  function sauverPartie() {
    const S = Engine.etat();
    if (S) ecrire(CLE_PARTIE, S);
  }

  function repondre(v) {
    Engine.repondre(v);
    sauverPartie();
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---------- Révélation des rôles (téléphone passé de main en main) ----------

  function montrerRoles() {
    let i = 0;
    let visible = false;
    const fond = document.createElement("div");
    fond.className = "modal-fond";
    document.body.appendChild(fond);
    const dessiner = () => {
      if (i >= config.joueurs.length) {
        fond.innerHTML = `<div class="modal revelation"><p class="nomrole">Tout le monde a vu son rôle.</p><button class="primary" data-m="fermer">Fermer</button></div>`;
        return;
      }
      const d = config.distribution[i];
      const r = ROLE_BY_ID[d.role];
      const m = d.metier ? METIER_BY_ID[d.metier] : null;
      fond.innerHTML = `<div class="modal revelation">
        <p class="muted">Passez le téléphone à</p>
        <p class="nomrole">${esc(config.joueurs[i])}</p>
        ${visible ? `
          <div class="grosse">${visuelCarte(r.id, "revele")}</div>
          <p class="nomrole">${esc(r.nom)}</p>
          ${m ? `<p>Bâtiment : ${m.icone} ${esc(m.nom)}</p>` : ""}
          <p class="muted">${esc(r.effet)}</p>
          <button class="primary block" data-m="suivant">J'ai vu, cacher et passer →</button>` : `
          <button class="primary block" data-m="voir">👁️ Voir mon rôle</button>`}
        <p style="margin-top:14px"><button class="ghost small" data-m="fermer">Annuler</button></p>
      </div>`;
    };
    fond.addEventListener("click", (e) => {
      const b = e.target.closest("[data-m]");
      if (!b) return;
      const a = b.dataset.m;
      if (a === "voir") visible = true;
      else if (a === "suivant") { visible = false; i++; }
      else if (a === "fermer") { fond.remove(); return; }
      dessiner();
    });
    dessiner();
  }

  // Petite boîte de dialogue intégrée à la page (remplace confirm/prompt).
  function dialogue(question, opts, siOk) {
    const fond = document.createElement("div");
    fond.className = "modal-fond";
    fond.innerHTML = `<div class="modal">
      <p><strong>${esc(question)}</strong></p>
      ${opts.saisie ? `<input type="text" id="dialogue-saisie" placeholder="Ex. : carte Événement « Nuit sans lune »">` : ""}
      <div class="actions">
        <button data-d="annuler">Annuler</button>
        <button class="${opts.danger ? "danger" : "primary"}" data-d="ok">${esc(opts.ok || "OK")}</button>
      </div>
    </div>`;
    document.body.appendChild(fond);
    const champ = fond.querySelector("#dialogue-saisie");
    if (champ) champ.focus();
    const fermer = (ok) => {
      const v = champ ? champ.value.trim() : true;
      fond.remove();
      if (ok) siOk(v);
    };
    fond.addEventListener("click", (e) => {
      const b = e.target.closest("[data-d]");
      if (b) fermer(b.dataset.d === "ok");
      else if (e.target === fond) fermer(false);
    });
    if (champ) champ.addEventListener("keydown", (e) => { if (e.key === "Enter") fermer(true); });
  }

  // QR code que les joueurs scannent pour voir la liste des rôles (sans les noms).
  function montrerQrCompo() {
    const S = vue === "partie" && Engine.etat();
    const cartes = S ? S.players.map((p) => p.roleInitial).concat(S.horsJeuInitial || S.horsJeu) : paquet();
    const metiers = S ? S.players.map((p) => p.metier).filter(Boolean) : paquetMetiers();
    const lien = lienCompo(cartes, metiers);
    const fond = document.createElement("div");
    fond.className = "modal-fond";
    fond.innerHTML = `<div class="modal qr-modal">
      <p><strong>Composition de la partie</strong></p>
      <div class="qr">${qrSvg(lien)}</div>
      <p class="muted small">Les joueurs scannent ce code pour voir la liste des rôles (sans savoir qui a quoi).</p>
      <a class="small qr-lien" href="${esc(lien)}" target="_blank" rel="noopener">${esc(lien)}</a>
      <div class="actions"><button class="primary" data-d="ok">Fermer</button></div>
    </div>`;
    document.body.appendChild(fond);
    fond.addEventListener("click", (e) => {
      if (e.target === fond || e.target.closest("[data-d]")) fond.remove();
    });
  }

  function demarrer() {
    rolesReveles = false;
    const setup = {
      capitaine: config.capitaine,
      loupsEntreDevorer: config.loupsEntreDevorer,
      votesDetailles: config.votesDetailles,
      voteConfiance: config.voteConfiance,
      pesteNoire: config.pesteNoire,
      voleurVole: config.voleurVole,
      joueurs: config.joueurs.map((n, i) => ({
        nom: n.trim() || "Joueur " + (i + 1),
        role: config.distribution[i].role,
        metier: config.extensions.village && totalMetiers() ? config.distribution[i].metier || "vagabond" : null,
      })),
      horsJeu: cartesRestantes(),
    };
    Engine.nouvellePartie(setup);
    sauverPartie();
    vue = "partie";
    render();
    window.scrollTo(0, 0);
  }

  // ---------- Événements ----------

  app.addEventListener("toggle", (e) => {
    if (e.target.dataset && e.target.dataset.k) ouverts[e.target.dataset.k] = e.target.open;
  }, true);

  app.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.joueur !== undefined) {
      config.joueurs[+t.dataset.joueur] = t.value;
      sauverConfig();
    }
  });

  app.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.ext) {
      config.extensions[t.dataset.ext] = t.checked;
      sauverConfig();
      render();
    } else if (t.dataset.opt) {
      config[t.dataset.opt] = t.checked;
      sauverConfig();
    } else if (t.dataset.distribRole !== undefined) {
      config.distribution[+t.dataset.distribRole].role = t.value;
      sauverConfig();
      render();
    } else if (t.dataset.distribMetier !== undefined) {
      config.distribution[+t.dataset.distribMetier].metier = t.value;
      sauverConfig();
      render();
    }
  });

  app.addEventListener("click", (e) => {
    const b = e.target.closest("[data-a]");
    if (!b || b.disabled || b.tagName === "INPUT") return;
    const a = b.dataset.a;
    const i = +b.dataset.i;
    switch (a) {
      case "reprendre":
        Engine.charger(lire(CLE_PARTIE));
        vue = "partie";
        break;
      case "ajouter-joueur":
        config.joueurs.push("Joueur " + (nbJoueurs() + 1));
        break;
      case "suppr":
        config.joueurs.splice(i, 1);
        config.distribution.splice(i, 1);
        break;
      case "monter":
      case "descendre": {
        const j = a === "monter" ? i - 1 : i + 1;
        [config.joueurs[i], config.joueurs[j]] = [config.joueurs[j], config.joueurs[i]];
        if (config.distribution[i] && config.distribution[j]) [config.distribution[i], config.distribution[j]] = [config.distribution[j], config.distribution[i]];
        break;
      }
      case "vers-joueurs": vue = "joueurs"; break;
      case "vers-compo": vue = "compo"; break;
      case "vers-distrib": vue = "distrib"; break;
      case "compo-rapide": compoRapide(); break;
      case "compo-vide": config.compo = {}; config.metiers = {}; break;
      case "plus":
      case "moins": {
        const delta = a === "plus" ? 1 : -1;
        if (b.dataset.role) {
          const id = b.dataset.role;
          const r = ROLE_BY_ID[id];
          let v = (config.compo[id] || 0) + delta;
          if (id === "deux-soeurs") v = delta > 0 ? 2 : 0;
          if (id === "trois-freres") v = delta > 0 ? 3 : 0;
          if (r.max && v > r.max) v = r.max;
          config.compo[id] = Math.max(0, v);
        } else if (b.dataset.metier) {
          const id = b.dataset.metier;
          const m = METIER_BY_ID[id];
          let v = (config.metiers[id] || 0) + delta;
          if (m.max && v > m.max) v = m.max;
          config.metiers[id] = Math.max(0, v);
        }
        break;
      }
      case "hasard": distribuerHasard(); break;
      case "montrer": montrerRoles(); return;
      case "commencer": demarrer(); return;

      // Partie
      case "sel": {
        const id = +b.dataset.id;
        const inp = Engine.spec().input;
        if (selection.includes(id)) selection = selection.filter((x) => x !== id);
        else if (inp.max === 1) selection = [id];
        else if (selection.length < inp.max) selection.push(id);
        break;
      }
      case "opt": {
        const v = b.dataset.v;
        const sp = Engine.spec();
        const opts = (sp.input.options || sp.input.extra || []);
        const o = opts.find((x) => String(x.v) === v);
        repondre(o ? o.v : v);
        return;
      }
      case "valider": {
        const sp = Engine.spec();
        if (sp.input && sp.input.kind === "players") repondre(selection.slice());
        else if (sp.input && sp.input.kind === "text") repondre(document.getElementById("saisie-texte").value.trim());
        else if (sp.input && sp.input.kind === "votes") {
          const votes = {};
          app.querySelectorAll("[data-vote]").forEach((el) => { votes[el.dataset.vote] = el.value === "" ? "" : +el.value; });
          repondre(votes);
        }
        else repondre(null);
        return;
      }
      case "passer": repondre(null); return;
      case "chrono": actionChrono(b.dataset.v); break;
      case "qr-compo": montrerQrCompo(); return;
      case "voir-roles": rolesReveles = !rolesReveles; break;
      case "jeton-vote":
        Engine.basculerVote(+b.dataset.id);
        sauverPartie();
        break;
      case "annuler":
        Engine.annuler();
        sauverPartie();
        cleEtape = null;
        break;
      case "mort-manuelle":
      case "resurrection":
        Engine.intercaler({ t: a });
        sauverPartie();
        window.scrollTo({ top: 0, behavior: "smooth" });
        break;
      case "note":
        dialogue("Événement ou note à ajouter au journal", { saisie: true, ok: "Ajouter" }, (txt) => {
          if (!txt) return;
          Engine.noter(txt);
          sauverPartie();
          render();
        });
        return;
      case "abandon":
        dialogue("Arrêter la partie en cours ? Elle sera effacée.", { ok: "Arrêter la partie", danger: true }, () => {
          effacer(CLE_PARTIE);
          vue = "distrib";
          render();
        });
        return;
      case "nouvelle":
        effacer(CLE_PARTIE);
        vue = "distrib";
        break;
      default:
        return;
    }
    sauverConfig();
    render();
  });

  render();
})();
