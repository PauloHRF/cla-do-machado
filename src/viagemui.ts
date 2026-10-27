import L from "leaflet";
import { locais, norm } from "./data";
import { centroLatLng, centroTopo, verticesTopo, hexDe, rotulo, linhaHex, MAPA_ALTURA, HEX_COLUNAS, HEX_LINHAS, HEX_LADO, type Hex } from "./hex";
import { calcularRota, VOOS, type Voo, avaliarCaminho, terrenoDe, todasEstradas, rotasAquaticas, BARCO_HEX_POR_DIA, TELEPORTE_DIAS, eTeleporte, TERRENOS, type Perfil, type Terreno } from "./viagem";
import { esc, toast } from "./ui";
// ---------- camadas de revisão (para a equipe conferir o que foi lido do mapa) ----------
export function camadaTerreno() {
  const Camada = L.GridLayer.extend({
    createTile(this: L.GridLayer, coords: L.Coords) {
      const t = this.getTileSize(), tile = L.DomUtil.create("canvas") as HTMLCanvasElement;
      tile.width = t.x; tile.height = t.y;
      const ctx = tile.getContext("2d")!;
      const esc = 2 ** coords.z;
      const nw = (this as unknown as { _map: L.Map })._map.unproject(coords.scaleBy(t), coords.z);
      const x0 = nw.lng, y0 = MAPA_ALTURA - nw.lat, larg = t.x / esc, alt = t.y / esc;
      ctx.globalAlpha = 0.5;
      for (let c = 1; c <= HEX_COLUNAS; c++) for (let l = 1; l <= HEX_LINHAS; l++) {
        const [cx, cy] = centroTopo(c, l);
        if (cx < x0 - HEX_LADO || cx > x0 + larg + HEX_LADO || cy < y0 - HEX_LADO || cy > y0 + alt + HEX_LADO) continue;
        ctx.fillStyle = TERRENOS[terrenoDe({ c, l })].cor;
        ctx.beginPath();
        verticesTopo(c, l).forEach(([vx, vy], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, (vx - x0) * esc, (vy - y0) * esc));
        ctx.closePath(); ctx.fill();
      }
      return tile;
    },
  });
  return new (Camada as unknown as new (o: L.GridLayerOptions) => L.GridLayer)({ tileSize: 256, minZoom: -2, maxZoom: 2, zIndex: 2 });
}

export function camadaEstradas() {
  const g = L.layerGroup();
  for (const [a, b] of todasEstradas())
    L.polyline([centroLatLng(a.c, a.l), centroLatLng(b.c, b.l)], { color: "#e8412c", weight: 4, opacity: 0.95, interactive: false }).addTo(g);
  return g;
}

const mesmoHex = (a: Hex, b: Hex) => a.c === b.c && a.l === b.l;

export function camadaRotasAquaticas() {
  const g = L.layerGroup();
  const vizinho = (c: number, l: number) => c & 1
    ? [[c, l + 1], [c + 1, l], [c + 1, l + 1], [c - 1, l], [c - 1, l + 1]]
    : [[c, l + 1], [c + 1, l - 1], [c + 1, l], [c - 1, l - 1], [c - 1, l]];
  for (const r of rotasAquaticas) {
    const tem = new Set(r.hexes.map((h) => `${h.c},${h.l}`));
    for (const h of r.hexes) {
      L.circleMarker(centroLatLng(h.c, h.l), { radius: 3, color: "#0e4d66", weight: 1, fillColor: "#27d3e6", fillOpacity: 1, interactive: false }).addTo(g);
      for (const [c, l] of vizinho(h.c, h.l)) if (tem.has(`${c},${l}`))
        L.polyline([centroLatLng(h.c, h.l), centroLatLng(c, l)], { color: "#27d3e6", weight: 3, opacity: 0.9, dashArray: "6 5", interactive: false }).addTo(g);
    }
  }
  return g;
}

