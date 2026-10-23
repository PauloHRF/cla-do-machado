import L from "leaflet";
import { asset, cidades, pontos, TIPOS, CATEGORIAS, CATEGORIAS_COMUNIDADE, locais, simboloTipo, simboloCategoria, type Local, type Tipo } from "./data";
import { simbolo, htmlSimbolo, disco } from "./icons";
import { camadaDominios, dominioDe } from "./dominios";
import { montarViagem, camadaTerreno, camadaEstradas } from "./viagemui";
import { hexDe, rotulo, centroTopo, verticesTopo, HEX_COLUNAS, HEX_LINHAS, HEX_LADO, MAPA_ALTURA } from "./hex";
import { esc, md, setTab, openTab, hideTab, openEvents, closeEvents, panelWidth, showCoords, toast, loreButtons, isMobile } from "./ui";

// Formulário de contribuições (Google Forms).
const FORM_CONTRIBUICAO = "https://docs.google.com/forms/d/e/1FAIpQLScDq7qH77lk4I6lwNW2wzyADpi5Il3siH3i_UqCB7jpfem08w/viewform";

const BOUNDS: L.LatLngBoundsExpression = [[0, 0], [1697, 2000]];

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
    const dm = dominioDe(l.x, l.y);
    const dom = dm ? `<span class="tag ghost">Região: ${esc(dm.nome)}</span>` : "";
    const hx = hexDe(l.x, l.y);
    const hexTag = hx ? `<span class="tag ghost">Hex ${rotulo(hx)}</span>` : "";
    const ficha = fichaCidade(l);
    const vazio = !ficha && !l.texto ? `<p class="muted">Ainda não há informações sobre este lugar.</p>` : "";
    return `<h1>${esc(l.nome)}</h1><p class="tags">${tag}${dom}${hexTag}</p>${ficha}<div class="prose">${md(l.texto)}</div>${vazio}
      <div class="actions">
        ${l.pagina ? `<a class="btn primary" href="#/cidade/${l.pagina}"><i class="fa-solid fa-map"></i> Mapa da cidade</a>` : ""}
        ${l.link ? `<a class="btn" href="${esc(l.link)}" target="_blank" rel="noopener"><i class="fa-solid fa-image"></i> Mapa</a>` : ""}
        ${l.eventos?.length ? `<button class="btn" data-act="eventos"><i class="fa-solid fa-timeline"></i> Eventos</button>` : ""}
        <button class="btn" data-act="copiar"><i class="fa-solid fa-link"></i> Copiar link</button>
      </div>`;
  }
  const cat = CATEGORIAS[l.categoria]?.nome ?? "";
  const hp = hexDe(l.x, l.y);
  const dp = dominioDe(l.x, l.y);
  return `<h1>${esc(l.nome)}</h1><p class="tags"><span class="tag ghost">${esc(cat)}</span>${dp ? `<span class="tag ghost">Região: ${esc(dp.nome)}</span>` : ""}${hp ? `<span class="tag ghost">Hex ${rotulo(hp)}</span>` : ""}</p>
    <div class="prose">${md(l.descricao.replace(/^<b>[^<]+<\/b>(<br\s*\/?>)?/, ""))}</div>
    ${l.descricao ? "" : `<p class="muted">Ainda não há informações sobre este lugar.</p>`}
    <div class="actions">
      ${l.link ? `<a class="btn" href="${esc(l.link)}" target="_blank" rel="noopener"><i class="fa-solid fa-image"></i> Mapa</a>` : ""}
      ${l.eventos?.length ? `<button class="btn" data-act="eventos"><i class="fa-solid fa-timeline"></i> Eventos</button>` : ""}
      <button class="btn" data-act="copiar"><i class="fa-solid fa-link"></i> Copiar link</button>
    </div>`;
}

