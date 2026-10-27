import L from "leaflet";
import { centroLatLng, centroTopo, verticesTopo, hexDe, rotulo, linhaHex, MAPA_ALTURA, HEX_COLUNAS, HEX_LINHAS, HEX_LADO, type Hex } from "./hex";
import { calcularRota, diasInteiros, VOOS, type Voo, avaliarCaminho, terrenoDe, todasEstradas, rotasAquaticas, BARCO_HEX_POR_DIA, TELEPORTE_DIAS, eTeleporte, TERRENOS, type Perfil, type Terreno } from "./viagem";
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
export interface Viagem { painel: HTMLElement; ferramentas: HTMLElement; capturar(lat: number, lng: number): boolean }

export function montarViagem(map: L.Map, rolagemPainel: () => number): Viagem {
  const painel = document.createElement("section");
  painel.innerHTML = `
    <h1>Viagem</h1>
    <h2 class="ribbon">Desenhar caminho</h2>
    <div class="actions">
      <button class="btn" id="d-modo"><i class="fa-solid fa-pen"></i> Desenhar</button>
      <button class="btn" id="d-desfazer"><i class="fa-solid fa-rotate-left"></i> Desfazer</button>
      <button class="btn" id="d-limpar"><i class="fa-solid fa-eraser"></i> Limpar caminho</button>
    </div>
    <div id="d-res"></div>
    <h2 class="ribbon">Grupo</h2>
    <div id="v-solo">
    <label class="check"><input type="checkbox" id="v-montaria"><span class="box"></span><span>Todo o grupo tem montaria</span></label>
    <div id="v-ignora" class="viagem-campo" hidden>
      <label for="v-ignora-sel">A montaria ignora o terreno difícil de</label>
      <div><select id="v-ignora-sel" class="selecao">
        <option value="">Nenhum</option>
        ${(["floresta", "montanha", "deserto", "neve"] as Terreno[]).map((t) => `<option value="${t}">${TERRENOS[t].nome}</option>`).join("")}
      </select></div>
    </div>
    <label class="check"><input type="checkbox" id="v-estradas" checked autocomplete="off"><span class="box"></span><span>Usar estradas</span></label>
    <label class="check"><input type="checkbox" id="v-barco"><span class="box"></span><span>Usar passagens de barco (rotas aquáticas)</span></label>
    <p class="muted nota" id="v-barco-nota" hidden>Cada rota liga dois portos/docas e só vale entre eles: ${BARCO_HEX_POR_DIA} hexágonos por dia. Ligue <em>Filtros → Rotas aquáticas</em> para ver.</p>
    <label class="check"><input type="checkbox" id="v-barco-proprio"><span class="box"></span><span>Tenho barco próprio</span></label>
    <p class="muted nota" id="v-barco-proprio-nota" hidden>Com barco próprio o grupo entra e sai em qualquer ponto das rotas aquáticas (${BARCO_HEX_POR_DIA} hexágonos por dia).</p>
    <label class="check"><input type="checkbox" id="v-teleporte"><span class="box"></span><span>Usar teleportes</span></label>
    <p class="muted nota" id="v-teleporte-nota" hidden>Entre os pontos de teleporte do mapa (filtro <em>Teleportes</em>): tempo de teleporte: ${TELEPORTE_DIAS} dia(s).</p>
    </div>
    <div class="viagem-campo"><label for="v-voo">Transporte</label><div><select id="v-voo" class="selecao">
      <option value="">Terrestre / aquático</option>
      ${(Object.keys(VOOS) as Voo[]).map((k) => `<option value="${k}">${VOOS[k].nome} (${VOOS[k].hexPorDia} hex/dia, em linha reta)</option>`).join("")}
    </select></div></div>
    <p class="muted nota viagem-aviso-fim">Esta seção tem o intuito de ajudar no cálculo das viagens. Podem haver erros: a decisão do mestre e o bom senso prevalecem.</p>`;

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
  q<HTMLInputElement>("#v-estradas").checked = true; // sempre começa marcado (o navegador pode restaurar o estado antigo)
  q<HTMLSelectElement>("#v-voo").addEventListener("change", (e) => (q("#v-solo").hidden = !!(e.target as HTMLSelectElement).value));
  q<HTMLInputElement>("#v-teleporte").addEventListener("change", (e) => (q("#v-teleporte-nota").hidden = !(e.target as HTMLInputElement).checked));
  q<HTMLInputElement>("#v-barco").addEventListener("change", (e) => (q("#v-barco-nota").hidden = !(e.target as HTMLInputElement).checked));
  q<HTMLInputElement>("#v-barco-proprio").addEventListener("change", (e) => (q("#v-barco-proprio-nota").hidden = !(e.target as HTMLInputElement).checked));
  q<HTMLInputElement>("#v-montaria").addEventListener("change", (e) => (q("#v-ignora").hidden = !(e.target as HTMLInputElement).checked));

  // ----- caminho desenhado à mão -----
  const camadaDes = L.layerGroup().addTo(map);
  let extremos: Hex[] = [];   // pontos escolhidos no mapa, na ordem (origem, paradas, destino)
  let caminho: Hex[] = [];    // melhor caminho entre cada par de pontos seguidos, com o que estiver habilitado
  let semCaminho = false;
  let desenhando = false;
  const perfilAtual = (): Perfil => ({
    voo: (q<HTMLSelectElement>("#v-voo").value || undefined) as Voo | undefined,
    montaria: q<HTMLInputElement>("#v-montaria").checked, estradas: q<HTMLInputElement>("#v-estradas").checked, barco: q<HTMLInputElement>("#v-barco").checked, barcoProprio: q<HTMLInputElement>("#v-barco-proprio").checked, teleporte: q<HTMLInputElement>("#v-teleporte").checked,
    ignora: (q<HTMLSelectElement>("#v-ignora-sel").value ? [q<HTMLSelectElement>("#v-ignora-sel").value as Terreno] : []),
  });
  const fmtN = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");
  function redesenhar() {
    camadaDes.clearLayers();
    semCaminho = false; caminho = extremos.slice();
    if (extremos.length >= 2) {
      const pf = perfilAtual(); caminho = [];
      for (let i = 1; i < extremos.length && !semCaminho; i++) {
        const r = calcularRota(extremos[i - 1], extremos[i], pf);
        if (r) caminho.push(...(caminho.length ? r.caminho.slice(1) : r.caminho)); else semCaminho = true;
      }
    }
    const pts = caminho.map((h) => centroLatLng(h.c, h.l));
    if (pts.length > 1) {
      L.polyline(pts, { color: "#1b2a38", weight: 8, opacity: 0.55, interactive: false }).addTo(camadaDes);
      L.polyline(pts, { color: "#35d0c0", weight: 4, opacity: 0.98, lineJoin: "round", interactive: false }).addTo(camadaDes);
    }
    caminho.forEach((h, i) => {
      const agua = terrenoDe(h) === "agua";
      L.circleMarker(centroLatLng(h.c, h.l), { radius: 3.5, color: "#1b2a38", weight: 2, fillColor: agua ? "#ff4d4d" : "#35d0c0", fillOpacity: 1, interactive: false }).addTo(camadaDes);
    });
    extremos.forEach((h, i) => L.marker(centroLatLng(h.c, h.l), {
      icon: L.divIcon({ className: "viagem-pino", html: `<span>${i + 1}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] }), interactive: false, keyboard: false,
    }).addTo(camadaDes));
    const res = q("#d-res");
    if (semCaminho) { res.innerHTML = `<p class="viagem-aviso">Não há caminho entre esses pontos com as opções escolhidas.</p>`; return; }
    if (caminho.length < 2) { res.innerHTML = extremos.length ? `<p class="muted">Origem em ${rotulo(extremos[0])}. Clique no próximo ponto.</p>` : ""; return; }
    const r = avaliarCaminho(caminho, perfilAtual());
    const inteiro = diasInteiros(r.dias), soma = Math.round(r.dias * 100) / 100;
    res.innerHTML = `
      <div class="viagem-total"><strong>${inteiro}</strong> dia${inteiro === 1 ? "" : "s"}<small>${inteiro !== soma ? `(soma: ${fmtN(soma)} dia${soma === 1 ? "" : "s"}, arredondada para cima) · ` : ""}${r.passos} hexágono${r.passos === 1 ? "" : "s"} · ${rotulo(caminho[0])} → ${rotulo(caminho[caminho.length - 1])}</small></div>
      ${r.agua.length ? `<p class="viagem-aviso">O caminho passa por <strong>${r.agua.length}</strong> hexágono${r.agua.length === 1 ? "" : "s"} de água (em vermelho no mapa), que não entram na conta: ${r.agua.slice(0, 6).map(rotulo).join(", ")}${r.agua.length > 6 ? "…" : ""}.</p>` : ""}
      <table class="viagem-tab"><thead><tr><th>Tipo</th><th>Hexes</th><th>Dias</th></tr></thead><tbody>
      ${r.detalhe.map((d) => `<tr><td>${esc(d.rotulo)}</td><td>${d.hexes}</td><td>${fmtN(d.dias)}</td></tr>`).join("")}
      </tbody></table>`;
  }
  function adicionar(h: Hex) {
    if (extremos.length && mesmoHex(extremos[extremos.length - 1], h)) return;
    extremos.push(h);
    redesenhar();
  }
  const botaoModo = q<HTMLButtonElement>("#d-modo");
  function modoDesenho(on: boolean) {
    desenhando = on; botaoModo.classList.toggle("on", on); botaoModo.innerHTML = on ? `<i class="fa-solid fa-check"></i> Concluir` : `<i class="fa-solid fa-pen"></i> Desenhar`;
    map.getContainer().classList.toggle("modo-pick", on);
  }
  botaoModo.addEventListener("click", () => {
    if (selecionando) modoSelecao(false);
    modoDesenho(!desenhando);
  });
  q("#d-desfazer").addEventListener("click", () => { extremos.pop(); redesenhar(); });
  q("#d-limpar").addEventListener("click", () => { extremos = []; redesenhar(); });
  map.on("click", (e: L.LeafletMouseEvent) => {
    if (!desenhando) return;
    const h = hexDe(e.latlng.lng, e.latlng.lat); if (h) adicionar(h);
  });
  // o perfil do grupo vale também para o caminho desenhado
  painel.addEventListener("change", (e) => { if ((e.target as HTMLElement).matches("#v-voo, #v-montaria, #v-estradas, #v-barco, #v-barco-proprio, #v-teleporte, #v-ignora-sel") && extremos.length >= 2) redesenhar(); });

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
  botaoSel.addEventListener("click", () => { if (desenhando) modoDesenho(false); modoSelecao(!selecionando); });
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
    const txt = desenhando ? "Desligar desenho" : selecionando ? "Desligar seleção" : "";
    desligar.hidden = !txt; desligar.innerHTML = txt ? `<i class="fa-solid fa-xmark"></i> ${txt}` : "";
  }
  desligar.addEventListener("click", () => { if (desenhando) modoDesenho(false); if (selecionando) modoSelecao(false); atualizarDesligar(); });
  // reavalia depois de qualquer clique no painel ou no mapa (os modos mudam nesses cliques)
  painel.addEventListener("click", () => setTimeout(atualizarDesligar, 0));
  map.on("click", () => setTimeout(atualizarDesligar, 0));
  map.on("unload", () => desligar.remove());

  return {
    painel, ferramentas,
    // clique num marcador de local durante a escolha no mapa
    capturar(lat, lng) {
      if (desenhando) { const h = hexDe(lng, lat); if (h) adicionar(h); return true; }
      if (selecionando) { const h = hexDe(lng, lat); if (h) alternar(h, "toggle"); return true; }
      return false;
    },
  };
}
