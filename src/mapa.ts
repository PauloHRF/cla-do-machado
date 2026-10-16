import L from "leaflet";
import { cidades, pontos, TIPOS, CATEGORIAS, locais, type Local, type Tipo } from "./data";
import { pin, disco } from "./icons";
import { esc, md, setTab, openTab, hideTab, openEvents, closeEvents, panelWidth, showCoords, toast, loreButtons, isMobile } from "./ui";

const BOUNDS: L.LatLngBoundsExpression = [[0, 0], [2864, 2188]];

const CAMPOS: [string, keyof import("./data").Cidade][] = [
  ["Governo", "governo"], ["População", "populacao"], ["Clima", "clima"],
  ["Economia", "economia"], ["Religião", "religiao"], ["Religiões", "religiao"], ["Estabelecimentos", "estabelecimentos"],
];

export function fichaCidade(c: import("./data").Cidade) {
  const linhas = CAMPOS.filter(([r]) => r !== "Religiões")
    .filter(([, k]) => c[k])
    .map(([r, k]) => `<dt>${r}</dt><dd>${esc(String(c[k]))}</dd>`)
    .join("");
  return linhas ? `<dl class="ficha">${linhas}</dl>` : "";
}

function detalheHtml(l: Local) {
  if (l.kind === "cidade") {
    const tag = `<span class="tag" style="--c:${TIPOS[l.tipo].cor}">${TIPOS[l.tipo].nome}</span>`;
    const dom = l.dominio ? `<span class="tag ghost">Domínio: ${esc(l.dominio)}</span>` : "";
    const ficha = fichaCidade(l);
    const vazio = !ficha && !l.texto ? `<p class="muted">Ainda não há informações sobre este lugar.</p>` : "";
    return `<h1>${esc(l.nome)}</h1><p class="tags">${tag}${dom}</p>${ficha}<div class="prose">${md(l.texto)}</div>${vazio}
      <div class="actions">
        ${l.pagina ? `<a class="btn primary" href="#/cidade/${l.pagina}"><i class="fa-solid fa-map"></i> Mapa da cidade</a>` : ""}
        ${l.link ? `<a class="btn" href="${esc(l.link)}" target="_blank" rel="noopener"><i class="fa-solid fa-image"></i> Mapa</a>` : ""}
        ${l.eventos?.length ? `<button class="btn" data-act="eventos"><i class="fa-solid fa-timeline"></i> Eventos</button>` : ""}
        <button class="btn" data-act="copiar"><i class="fa-solid fa-link"></i> Copiar link</button>
      </div>`;
  }
  const cat = CATEGORIAS[l.categoria]?.nome ?? "";
  return `<h1>${esc(l.nome)}</h1><p class="tags"><span class="tag ghost">${esc(cat)}</span></p>
    <div class="prose">${md(l.descricao.replace(/^<b>[^<]+<\/b>(<br\s*\/?>)?/, ""))}</div>
    <div class="actions">
      ${l.link ? `<a class="btn" href="${esc(l.link)}" target="_blank" rel="noopener"><i class="fa-solid fa-image"></i> Mapa</a>` : ""}
      ${l.eventos?.length ? `<button class="btn" data-act="eventos"><i class="fa-solid fa-timeline"></i> Eventos</button>` : ""}
      <button class="btn" data-act="copiar"><i class="fa-solid fa-link"></i> Copiar link</button>
    </div>`;
}