// Grade de hexágonos desenhada em canvas, um ladrilho por vez; mostra a coordenada (C·L) no zoom máximo.
function gradeHex() {
  const Grade = L.GridLayer.extend({
    createTile(this: L.GridLayer, coords: L.Coords) {
      const t = this.getTileSize(), tile = L.DomUtil.create("canvas", "grade-hex") as HTMLCanvasElement;
      const dpr = window.devicePixelRatio || 1;
      tile.width = t.x * dpr; tile.height = t.y * dpr;
      const ctx = tile.getContext("2d")!;
      ctx.scale(dpr, dpr);
      const esc = 2 ** coords.z;                       // pixels por unidade do mapa
      const nw = (this as unknown as { _map: L.Map })._map.unproject(coords.scaleBy(t), coords.z);
      const x0 = nw.lng, y0 = MAPA_ALTURA - nw.lat;    // canto superior esquerdo do ladrilho (y a partir do topo)
      const larg = t.x / esc, alt = t.y / esc;
      const cMin = Math.max(1, Math.floor((x0 - centroTopo(1, 1)[0]) / (1.5 * HEX_LADO)) - 1);
      const cMax = Math.min(HEX_COLUNAS, Math.ceil((x0 + larg - centroTopo(1, 1)[0]) / (1.5 * HEX_LADO)) + 2);
      ctx.beginPath(); ctx.rect((0 - x0) * esc, (0 - y0) * esc, 2000 * esc, MAPA_ALTURA * esc); ctx.clip(); // só dentro da arte
      ctx.strokeStyle = "rgba(255,255,255,0.42)"; ctx.lineWidth = coords.z >= 1 ? 1.3 : 1;
      ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "700 11px sans-serif";
      ctx.shadowColor = "rgba(0,0,0,0.85)";
      for (let c = cMin; c <= cMax; c++) {
        for (let l = 1; l <= HEX_LINHAS; l++) {
          const [cx, cy] = centroTopo(c, l);
          if (cx < x0 - HEX_LADO || cx > x0 + larg + HEX_LADO || cy < y0 - HEX_LADO || cy > y0 + alt + HEX_LADO) continue;
          ctx.beginPath();
          verticesTopo(c, l).forEach(([vx, vy], i) => {
            const px = (vx - x0) * esc, py = (vy - y0) * esc;
            if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
          });
          ctx.closePath(); ctx.stroke();
          if (coords.z >= 2) { ctx.shadowBlur = 3; ctx.fillText(`${String(c).padStart(2, "0")}·${String(l).padStart(2, "0")}`, (cx - x0) * esc, (cy - y0) * esc); ctx.shadowBlur = 0; }
        }
      }
      return tile;
    },
  });
  return new (Grade as unknown as new (o: L.GridLayerOptions) => L.GridLayer)({ tileSize: 256, minZoom: -2, maxZoom: 2, zIndex: 3 });
}