// ---------- painel "Viagem" ----------
export interface Viagem { painel: HTMLElement; ferramentas: HTMLElement; capturar(lat: number, lng: number, nome?: string): boolean }

export function montarViagem(map: L.Map, rolagemPainel: () => number): Viagem {
  const painel = document.createElement("section");
  const nomes = [...locais.values()].filter((l) => !l.oculto).map((l) => l.nome).sort((a, b) => a.localeCompare(b, "pt"));
  painel.innerHTML = `
    <h1>Viagem</h1>
    <p class="muted">Calcula o tempo pela regra do clã: 1 hex = 1 dia a pé; montaria dobra a velocidade; terreno difícil (floresta, montanha, deserto, neve) divide por 2; estrada ignora o terreno difícil.</p>
    <h2 class="ribbon">Trajeto</h2>
    <div class="viagem-campo"><label for="v-de">Origem</label><div><input id="v-de" list="v-locais" placeholder="Local ou C45-L32" autocomplete="off"><button class="btn" data-pick="de" title="Clicar no mapa"><i class="fa-solid fa-location-crosshairs"></i></button></div></div>
    <div class="viagem-campo"><label for="v-ate">Destino</label><div><input id="v-ate" list="v-locais" placeholder="Local ou C45-L32" autocomplete="off"><button class="btn" data-pick="ate" title="Clicar no mapa"><i class="fa-solid fa-location-crosshairs"></i></button></div></div>
    <datalist id="v-locais">${nomes.map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
    <h2 class="ribbon">Grupo</h2>
    <div class="viagem-campo"><label for="v-voo">Transporte</label><div><select id="v-voo">
      <option value="">Terrestre / aquático</option>
      ${(Object.keys(VOOS) as Voo[]).map((k) => `<option value="${k}">${VOOS[k].nome} (${VOOS[k].hexPorDia} hex/dia, em linha reta)</option>`).join("")}
    </select></div></div>
    <div id="v-solo">
    <label class="check"><input type="checkbox" id="v-montaria"><span class="box"></span><span>Todo o grupo tem montaria</span></label>
    <div id="v-ignora" hidden>
      <p class="muted">A montaria ignora o terreno difícil de:</p>
      ${(["floresta", "montanha", "deserto", "neve"] as Terreno[]).map((t) => `<label class="check"><input type="checkbox" data-ignora="${t}"><span class="box"></span><span>${TERRENOS[t].nome}</span></label>`).join("")}
      <p class="muted">Ex.: camelo → deserto; bode → montanha.</p>
    </div>
    <label class="check"><input type="checkbox" id="v-estradas" checked><span class="box"></span><span>Usar estradas</span></label>
    <label class="check"><input type="checkbox" id="v-barco"><span class="box"></span><span>Usar passagens de barco (rotas aquáticas)</span></label>
    <p class="muted nota" id="v-barco-nota" hidden>Cada rota liga dois portos/docas e só vale entre eles: ${BARCO_HEX_POR_DIA} hexágonos por dia. Ligue <em>Filtros → Rotas aquáticas</em> para ver.</p>
    <label class="check"><input type="checkbox" id="v-barco-proprio"><span class="box"></span><span>Tenho barco próprio</span></label>
    <p class="muted nota" id="v-barco-proprio-nota" hidden>Com barco próprio o grupo entra e sai em qualquer ponto das rotas aquáticas (${BARCO_HEX_POR_DIA} hexágonos por dia).</p>
    <label class="check"><input type="checkbox" id="v-teleporte"><span class="box"></span><span>Usar teleportes</span></label>
    <p class="muted nota" id="v-teleporte-nota" hidden>Entre os pontos de teleporte do mapa (filtro <em>Teleportes</em>): tempo de teleporte: ${TELEPORTE_DIAS} dia(s).</p>
    </div>
    <p class="muted nota" id="v-barco-nota" hidden>Entre portos e docas, pelas rotas do mapa: ${BARCO_HEX_POR_DIA} hexágonos por dia. Ligue <em>Filtros → Rotas aquáticas</em> para ver.</p>
    <div class="actions"><button class="btn primary" id="v-calc"><i class="fa-solid fa-route"></i> Calcular</button><button class="btn" id="v-limpar">Limpar</button></div>
    <div id="v-res"></div>
    <h2 class="ribbon">Desenhar caminho</h2>
    <p class="muted">Clique nos hexágonos do mapa, na ordem do trajeto (ou nos locais). Se o clique não for vizinho do anterior, os hexágonos do meio entram em linha reta.</p>
    <div class="actions">
      <button class="btn" id="d-modo"><i class="fa-solid fa-pen"></i> Desenhar</button>
      <button class="btn" id="d-desfazer"><i class="fa-solid fa-rotate-left"></i> Desfazer</button>
      <button class="btn" id="d-limpar"><i class="fa-solid fa-eraser"></i> Limpar caminho</button>
    </div>
    <div id="d-res"></div>`;

  // ferramentas de conferência: aba discreta, sem ícone, acima do Discord
  const ferramentas = document.createElement("section");
  ferramentas.innerHTML = `
    <h1>Ferramentas</h1>
    <h2 class="ribbon">Selecionar hexágonos</h2>
    <p class="muted">Para corrigir terreno ou estradas em vários hexágonos de uma vez: ligue a seleção, clique nos hexágonos (clique de novo para tirar) e copie a lista. <strong>Ctrl + arrastar</strong> pinta vários de uma vez; <strong>Ctrl + Alt + arrastar</strong> apaga.</p>
    <div class="actions">
      <button class="btn" id="s-modo"><i class="fa-solid fa-hand-pointer"></i> Selecionar</button>
      <button class="btn" id="s-copiar"><i class="fa-solid fa-copy"></i> Copiar lista</button>
      <button class="btn" id="s-limpar"><i class="fa-solid fa-eraser"></i> Limpar seleção</button>
    </div>
    <div id="s-res"></div>`;

  const q = <T extends HTMLElement>(s: string) => (painel.querySelector<T>(s) ?? ferramentas.querySelector<T>(s))!;
  const pontos: Record<"de" | "ate", Hex | null> = { de: null, ate: null };
  let modo: "de" | "ate" | null = null;
  const camada = L.layerGroup().addTo(map);
  const marcadores: Record<string, L.Marker | undefined> = {};

  const campo = (k: "de" | "ate") => q<HTMLInputElement>(k === "de" ? "#v-de" : "#v-ate");
  function definir(k: "de" | "ate", h: Hex | null, texto?: string) {
    pontos[k] = h; if (h) campo(k).value = texto ?? rotulo(h);
    marcadores[k]?.remove(); marcadores[k] = undefined;
    if (h) marcadores[k] = L.marker(centroLatLng(h.c, h.l), {
      icon: L.divIcon({ className: "viagem-pino", html: `<span>${k === "de" ? "A" : "B"}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] }), interactive: false, keyboard: false,
    }).addTo(camada);
  }
  function lerCampo(k: "de" | "ate") {
    const v = campo(k).value.trim(); if (!v) return definir(k, null);
    const local = [...locais.values()].find((l) => norm(l.nome) === norm(v));
    if (local) { const h = hexDe(local.x, local.y); if (h) return definir(k, h, local.nome); }
    const m = /(\d+)\D+(\d+)/.exec(v);
    if (m) { const h = { c: +m[1], l: +m[2] }; if (h.c >= 1 && h.c <= HEX_COLUNAS && h.l >= 1 && h.l <= HEX_LINHAS) return definir(k, h); }
    pontos[k] = null;
  }
  (["de", "ate"] as const).forEach((k) => campo(k).addEventListener("change", () => lerCampo(k)));

  const sair = () => { modo = null; map.getContainer().classList.remove("modo-pick"); painel.querySelectorAll("[data-pick]").forEach((b) => b.classList.remove("on")); };
  painel.querySelectorAll<HTMLElement>("[data-pick]").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.pick as "de" | "ate"; const ligado = modo === k; sair(); if (desenhando) modoDesenho(false); if (selecionando) modoSelecao(false);
    if (!ligado) { modo = k; b.classList.add("on"); map.getContainer().classList.add("modo-pick"); }
  }));
  map.on("click", (e: L.LeafletMouseEvent) => {
    if (!modo) return;
    const h = hexDe(e.latlng.lng, e.latlng.lat); if (!h) return;
    const k = modo; sair(); definir(k, h);
  });

  q<HTMLSelectElement>("#v-voo").addEventListener("change", (e) => (q("#v-solo").hidden = !!(e.target as HTMLSelectElement).value));
  q<HTMLInputElement>("#v-teleporte").addEventListener("change", (e) => (q("#v-teleporte-nota").hidden = !(e.target as HTMLInputElement).checked));
  q<HTMLInputElement>("#v-barco").addEventListener("change", (e) => (q("#v-barco-nota").hidden = !(e.target as HTMLInputElement).checked));
  q<HTMLInputElement>("#v-barco-proprio").addEventListener("change", (e) => (q("#v-barco-proprio-nota").hidden = !(e.target as HTMLInputElement).checked));
  q<HTMLInputElement>("#v-montaria").addEventListener("change", (e) => (q("#v-ignora").hidden = !(e.target as HTMLInputElement).checked));

  function limparRota() { camada.clearLayers(); (["de", "ate"] as const).forEach((k) => (marcadores[k] = undefined)); (["de", "ate"] as const).forEach((k) => pontos[k] && definir(k, pontos[k], campo(k).value)); q("#v-res").innerHTML = ""; }
  q("#v-limpar").addEventListener("click", () => { sair(); camada.clearLayers(); pontos.de = pontos.ate = null; campo("de").value = campo("ate").value = ""; q("#v-res").innerHTML = ""; });

  q("#v-calc").addEventListener("click", () => {
    sair(); lerCampo("de"); lerCampo("ate");
    const res = q("#v-res");
    if (!pontos.de || !pontos.ate) { res.innerHTML = `<p class="viagem-aviso">Escolha a origem e o destino (pelo nome, pelo hexágono ou clicando no mapa).</p>`; return; }
    const perfil = perfilAtual();
    limparRota();
    const r = calcularRota(pontos.de, pontos.ate, perfil);
    if (!r) { res.innerHTML = `<p class="viagem-aviso">Não há caminho por terra entre esses pontos.</p>`; return; }
    L.polyline(r.caminho.map((h) => centroLatLng(h.c, h.l)), { color: "#d9a441", weight: 5, opacity: 0.95, lineJoin: "round", interactive: false }).addTo(camada);
    L.polyline(r.caminho.map((h) => centroLatLng(h.c, h.l)), { color: "#3a2412", weight: 8, opacity: 0.45, interactive: false }).addTo(camada).bringToBack();
    const dias = Math.round(r.dias * 100) / 100, inteiro = Math.ceil(r.dias - 1e-9);
    const fmt = (n: number) => String(n).replace(".", ",");
    res.innerHTML = `
      <div class="viagem-total"><strong>${fmt(dias)}</strong> dia${dias === 1 ? "" : "s"}<small>${inteiro !== dias ? `(chegada no ${inteiro}º dia)` : ""}</small></div>
      <p class="muted">${r.passos} hexágono${r.passos === 1 ? "" : "s"} percorridos; em linha reta seriam ${r.direta}.</p>
      <table class="viagem-tab"><thead><tr><th>Tipo</th><th>Hexes</th><th>Dias</th></tr></thead><tbody>
      ${r.detalhe.map((d) => `<tr><td>${esc(d.rotulo)}</td><td>${d.hexes}</td><td>${fmt(Math.round(d.dias * 100) / 100)}</td></tr>`).join("")}
      </tbody></table>
      <p class="muted dica">Terreno e estradas foram lidos automaticamente do mapa e podem ter erros. Ligue <em>Terreno</em> e <em>Estradas</em> em Mapas para conferir.</p>`;
    map.fitBounds(L.latLngBounds(r.caminho.map((h) => centroLatLng(h.c, h.l))), { paddingTopLeft: [rolagemPainel() + 40, 80], paddingBottomRight: [40, 40], maxZoom: 1.5 });
  });

  // ----- caminho desenhado à mão -----
  const camadaDes = L.layerGroup().addTo(map);
  let caminho: Hex[] = [];
  let desenhando = false;
  const perfilAtual = (): Perfil => ({
    voo: (q<HTMLSelectElement>("#v-voo").value || undefined) as Voo | undefined,
    montaria: q<HTMLInputElement>("#v-montaria").checked, estradas: q<HTMLInputElement>("#v-estradas").checked, barco: q<HTMLInputElement>("#v-barco").checked, barcoProprio: q<HTMLInputElement>("#v-barco-proprio").checked, teleporte: q<HTMLInputElement>("#v-teleporte").checked,
    ignora: Array.from(painel.querySelectorAll<HTMLInputElement>("[data-ignora]:checked")).map((i) => i.dataset.ignora as Terreno),
  });
  const fmtN = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");
  function redesenhar() {
    camadaDes.clearLayers();
    const pts = caminho.map((h) => centroLatLng(h.c, h.l));
    if (pts.length > 1) {
      L.polyline(pts, { color: "#1b2a38", weight: 8, opacity: 0.55, interactive: false }).addTo(camadaDes);
      L.polyline(pts, { color: "#35d0c0", weight: 4, opacity: 0.98, lineJoin: "round", interactive: false }).addTo(camadaDes);
    }
    caminho.forEach((h, i) => {
      const agua = terrenoDe(h) === "agua";
      L.circleMarker(centroLatLng(h.c, h.l), { radius: i === 0 || i === caminho.length - 1 ? 7 : 3.5, color: "#1b2a38", weight: 2, fillColor: agua ? "#ff4d4d" : i === 0 ? "#6be26b" : "#35d0c0", fillOpacity: 1, interactive: false }).addTo(camadaDes);
    });
    const res = q("#d-res");
    if (caminho.length < 2) { res.innerHTML = caminho.length ? `<p class="muted">Início em ${rotulo(caminho[0])}. Clique no próximo hexágono.</p>` : ""; return; }
    const r = avaliarCaminho(caminho, perfilAtual());
    const dias = fmtN(r.dias), inteiro = Math.ceil(r.dias - 1e-9);
    res.innerHTML = `
      <div class="viagem-total"><strong>${dias}</strong> dia${r.dias === 1 ? "" : "s"}<small>${inteiro !== Math.round(r.dias * 100) / 100 ? `(chegada no ${inteiro}º dia) · ` : ""}${r.passos} hexágono${r.passos === 1 ? "" : "s"} · ${rotulo(caminho[0])} → ${rotulo(caminho[caminho.length - 1])}</small></div>
      ${r.agua.length ? `<p class="viagem-aviso">O caminho passa por <strong>${r.agua.length}</strong> hexágono${r.agua.length === 1 ? "" : "s"} de água (em vermelho no mapa), que não entram na conta: ${r.agua.slice(0, 6).map(rotulo).join(", ")}${r.agua.length > 6 ? "…" : ""}.</p>` : ""}
      <table class="viagem-tab"><thead><tr><th>Tipo</th><th>Hexes</th><th>Dias</th></tr></thead><tbody>
      ${r.detalhe.map((d) => `<tr><td>${esc(d.rotulo)}</td><td>${d.hexes}</td><td>${fmtN(d.dias)}</td></tr>`).join("")}
      </tbody></table>`;
  }
  function adicionar(h: Hex) {
    const ult = caminho[caminho.length - 1];
    if (ult && ult.c === h.c && ult.l === h.l) return;
    const pf = perfilAtual();
    const rota = ult && pf.barco ? rotasAquaticas.find((r) => (mesmoHex(r.de, ult) && mesmoHex(r.ate, h)) || (mesmoHex(r.ate, ult) && mesmoHex(r.de, h))) : undefined;
    caminho.push(...(!ult ? [h] : rota ? (mesmoHex(rota.de, ult) ? rota.trajeto : [...rota.trajeto].reverse()).slice(1)
      : pf.teleporte && eTeleporte(ult) && eTeleporte(h) ? [h] : linhaHex(ult, h).slice(1)));
    redesenhar();
  }
  const botaoModo = q<HTMLButtonElement>("#d-modo");
  function modoDesenho(on: boolean) {
    desenhando = on; botaoModo.classList.toggle("on", on); botaoModo.innerHTML = on ? `<i class="fa-solid fa-check"></i> Concluir` : `<i class="fa-solid fa-pen"></i> Desenhar`;
    map.getContainer().classList.toggle("modo-pick", on);
  }
  botaoModo.addEventListener("click", () => { sair(); if (selecionando) modoSelecao(false); modoDesenho(!desenhando); });
  q("#d-desfazer").addEventListener("click", () => { caminho.pop(); redesenhar(); });
  q("#d-limpar").addEventListener("click", () => { caminho = []; redesenhar(); });
  map.on("click", (e: L.LeafletMouseEvent) => {
    if (!desenhando) return;
    const h = hexDe(e.latlng.lng, e.latlng.lat); if (h) adicionar(h);
  });
  // o perfil do grupo vale também para o caminho desenhado
  painel.addEventListener("change", (e) => { if ((e.target as HTMLElement).matches("#v-voo, #v-montaria, #v-estradas, #v-barco, #v-barco-proprio, #v-teleporte, [data-ignora]") && caminho.length > 1) redesenhar(); });

  // ----- seleção de vários hexágonos (copiar a lista de códigos) -----
  const camadaSel = L.layerGroup().addTo(map);
  const selecionados = new Map<string, Hex>();
  let selecionando = false, pintando: "add" | "del" | null = null;
  const chaveHex = (h: Hex) => `${h.c},${h.l}`;
  const botaoSel = q<HTMLButtonElement>("#s-modo");
  function listaCodigos(): string[] {
    return [...selecionados.values()].sort((a, b) => a.l - b.l || a.c - b.c).map(rotulo);
  }
  function redesenharSel() {
    camadaSel.clearLayers();
    for (const h of selecionados.values()) {
      const pts = verticesTopo(h.c, h.l).map(([x, y]) => [MAPA_ALTURA - y, x] as [number, number]);
      L.polygon(pts, { color: "#ffffff", weight: 2, fillColor: "#e8412c", fillOpacity: 0.45, interactive: false }).addTo(camadaSel);
    }
    const cods = listaCodigos();
    const por = new Map<string, number>();
    for (const h of selecionados.values()) { const t = TERRENOS[terrenoDe(h)].nome; por.set(t, (por.get(t) ?? 0) + 1); }
    q("#s-res").innerHTML = cods.length
      ? `<p class="muted"><strong>${cods.length}</strong> hexágono${cods.length === 1 ? "" : "s"} selecionado${cods.length === 1 ? "" : "s"} (terreno atual: ${[...por].map(([t, n]) => `${esc(t)} ${n}`).join(", ")}).</p><textarea id="s-lista" readonly rows="4">${cods.join(", ")}</textarea>`
      : "";
  }
  function alternar(h: Hex, modo: "toggle" | "add" | "del") {
    const k = chaveHex(h), tem = selecionados.has(k);
    if (modo === "del" || (modo === "toggle" && tem)) selecionados.delete(k); else selecionados.set(k, h);
    redesenharSel();
  }
  function modoSelecao(on: boolean) {
    selecionando = on;
    botaoSel.classList.toggle("on", on); botaoSel.innerHTML = on ? `<i class="fa-solid fa-check"></i> Concluir` : `<i class="fa-solid fa-hand-pointer"></i> Selecionar`;
    map.getContainer().classList.toggle("modo-pick", on);
  }
  botaoSel.addEventListener("click", () => { sair(); if (desenhando) modoDesenho(false); modoSelecao(!selecionando); });
  q("#s-limpar").addEventListener("click", () => { selecionados.clear(); redesenharSel(); });
  q("#s-copiar").addEventListener("click", () => {
    const t = listaCodigos().join(", ");
    if (!t) { toast("Nada selecionado"); return; }
    navigator.clipboard?.writeText(t).then(() => toast(`${selecionados.size} hexágonos copiados`), () => toast("Copie pela caixa de texto"));
  });
  map.on("click", (e: L.LeafletMouseEvent) => {
    if (!selecionando || pintando) return;
    const o = e.originalEvent as MouseEvent; if (o.ctrlKey) return;
    const h = hexDe(e.latlng.lng, e.latlng.lat); if (h) alternar(h, "toggle");
  });
  // Ctrl + arrastar: pinta (ou apaga com Alt) sem mover o mapa
  map.on("mousedown", (e: L.LeafletMouseEvent) => {
    const o = e.originalEvent as MouseEvent;
    if (!selecionando || !o.ctrlKey) return;
    pintando = o.altKey ? "del" : "add"; map.dragging.disable();
    const h = hexDe(e.latlng.lng, e.latlng.lat); if (h) alternar(h, pintando);
  });
  map.on("mousemove", (e: L.LeafletMouseEvent) => {
    if (!pintando) return;
    const h = hexDe(e.latlng.lng, e.latlng.lat); if (h) { const k = chaveHex(h); if (selecionados.has(k) !== (pintando === "add")) alternar(h, pintando); }
  });
  const soltar = () => { if (pintando) { pintando = null; map.dragging.enable(); } };
  document.addEventListener("mouseup", soltar);
  map.on("unload", () => document.removeEventListener("mouseup", soltar));

  // ----- botão flutuante para desligar a ferramenta ativa (mesma posição do "voltar ao mapa de Phantyr") -----
  const desligar = document.createElement("button");
  desligar.id = "desligar-ferramenta"; desligar.className = "btn btn-busca"; desligar.hidden = true;
  document.body.append(desligar);
  function atualizarDesligar() {
    const txt = desenhando ? "Desligar desenho" : selecionando ? "Desligar seleção" : modo ? "Cancelar escolha no mapa" : "";
    desligar.hidden = !txt; desligar.innerHTML = txt ? `<i class="fa-solid fa-xmark"></i> ${txt}` : "";
  }
  desligar.addEventListener("click", () => { sair(); if (desenhando) modoDesenho(false); if (selecionando) modoSelecao(false); atualizarDesligar(); });
  // reavalia depois de qualquer clique no painel ou no mapa (os modos mudam nesses cliques)
  painel.addEventListener("click", () => setTimeout(atualizarDesligar, 0));
  map.on("click", () => setTimeout(atualizarDesligar, 0));
  map.on("unload", () => desligar.remove());

  return {
    painel, ferramentas,
    // clique num marcador de local durante a escolha no mapa
    capturar(lat, lng, nome) {
      if (desenhando) { const h = hexDe(lng, lat); if (h) adicionar(h); return true; }
      if (selecionando) { const h = hexDe(lng, lat); if (h) alternar(h, "toggle"); return true; }
      if (!modo) return false;
      const h = hexDe(lng, lat); if (!h) return false;
      const k = modo; sair(); definir(k, h, nome); return true;
    },
  };
}