export function mountMapa() {
  const map = L.map("map", {
    crs: L.CRS.Simple, minZoom: -2, maxZoom: 2, zoomSnap: 0.25, zoomDelta: 0.5,
    zoomControl: false, attributionControl: false,
    maxBounds: [[-400, -400], [3264, 2588]], maxBoundsViscosity: 0.6,
  });
  L.imageOverlay("/img/mapadomundo.webp", BOUNDS, { interactive: false }).addTo(map);
  L.control.zoom({ position: "topright", zoomInTitle: "Aproximar", zoomOutTitle: "Afastar" }).addTo(map);
  map.setView([2270.5, 824], isMobile() ? 0 : 1);
  if (!isMobile() && !location.hash.includes("local")) map.panBy([-230, 0], { animate: false });
  showCoords(map);
  document.querySelector<HTMLElement>('#rail [data-tab="filtros"]')!.title = "Filtros";

  // ----- camadas -----
  const camadas: Record<string, L.Layer> = {};
  const marcadores = new Map<string, L.Marker>();
  const tooltip = (m: L.Marker, nome: string) => m.bindTooltip(esc(nome), { direction: "top", className: "tip", opacity: 1 });

  for (const t of Object.keys(TIPOS) as Tipo[]) {
    const g = L.layerGroup();
    for (const c of cidades.filter((x) => x.tipo === t)) {
      const m = L.marker([c.y, c.x], { icon: pin(t), alt: c.nome, riseOnHover: true }).addTo(g);
      tooltip(m, c.nome).on("click", () => (location.hash = `#/local/${c.slug}`));
      marcadores.set(c.slug, m);
    }
    camadas[t] = g;
  }
  const usadas = [...new Set(pontos.map((p) => p.categoria))];
  for (const cat of usadas) {
    const g = L.layerGroup();
    for (const p of pontos.filter((x) => x.categoria === cat)) {
      const m = L.marker([p.y, p.x], { icon: disco(p.icone || CATEGORIAS[cat]?.icone || "location-dot", p.cor, 28), alt: p.nome }).addTo(g);
      tooltip(m, p.nome).on("click", () => (location.hash = `#/local/${p.slug}`));
      marcadores.set(p.slug, m);
    }
    camadas[cat] = g;
  }
  camadas.alcance = L.imageOverlay("/img/mapa-de-atuacao.webp", BOUNDS, { opacity: 0.5, interactive: false });
  camadas.dominios = L.imageOverlay("/img/mapadedominios.webp", BOUNDS, { opacity: 1, interactive: false });

  const ligadas: Record<string, boolean> = { estado: true, grande: true, media: true, pequena: true };
  const toggle = (id: string, on: boolean) => (on ? camadas[id].addTo(map) : camadas[id].remove());
  Object.keys(camadas).forEach((id) => toggle(id, !!ligadas[id]));

  // ----- painel: início -----
  const inicio = document.createElement("section");
  inicio.innerHTML = `
    <h1>Phantyr</h1>
    <p>Phantyr é um cenário de fantasia medieval clássico, que engloba monstros e magias, política e religião, mistérios e aventuras. Use-o em campanhas de aventureiros corajosos, ávidos para enfrentar o mais poderoso dragão, ou em histórias de intriga, suspense e traição.</p>
    <p>Acompanhe o desenvolvimento de Phantyr pelos canais do Gruntar.</p>`;
  inicio.append(loreButtons());
  setTab("inicio", inicio);

  // ----- painel: filtros -----
  const filtros = document.createElement("section");
  const linha = (id: string, rotulo: string, icone: string) =>
    `<label class="check"><input type="checkbox" data-camada="${id}" ${ligadas[id] ? "checked" : ""}><span class="box"></span>${icone}<span>${rotulo}</span></label>`;
  filtros.innerHTML = `
    <h2 class="ribbon">Cidades</h2>
    ${(Object.keys(TIPOS) as Tipo[]).map((t) => linha(t, TIPOS[t].nome, `<svg class="mini" viewBox="0 0 25 35"><path d="M12.5 1C6.2 1 1 6 1 12.2 1 20.6 12.5 34 12.5 34S24 20.6 24 12.2C24 6 18.8 1 12.5 1Z" fill="${TIPOS[t].cor}" stroke="#fff" stroke-width="1.6"/></svg>`)).join("")}
    <h2 class="ribbon">Ícones</h2>
    ${usadas.map((c) => linha(c, CATEGORIAS[c]?.nome ?? c, `<i class="fa-solid fa-${CATEGORIAS[c]?.icone ?? "location-dot"} mini"></i>`)).join("")}
    <h2 class="ribbon">Mapas</h2>
    ${linha("alcance", "Alcance do Clã", `<i class="fa-solid fa-bullseye mini"></i>`)}
    ${linha("dominios", "Domínios", `<i class="fa-solid fa-flag mini"></i>`)}
    <p class="muted dica">Dica: segure <kbd>Shift</kbd> e clique no mapa para copiar as coordenadas (úteis ao cadastrar um local).</p>`;
  filtros.addEventListener("change", (e) => {
    const i = e.target as HTMLInputElement;
    toggle(i.dataset.camada!, i.checked);
  });
  setTab("filtros", filtros);

  // ----- seleção -----
  let atual: Local | null = null;
  let marcado: L.Marker | null = null;
  const detalhe = document.createElement("section");
  detalhe.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-act]");
    if (!b || !atual) return;
    if (b.dataset.act === "eventos" && atual.eventos) openEvents(atual.nome, atual.eventos);
    if (b.dataset.act === "copiar")
      navigator.clipboard?.writeText(`${location.origin}/#/local/${atual.slug}`).then(() => toast("Link copiado"));
  });

  function selecionar(slug: string | null) {
    marcado?.getElement()?.classList.remove("sel");
    closeEvents();
    const l = slug ? locais.get(slug) : undefined;
    if (!l) { atual = null; hideTab("detalhe"); return; }
    atual = l;
    detalhe.innerHTML = detalheHtml(l);
    setTab("detalhe", detalhe);
    openTab("detalhe");
    document.title = `${l.nome} — Clã do Machado`;
    // garante que a camada do local esteja visível
    const camada = l.kind === "cidade" ? l.tipo : l.categoria;
    if (!ligadas[camada]) {
      ligadas[camada] = true;
      toggle(camada, true);
      (filtros.querySelector(`[data-camada="${camada}"]`) as HTMLInputElement).checked = true;
    }
    marcado = marcadores.get(l.slug) ?? null;
    marcado?.getElement()?.classList.add("sel");
    const alvo = L.latLngBounds([l.y, l.x], [l.y, l.x]);
    map.fitBounds(alvo, { maxZoom: 1, paddingTopLeft: [panelWidth(), 0], paddingBottomRight: [0, isMobile() ? window.innerHeight * 0.5 : 0] });
  }

  return {
    selecionar,
    destroy() {
      map.remove();
      ["inicio", "filtros", "detalhe"].forEach(hideTab);
      document.title = "Clã do Machado — Mapa de Phantyr";
    },
  };
}
