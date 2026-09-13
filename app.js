/* =========================================================
   AIRBUS · España 2027 — app
   Login: 70326978 / Rudis95
   Solo: título, comodidades, fotos (carrusel) y ubicación (mapa)
   ========================================================= */
(function () {
  "use strict";

  const USER = "70326978";
  const PASS = "Rudis95";
  const FAV_KEY = "airbus_favs";
  const AUTH_KEY = "airbus_auth";

  /* ---------- utils ---------- */
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const img = (url, w) => url + (url.includes("?") ? "&" : "?") + "im_w=" + w;

  const state = {
    view: "grid",           // grid | map | favs | detail
    detailId: null,
    search: "",
    city: "",
    favs: new Set(JSON.parse(localStorage.getItem(FAV_KEY) || "[]")),
    hoverTimers: new WeakMap(),
    photoIdx: new WeakMap(),
    selSearch: "",
    sel: [],
  };

  /* ---------- data prep ---------- */
  const DATA = (typeof LISTINGS !== "undefined" ? LISTINGS : []).map((l, i) => {
    const [cityRaw] = (l.title || "").split(",");
    return Object.assign({}, l, {
      idx: i,
      capacity: l.capacity || 0,
      citySimple: (l.city || cityRaw || "").trim(),
      photos: (l.photos || []).slice(0, 40),
    });
  });
  const cities = [...new Set(DATA.map(l => l.citySimple).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));

  /* ---------- auth ---------- */
  function isAuthed() { return sessionStorage.getItem(AUTH_KEY) === "1"; }

  $("#login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const u = $("#login-user").value.trim();
    const p = $("#login-pass").value.trim();
    if (u === USER && p === PASS) {
      sessionStorage.setItem(AUTH_KEY, "1");
      $("#login-error").hidden = true;
      enterApp();
    } else {
      $("#login-error").hidden = false;
    }
  });

  $("#btn-logout").addEventListener("click", () => {
    sessionStorage.removeItem(AUTH_KEY);
    location.hash = "";
    $("#app").hidden = true;
    $("#login-screen").style.display = "flex";
    $("#login-pass").value = "";
  });

  function enterApp() {
    $("#login-screen").style.display = "none";
    $("#app").hidden = false;
    populateCities();
    route();
  }

  /* ---------- routing ---------- */
  window.addEventListener("hashchange", route);

  function route() {
    const m = location.hash.match(/^#\/detalle\/(.+)$/);
    if (m && isAuthed()) {
      showDetail(decodeURIComponent(m[1]));
    } else if (isAuthed()) {
      showView(state.view === "map" ? "map" : (state.view === "favs" ? "favs" : "grid"));
    }
  }

  function showView(v) {
    state.view = v;
    ["grid", "map", "favs", "seleccion", "detail"].forEach(id => {
      const el = $("#view-" + id);
      if (el) el.hidden = id !== v;
    });
    $$("#view-tabs .tab-btn").forEach(b => b.classList.toggle("active", b.dataset.view === v));
    $("#btn-seleccion").classList.toggle("active", v === "seleccion");
    $("#filters-bar").style.display = (v === "grid" || v === "favs") ? "" : "none";
    if (v === "grid" || v === "favs") renderCards(v === "favs");
    if (v === "map") renderGlobalMap();
    if (v === "seleccion") renderSeleccion();
    updateFavBadge();
    window.scrollTo(0, 0);
  }

  $$("#view-tabs .tab-btn").forEach(b => {
    b.addEventListener("click", () => {
      state.view = "grid";
      location.hash = "";
      showView(b.dataset.view);
    });
  });
  $("#btn-home").addEventListener("click", () => { state.view = "grid"; location.hash = ""; showView("grid"); });
  $("#btn-seleccion").addEventListener("click", () => { state.view = "seleccion"; location.hash = ""; showView("seleccion"); });
  $("#sel-search").addEventListener("input", (e) => { state.selSearch = e.target.value.toLowerCase().trim(); renderSeleccion(); });
  $("#sel-clear").addEventListener("click", () => { state.sel = []; renderSeleccion(); });
  $("#sel-send").addEventListener("click", sendSeleccion);
  $("#sel-copy").addEventListener("click", () => {
    const txt = seleccionText();
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).catch(() => {
      const ta = document.createElement("textarea");
      ta.value = txt; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove();
    });
    const b = $("#sel-copy"); b.textContent = "¡Copiado!";
    setTimeout(() => (b.textContent = "Copiar selección al portapapeles"), 2000);
  });

  /* ---------- favorites ---------- */
  function saveFavs() { localStorage.setItem(FAV_KEY, JSON.stringify([...state.favs])); updateFavBadge(); }
  function updateFavBadge() {
    const b = $("#fav-count-badge");
    b.textContent = state.favs.size || "";
    b.classList.toggle("hidden", state.favs.size === 0);
  }
  function toggleFav(id) {
    if (state.favs.has(id)) state.favs.delete(id); else state.favs.add(id);
    saveFavs();
    $$('.heart-btn[data-id="' + id + '"]').forEach(h => h.classList.toggle("faved", state.favs.has(id)));
    if (state.view === "favs") renderCards(true);
  }

  const HEART_SVG = '<svg viewBox="0 0 24 24"><path class="heart-path" d="M12 21s-7.5-4.9-9.7-9.2C.7 8.6 2.6 5 6.2 5c2 0 3.4 1 4.3 2.4h3C14.4 6 15.8 5 17.8 5c3.6 0 5.5 3.6 3.9 6.8C19.5 16.1 12 21 12 21z"/></svg>';

  /* ---------- filters ---------- */
  function populateCities() {
    const sel = $("#filter-city");
    if (sel.options.length > 1) return;
    cities.forEach(c => {
      const o = document.createElement("option");
      o.value = c; o.textContent = c;
      sel.appendChild(o);
    });
  }
  $("#filter-search").addEventListener("input", (e) => { state.search = e.target.value.toLowerCase().trim(); renderCards(); });
  $("#filter-city").addEventListener("change", (e) => { state.city = e.target.value; renderCards(); });

  function filtered() {
    let arr = DATA.filter(l => {
      if (state.view === "favs" && !state.favs.has(l.id)) return false;
      if (state.city && l.citySimple !== state.city) return false;
      if (state.search) {
        const hay = (l.title + " " + l.subtitle + " " + l.citySimple).toLowerCase();
        if (!hay.includes(state.search)) return false;
      }
      return true;
    });
    return arr;
  }

  /* ---------- cards ---------- */
  function renderCards(favsOnly) {
    const wrap = favsOnly ? $("#cards-favs") : $("#cards");
    const empty = favsOnly ? $("#empty-state-favs") : $("#empty-state");
    const arr = filtered();
    $("#results-count").textContent = arr.length + " apartamento" + (arr.length === 1 ? "" : "s");
    if (empty) empty.hidden = arr.length > 0;
    wrap.innerHTML = arr.map(cardHTML).join("");

    // hover carousels (estilo Booking) + flechas manuales
    $$(".card", wrap).forEach(card => {
      const imgs = $$(".card-photo img", card);
      if (imgs.length < 2) return;
      state.photoIdx.set(card, 0);
      card.addEventListener("mouseenter", () => {
        stopHover(card);
        const t = setInterval(() => {
          const cur = state.photoIdx.get(card) || 0;
          state.photoIdx.set(card, showPhoto(card, cur + 1));
        }, 1400);
        state.hoverTimers.set(card, t);
      });
      card.addEventListener("mouseleave", () => stopHover(card));
      $$(".cnav", card).forEach(b => b.addEventListener("click", (e) => {
        e.stopPropagation();
        const cur = state.photoIdx.get(card) || 0;
        state.photoIdx.set(card, showPhoto(card, cur + (b.dataset.dir === "1" ? 1 : -1)));
      }));
    });

    // hearts
    $$(".heart-btn", wrap).forEach(h => h.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFav(h.dataset.id);
    }));
    // click → detalle (misma pestaña)
    $$(".card", wrap).forEach(card => {
      card.addEventListener("click", (e) => {
        if (e.target.closest(".heart-btn") || e.target.closest(".cnav")) return;
        location.hash = "#/detalle/" + card.dataset.id;
      });
    });
  }
  function showPhoto(card, idx) {
    const imgs = $$(".card-photo img", card);
    const dots = $$(".dot", card);
    const n = imgs.length;
    const i = ((idx % n) + n) % n;
    imgs.forEach((im, ii) => (im.style.opacity = ii === i ? "1" : "0"));
    dots.forEach((d, di) => d.classList.toggle("on", di === i));
    return i;
  }
  function stopHover(card) {
    const t = state.hoverTimers.get(card);
    if (t) { clearInterval(t); state.hoverTimers.delete(card); }
    state.photoIdx.set(card, showPhoto(card, 0));
  }

  function cardHTML(l) {
    const photos = l.photos.slice(0, 8);
    return `
      <article class="card" data-id="${esc(l.id)}">
        <div class="card-photo">
          <button class="heart-btn ${state.favs.has(l.id) ? "faved" : ""}" data-id="${esc(l.id)}" title="Guardar en favoritos" aria-label="Guardar en favoritos">${HEART_SVG}</button>
          ${photos.map((p, i) => `<img src="${esc(img(p.url, 480))}" alt="${esc(l.title)}" loading="lazy" ${i > 0 ? 'style="position:absolute;inset:0;opacity:0"' : ""}>`).join("")}
          <div class="dots">${photos.map((_, i) => `<span class="dot ${i === 0 ? "on" : ""}"></span>`).join("")}</div>
          ${photos.length > 1 ? `<button class="cnav cnav-l" type="button" data-dir="-1" aria-label="Foto anterior">‹</button><button class="cnav cnav-r" type="button" data-dir="1" aria-label="Foto siguiente">›</button>` : ""}
        </div>
        <div class="card-body">
          <div class="card-title">${esc(l.subtitle || l.title)}</div>
          <div class="card-city">${esc(l.title || l.citySimple)}</div>
        </div>
      </article>`;
  }

  /* ---------- selección de apartamentos (máx. 5, por orden) ---------- */
  function seleccionText() {
    const lines = state.sel.map((id, i) => {
      const l = DATA.find(x => x.id === id);
      return (i + 1) + "º. " + (l.subtitle || l.title) + " — " + l.citySimple;
    });
    return "SELECCIÓN DE APARTAMENTOS (España 2027)\n\n" + lines.join("\n") +
      "\n\nTotal: " + state.sel.length + " apartamento" + (state.sel.length === 1 ? "" : "s") + ".";
  }
  function sendSeleccion() {
    if (!state.sel.length) return;
    $("#sel-sent").hidden = false;
  }
  function renderSeleccion() {
    $("#sel-sent").hidden = true;
    const arr = DATA.filter(l => {
      if (state.selSearch) {
        const hay = (l.title + " " + l.subtitle + " " + l.citySimple).toLowerCase();
        if (!hay.includes(state.selSearch)) return false;
      }
      return true;
    });
    $("#sel-count").textContent = arr.length + " apartamentos · elegidos: " + state.sel.length + " de 5";
    $("#sel-cards").innerHTML = arr.map(selCardHTML).join("");
    $$(".sel-card", $("#sel-cards")).forEach(card => {
      card.addEventListener("click", (e) => {
        if (e.target.closest(".sel-open")) return;
        toggleSel(card.dataset.id);
      });
      const open = card.querySelector(".sel-open");
      if (open) open.addEventListener("click", (e) => {
        e.stopPropagation();
        location.hash = "#/detalle/" + card.dataset.id;
      });
    });
    const chosen = $("#sel-chosen");
    chosen.innerHTML = state.sel.length
      ? state.sel.map((id, i) => {
          const l = DATA.find(x => x.id === id);
          return `<li class="sel-item">
            <span class="sel-num">${i + 1}</span>
            <span class="sel-item-name">${esc(l.subtitle || l.title)}<small>${esc(l.citySimple)}</small></span>
            <span class="sel-item-btns">
              <button class="sel-move" data-dir="-1" data-id="${esc(id)}" title="Subir" ${i === 0 ? "disabled" : ""}>↑</button>
              <button class="sel-move" data-dir="1" data-id="${esc(id)}" title="Bajar" ${i === state.sel.length - 1 ? "disabled" : ""}>↓</button>
              <button class="sel-move sel-del" data-id="${esc(id)}" title="Quitar">✕</button>
            </span>
          </li>`;
        }).join("")
      : `<li class="sel-empty">Todavía no has elegido ningún apartamento. Toca las tarjetas de la lista para añadirlos por orden de preferencia.</li>`;
    $$(".sel-move", chosen).forEach(b => b.addEventListener("click", () => {
      const id = b.dataset.id;
      const i = state.sel.indexOf(id);
      if (b.classList.contains("sel-del")) { state.sel.splice(i, 1); }
      else {
        const j = i + parseInt(b.dataset.dir, 10);
        [state.sel[i], state.sel[j]] = [state.sel[j], state.sel[i]];
      }
      renderSeleccion();
    }));
    $("#sel-full").hidden = state.sel.length < 5;
    $("#sel-send").disabled = state.sel.length === 0;
  }
  function toggleSel(id) {
    const i = state.sel.indexOf(id);
    if (i !== -1) state.sel.splice(i, 1);
    else if (state.sel.length < 5) state.sel.push(id);
    renderSeleccion();
  }
  function selCardHTML(l) {
    const chosen = state.sel.indexOf(l.id);
    return `
      <div class="sel-card ${chosen !== -1 ? "sel-card-on" : ""}" data-id="${esc(l.id)}">
        <img src="${esc(img(l.photos[0] ? l.photos[0].url : "", 240))}" alt="${esc(l.title)}" loading="lazy">
        <div class="sel-card-body">
          <div class="sel-card-title">${esc(l.subtitle || l.title)}</div>
          <div class="sel-card-city">${esc(l.citySimple)}</div>
        </div>
        <span class="sel-pick">${chosen !== -1 ? chosen + 1 + "º" : "＋"}</span>
        <button class="sel-open" title="Ver detalle">↗</button>
      </div>`;
  }

  /* ---------- detail ---------- */
  function showDetail(id) {
    const l = DATA.find(x => x.id === id);
    if (!l) { location.hash = ""; showView("grid"); return; }
    state.view = "detail";
    state.detailId = id;
    ["grid", "map", "favs"].forEach(v => { const el = $("#view-" + v); if (el) el.hidden = true; });
    $("#view-detail").hidden = false;
    $("#filters-bar").style.display = "none";
    const gal = l.photos.slice(0, 8);

    const amenIcons = {
      "wifi": "📶", "piscina": "🏊", "aire": "❄️", "cocina": "🍳", "lavadora": "🧺",
      "televis": "📺", "parking": "🅿️", "playa": "🏖️", "mascota": "🐾", "calefacc": "🔥",
      "secador": "💨", "nevera": "🧊", "microondas": "☢️", "jacuzzi": "🛁", "terraza": "☀️",
      "balcón": "🌇", "barbacoa": "🍖", "gimnasio": "🏋️", "habitación": "🚪",
      "bañ": "🛁", "agua": "🚿", "ropa": "👕", "detector": "🚨", "extintor": "🧯",
      "botiquín": "⛑️", "trona": "👶", "cuna": "👶", "ascensor": "🛗", "zona": "📍",
    };
    const amenHTML = l.amenities.map(a => {
      const low = a.toLowerCase();
      let ico = "✔️";
      for (const k in amenIcons) { if (low.includes(k)) { ico = amenIcons[k]; break; } }
      return `<div class="amenity"><span class="am-ico">${ico}</span><span>${esc(a)}</span></div>`;
    }).join("");

    $("#view-detail").innerHTML = `
      <div class="detail-wrap">
        <button class="back-btn" id="btn-back">← Volver a la lista</button>
        <div class="detail-head">
          <div>
            <h1 class="detail-title">${esc(l.subtitle || l.title)}</h1>
            <div class="detail-sub">${esc(l.title || "")} · ${esc(l.citySimple)}</div>
          </div>
          <div class="detail-head-right">
            <button class="heart-btn ${state.favs.has(l.id) ? "faved" : ""}" data-id="${esc(l.id)}" title="Guardar en favoritos" aria-label="Guardar en favoritos">${HEART_SVG}</button>
          </div>
        </div>

        <div class="gallery" id="gallery">
          ${gal.map((p, i) => `<img src="${esc(img(p.url, 720))}" data-idx="${i}" alt="${esc(l.title)} — foto ${i + 1}" loading="${i === 0 ? "eager" : "lazy"}">`).join("")}
        </div>

        <div class="detail-cols">
          <div>
            <div class="panel">
              <h2>Descripción</h2>
              <p class="desc-text">${esc(l.description)}</p>
            </div>
            <div class="panel">
              <h2>Comodidades (${l.amenities.length})</h2>
              <div class="amenities-grid">${amenHTML}</div>
            </div>
          </div>
          <div>
            <div class="panel">
              <h2>Ubicación</h2>
              <div class="detail-map" id="detail-map"></div>
              <p class="map-hint">📍 ${esc(l.citySimple)} — coordenadas exactas de la ubicación</p>
            </div>
          </div>
        </div>
      </div>`;

    $("#btn-back").addEventListener("click", () => { location.hash = ""; showView("grid"); });
    $$('.heart-btn[data-id="' + l.id + '"]').forEach(h =>
      h.addEventListener("click", () => toggleFav(l.id)));

    renderDetailMap(l);
    setupLightbox(l);
    window.scrollTo(0, 0);
  }

  /* ---------- maps ---------- */
  let detailMap = null, globalMap = null;
  const TILE = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
  const SAT_TILE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
  const SAT_OPTS = {
    maxZoom: 19,
    attribution: "Imágenes &copy; Esri, Maxar, Earthstar Geographics"
  };
  function addBaseLayers(map) {
    const base = {
      "Mapa": L.tileLayer(TILE, TILE_OPTS),
      "Satélite": L.tileLayer(SAT_TILE, SAT_OPTS)
    };
    base["Mapa"].addTo(map);
    L.control.layers(base, null, { position: "topright" }).addTo(map);
  }
  const TILE_OPTS = {
    subdomains: "abcd",
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
  };

  function renderDetailMap(l) {
    if (detailMap) { detailMap.remove(); detailMap = null; }
    detailMap = L.map("detail-map").setView([l.lat, l.lng], 15);
    addBaseLayers(detailMap);
    const mk = L.marker([l.lat, l.lng]).addTo(detailMap);
    mk.bindPopup("<b>" + esc(l.subtitle || l.title) + "</b><br>" + esc(l.citySimple));
    setTimeout(() => detailMap && detailMap.invalidateSize(), 60);
  }

  function renderGlobalMap() {
    if (globalMap) { setTimeout(() => globalMap && globalMap.invalidateSize(), 60); return; }
    globalMap = L.map("global-map");
    const bounds = [];
    addBaseLayers(globalMap);
    DATA.forEach(l => {
      if (!l.lat || !l.lng) return;
      bounds.push([l.lat, l.lng]);
      const m = L.marker([l.lat, l.lng]).addTo(globalMap);
      m.bindPopup(`
        <div style="min-width:190px">
          <img src="${esc(img(l.photos[0] ? l.photos[0].url : "", 240))}" style="width:100%;height:120px;object-fit:cover;border-radius:8px" alt="">
          <div style="font-weight:700;margin:6px 0 2px">${esc(l.subtitle || l.title)}</div>
          <div style="color:#5b6472;font-size:12px;margin-bottom:8px">${esc(l.citySimple)}</div>
          <a href="#/detalle/${esc(l.id)}" onclick="document.querySelector('.leaflet-popup-close-button').click()" style="color:#005192;font-weight:700">Ver detalle →</a>
        </div>`);
    });
    if (bounds.length) globalMap.fitBounds(bounds, { padding: [30, 30] });
    setTimeout(() => globalMap && globalMap.invalidateSize(), 60);
  }

  /* ---------- lightbox ---------- */
  let lbIdx = 0, lbList = [];
  function setupLightbox(l) {
    lbList = l.photos.map(p => ({ url: img(p.url, 1440), cap: p.caption }));
    $("#gallery").addEventListener("click", (e) => {
      const t = e.target.closest("img");
      if (!t) return;
      lbIdx = parseInt(t.dataset.idx, 10) || 0;
      openLightbox();
    });
  }
  function openLightbox() {
    let lb = $("#lightbox");
    if (!lb) {
      lb = document.createElement("div");
      lb.id = "lightbox";
      lb.className = "lightbox";
      lb.innerHTML = `
        <button class="lb-close" title="Cerrar (Esc)">✕</button>
        <button class="lb-prev" title="Anterior">‹</button>
        <img src="" alt="">
        <div class="lb-cap"></div>
        <div class="lb-counter"></div>
        <button class="lb-next" title="Siguiente">›</button>`;
      document.body.appendChild(lb);
      $(".lb-close", lb).addEventListener("click", () => lb.classList.remove("open"));
      $(".lb-prev", lb).addEventListener("click", () => { lbIdx = (lbIdx - 1 + lbList.length) % lbList.length; paintLb(); });
      $(".lb-next", lb).addEventListener("click", () => { lbIdx = (lbIdx + 1) % lbList.length; paintLb(); });
      lb.addEventListener("click", (e) => { if (e.target === lb) lb.classList.remove("open"); });
      document.addEventListener("keydown", (e) => {
        if (!lb.classList.contains("open")) return;
        if (e.key === "Escape") lb.classList.remove("open");
        if (e.key === "ArrowLeft") $(".lb-prev", lb).click();
        if (e.key === "ArrowRight") $(".lb-next", lb).click();
      });
    }
    paintLb();
    lb.classList.add("open");
    function paintLb() {
      const it = lbList[lbIdx] || {};
      $("img", lb).src = it.url || "";
      $(".lb-cap", lb).textContent = it.cap || "";
      $(".lb-counter", lb).textContent = (lbIdx + 1) + " / " + lbList.length;
    }
  }

  /* ---------- init ---------- */
  if (isAuthed()) enterApp();
  else $("#login-screen").style.display = "flex";
})();
