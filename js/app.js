// Interface : préparation de la partie (nombre de joueurs, composition)
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
      nbJoueurs: 8,
      compo: {},
      metiers: {},
      extensions: { base: true, "nouvelle-lune": true, village: true, personnages: true },
      capitaine: true,
    },
    lire(CLE_CONFIG) || {}
  );
  const sauverConfig = () => ecrire(CLE_CONFIG, config);

  let vue = "compo";
  let selection = [];
  let cleEtape = null;
  // Sections repliables de l'écran de partie restant ouvertes entre deux rendus.
  const ouverts = { joueurs: true, outils: false, journal: false };
  const ouvert = (k) => (ouverts[k] ? "open" : "");

  const partieSauvee = lire(CLE_PARTIE);
  if (partieSauvee && partieSauvee.players && partieSauvee.phase !== "fin") {
    Engine.charger(partieSauvee);
    vue = "partie";
  }

  // ---------- Calculs de composition ----------

  const extensionsActives = () => Object.keys(EXTENSIONS).filter((e) => config.extensions[e]);
  const rolesVisibles = () => ROLES_JOUABLES.filter((r) => config.extensions[r.ext]);
  const totalCompo = () => Object.entries(config.compo).reduce((s, [id, n]) => s + (ROLE_BY_ID[id] && config.extensions[ROLE_BY_ID[id].ext] ? n : 0), 0);
  const nbJoueurs = () => config.nbJoueurs;

  function cartesSupplementaires() {
    let n = 0;
    if (config.compo.voleur && config.extensions.base) n += 2;
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
    if (loups === 0 && !config.compo["loup-blanc"]) w.push("Aucun Loup-Garou dans la composition.");
    if (config.compo["deux-soeurs"] && config.compo["deux-soeurs"] !== 2) w.push("Il faut exactement 2 Sœurs.");
    if (config.compo["trois-freres"] && config.compo["trois-freres"] !== 3) w.push("Il faut exactement 3 Frères.");
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
  // ---------- Rendu ----------

  function render() {
    if (vue === "partie") renderPartie();
    else renderCompo();
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
    const reprise = lire(CLE_PARTIE);
    app.innerHTML = `
      ${reprise && reprise.phase !== "fin" ? `<div class="panel row"><span class="grow">Une partie est en cours.</span><button class="primary" data-a="reprendre">Reprendre</button></div>` : ""}
      <div class="panel">
        <h2 style="margin-top:0">Nombre de joueurs</h2>
        <div class="row">
          <div class="compteur">
            <button data-a="nb-moins" ${nbJoueurs() <= 3 ? "disabled" : ""} aria-label="Un joueur de moins">−</button>
            <span class="val gros">${nbJoueurs()}</span>
            <button data-a="nb-plus" aria-label="Un joueur de plus">＋</button>
          </div>
          <span class="muted small grow">Distribuez les cartes physiques : l'appli désigne chaque joueur par sa carte (« Loup-Garou 2 », « Voyante »…).</span>
        </div>
      </div>
      <div class="panel">
        <h2 style="margin-top:0">Extensions</h2>
        ${Object.entries(EXTENSIONS).map(([id, e]) => `
          <label class="check"><input type="checkbox" data-ext="${id}" ${config.extensions[id] ? "checked" : ""}> ${esc(e.nom)}</label>`).join("")}
        <label class="check"><input type="checkbox" data-a="capitaine" ${config.capitaine ? "checked" : ""}> Élire un Capitaine le premier jour</label>
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
      <div class="bilan">
        <strong>${total} carte${total > 1 ? "s" : ""}</strong>
        <span class="muted">pour ${nbJoueurs()} joueurs${cartesSupplementaires() ? " (+" + cartesSupplementaires() + " hors-jeu)" : ""}</span>
        <span class="grow small ${w.length ? "ko" : "ok"}">${w.length ? esc(w.join(" ")) : "✓ Composition complète"}</span>
        <button class="primary" data-a="commencer" ${total < nbJoueurs() ? "disabled" : ""}>🌙 Commencer</button>
      </div>
    `;
  }

  // ---------- Partie ----------

  function badges(p, S) {
    const b = [];
    if (S.mem.capitaine === p.id) b.push("👑");
    if (S.mem.couple && S.mem.couple.includes(p.id)) b.push("❤️");
    if (S.mem.charmes.includes(p.id)) b.push("🎶");
    if (S.phase === "nuit" && S.night && S.night.protege === p.id) b.push("🛡️");
    if (p.camp === "loups" && ROLE_BY_ID[p.role] && ROLE_BY_ID[p.role].camp !== "loups") b.push("🐺");
    if (p.metier) b.push(METIER_BY_ID[p.metier].icone);
    if (S.mem.corbeau === p.id) b.push("🐦‍⬛");
    return b.join(" ");
  }

  function renderPartie() {
    const S = Engine.etat();
    if (!S) { vue = "compo"; render(); return; }
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
            <span class="txt"><span>${esc(p.nom)} ${badges(p, S)}</span>${p.role !== p.roleInitial ? `<span class="r">→ ${esc(Engine.roleNom(p.role))}</span>` : ""}</span>
          </button>`).join("")}</div>`;
        if (inp.extra) saisie += `<div class="choix-options">${inp.extra.map((o) => `<button data-a="opt" data-v="${esc(o.v)}">${esc(o.label)}</button>`).join("")}</div>`;
        peutValider = selection.length >= inp.min && selection.length <= inp.max;
        if (inp.max > 1) saisie = `<p class="muted small">Sélectionnez ${inp.min === inp.max ? inp.min : "de " + inp.min + " à " + inp.max} joueur(s). (${selection.length} choisi(s))</p>` + saisie;
      } else if (inp && inp.kind === "choice") {
        saisie = `<div class="choix-options">${inp.options.map((o) => `<button data-a="opt" data-v="${esc(o.v)}" class="${o.primary ? "primary" : ""}">${esc(o.label)}</button>`).join("")}</div>`;
      } else if (inp && inp.kind === "text") {
        saisie = `<input type="text" id="saisie-texte" placeholder="${esc(inp.placeholder || "")}">`;
      }
      const boutonValider = sp.fin
        ? `<button class="primary" data-a="nouvelle">🔁 Nouvelle partie</button>`
        : inp && inp.kind === "choice"
          ? ""
          : `<button class="primary" data-a="valider" ${peutValider ? "" : "disabled"}>${inp && inp.kind === "players" ? "Valider" : "Continuer"} →</button>`;
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
      ${corps}
      <details class="panel section" data-k="joueurs" ${ouvert("joueurs")}>
        <summary>Joueurs</summary>
        <div class="joueurs-partie" style="margin-top:8px">
          ${S.players.map((p) => `
            <div class="jp ${p.alive ? "" : "mort"}">
              ${visuelCarte(p.role, "ico")}
              <span class="n">${esc(p.nom)}</span>
              <span class="r">${p.role !== p.roleInitial ? "→ " + esc(Engine.roleNom(p.role)) : ""}${p.alive ? "" : " — " + esc(p.mort.quand)}</span>
              <span class="badges">${badges(p, S)}</span>
            </div>`).join("")}
        </div>
        <p class="muted small">👑 Capitaine · ❤️ Amoureux · 🎶 Charmé · 🛡️ Protégé · 🐺 Devenu loup · 🐦‍⬛ Accusé par le Corbeau</p>
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

  function demarrer() {
    Engine.nouvellePartie({
      capitaine: config.capitaine,
      nbJoueurs: nbJoueurs(),
      joueurs: paquet().map((role) => ({ role })),
      horsJeu: [],
    });
    sauverPartie();
    vue = "partie";
    render();
    window.scrollTo(0, 0);
  }

  // ---------- Événements ----------

  app.addEventListener("toggle", (e) => {
    if (e.target.dataset && e.target.dataset.k) ouverts[e.target.dataset.k] = e.target.open;
  }, true);

  app.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.ext) {
      config.extensions[t.dataset.ext] = t.checked;
      sauverConfig();
      render();
    } else if (t.dataset.a === "capitaine") {
      config.capitaine = t.checked;
      sauverConfig();
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
      case "nb-plus": config.nbJoueurs = Math.min(40, nbJoueurs() + 1); break;
      case "nb-moins": config.nbJoueurs = Math.max(3, nbJoueurs() - 1); break;
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
        }
        break;
      }
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
        else repondre(null);
        return;
      }
      case "passer": repondre(null); return;
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
          vue = "compo";
          render();
        });
        return;
      case "nouvelle":
        effacer(CLE_PARTIE);
        vue = "compo";
        break;
      default:
        return;
    }
    sauverConfig();
    render();
  });

  render();
})();