export function mountMapa() {
  const map = L.map("map", {
    crs: L.CRS.Simple, minZoom: -2, maxZoom: 2, zoomSnap: 0.25, zoomDelta: 0.5,
    zoomControl: false, attributionControl: false,
    maxBounds: [[-1200, -1200], [2897, 3200]], maxBoundsViscosity: 0.4,
  });
  // mapa em ladrilhos (scripts/gerar-tiles.mjs). Em CRS.Simple a linha 0 do Leaflet fica acima de lat 0 e as de baixo
  // são negativas; os arquivos contam de baixo para cima a partir de 0, então y_arquivo = -y - 1.
  const ladrilhos = L.tileLayer(asset("/img/mapa/{z}/{x}/{y}.webp"), {
    tileSize: 256, bounds: BOUNDS, noWrap: true, minZoom: -2, maxZoom: 2, minNativeZoom: -2, maxNativeZoom: 2, keepBuffer: 4,
  });
  const urlOriginal = ladrilhos.getTileUrl.bind(ladrilhos);
  ladrilhos.getTileUrl = (c) => urlOriginal({ x: c.x, y: -c.y - 1, z: c.z } as unknown as L.Coords);
  ladrilhos.addTo(map);
  L.control.zoom({ position: "topright", zoomInTitle: "Aproximar", zoomOutTitle: "Afastar" }).addTo(map);
  map.setView([869, 1255], isMobile() ? 0 : 1);
  if (!isMobile() && !location.hash.includes("local")) map.panBy([-230, 0], { animate: false });
  showCoords(map);
  
  const viagem = montarViagem(map, panelWidth);

  // ----- camadas -----
  const camadas: Record<string, L.Layer> = {};
  const marcadores = new Map<string, L.Marker>();
  const tooltip = (m: L.Marker, nome: string) => m.bindTooltip(esc(nome), { direction: "top", className: "tip", opacity: 1 });

  for (const t of Object.keys(TIPOS) as Tipo[]) {
    const g = L.layerGroup();
    for (const c of cidades.filter((x) => x.tipo === t && !x.oculto)) {
      const m = L.marker([c.y, c.x], { icon: simbolo(simboloTipo(t)), alt: c.nome, riseOnHover: true }).addTo(g);
      tooltip(m, c.nome).on("click", () => { if (!viagem.capturar(c.y, c.x, c.nome)) location.hash = `#/local/${c.slug}`; });
      marcadores.set(c.slug, m);
    }
    camadas[t] = g;
  }
  for (const cat of Object.keys(CATEGORIAS)) {
    const g = L.layerGroup();
    const sim = simboloCategoria(cat);   // marcos oficiais usam o símbolo da legenda; contribuições, um disco com ícone
    for (const p of pontos.filter((x) => x.categoria === cat && !x.oculto)) {
      const m = L.marker([p.y, p.x], { icon: sim ? simbolo(sim) : disco(p.icone || CATEGORIAS[cat].icone, p.cor || CATEGORIAS[cat].cor, 28), alt: p.nome }).addTo(g);
      tooltip(m, p.nome).on("click", () => { if (!viagem.capturar(p.y, p.x, p.nome)) location.hash = `#/local/${p.slug}`; });
      marcadores.set(p.slug, m);
    }
    camadas[cat] = g;
  }
  camadas.hex = gradeHex();
  camadas.terreno = camadaTerreno();
  camadas.estradas = camadaEstradas();
  camadas.alcance = L.imageOverlay(asset("/img/mapa-de-atuacao.webp"), BOUNDS, { opacity: 0.5, interactive: false });
  camadas.dominios = camadaDominios();

  const ligadas: Record<string, boolean> = { grande: true, pequena: true };
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
  const iconeCat = (c: string) => { const sim = simboloCategoria(c); return sim ? htmlSimbolo(sim, 20, "mini") : `<i class="fa-solid fa-${CATEGORIAS[c].icone} mini" style="color:${CATEGORIAS[c].cor}"></i>`; };
  filtros.innerHTML = `
    <h2 class="ribbon">Marcos Oficiais</h2>
    ${(Object.keys(TIPOS) as Tipo[]).map((t) => linha(t, TIPOS[t].nome, htmlSimbolo(simboloTipo(t), 20, "mini"))).join("")}
    ${linha("pdi_fixo", "PDI* (Fixo)", iconeCat("pdi_fixo"))}
    ${linha("pdi_itinerante", "PDI* (Itinerante)", iconeCat("pdi_itinerante"))}
    <p class="muted nota">* Pontos de Interesse</p>
    <h2 class="ribbon"><a href="#" data-abrir="contribuicoes" title="Abrir a aba Contribuições">Contribuições</a><span class="ast">**</span></h2>
    ${CATEGORIAS_COMUNIDADE.map((c) => linha(c, CATEGORIAS[c].nome, iconeCat(c))).join("")}
    <p class="muted nota">** Contribuições da comunidade do Clã do Machado. De mestres a jogadores.</p>
    <h2 class="ribbon">Filtros</h2>
    ${linha("alcance", "Alcance do Clã (temporada 4)", `<i class="fa-solid fa-bullseye mini"></i>`)}
    ${linha("dominios", "Regiões", `<i class="fa-solid fa-flag mini"></i>`)}
    <h2 class="ribbon">Conferência</h2>
    ${linha("hex", "Grade de hexágonos", `<i class="fa-solid fa-border-all mini"></i>`)}
    ${linha("terreno", "Terreno (viagem)", `<i class="fa-solid fa-mountain-sun mini"></i>`)}
    ${linha("estradas", "Estradas (viagem)", `<i class="fa-solid fa-road mini"></i>`)}
    <p class="muted dica">Dica: segure <kbd>Shift</kbd> e clique no mapa para copiar as coordenadas (úteis ao cadastrar um local).</p>`;
  filtros.addEventListener("click", (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>("[data-abrir]");
    if (a) { e.preventDefault(); openTab(a.dataset.abrir!); }
  });
  filtros.addEventListener("change", (e) => {
    const i = e.target as HTMLInputElement;
    toggle(i.dataset.camada!, i.checked);
  });
  setTab("filtros", filtros);

  // ----- painel: contribuições -----
  const contrib = document.createElement("section");
  contrib.innerHTML = `
    <h1>Aventurando-se no Clã do Machado</h1>
    <p class="destaque">Phantyr é feito das histórias de quem o explora.</p>
    <p>Cada aventura deixa marcas, revela segredos e dá vida a novos lugares. E quem melhor para contar essas histórias do que aqueles que as vivenciaram?</p>
    <p>Compartilhe suas descobertas, relate acontecimentos marcantes e registre localidades que merecem ser conhecidas. Seja uma vila visitada, um personagem importante, um evento memorável ou um mistério desvendado.</p>
    <p>Sua aventura também faz parte da história do mundo. Registre suas experiências e ajude a construir o legado do Clã do Machado.</p>
    <div class="actions"><a class="btn primary" href="${FORM_CONTRIBUICAO}" target="_blank" rel="noopener"><i class="fa-solid fa-feather-pointed"></i> Adicionar contribuição</a></div>`;
  setTab("contribuicoes", contrib);
  setTab("viagem", viagem.painel);

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
    if (l.oculto) return; // sem posição no mapa atual
    const alvo = L.latLngBounds([l.y, l.x], [l.y, l.x]);
    map.fitBounds(alvo, { maxZoom: 1, paddingTopLeft: [panelWidth(), 0], paddingBottomRight: [0, isMobile() ? window.innerHeight * 0.5 : 0] });
  }

  return {
    selecionar,
    destroy() {
      map.remove();
      ["inicio", "filtros", "viagem", "contribuicoes", "detalhe"].forEach(hideTab);
      document.title = "Clã do Machado — Mapa de Phantyr";
    },
  };
}
