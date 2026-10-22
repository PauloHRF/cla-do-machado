import L from "leaflet";
import { locais, norm } from "./data";
import { centroLatLng, centroTopo, verticesTopo, hexDe, rotulo, MAPA_ALTURA, HEX_COLUNAS, HEX_LINHAS, HEX_LADO, type Hex } from "./hex";
import { calcularRota, terrenoDe, todasEstradas, TERRENOS, type Perfil, type Terreno } from "./viagem";
import { esc } from "./ui";

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

// ---------- painel "Viagem" ----------
export interface Viagem { painel: HTMLElement; capturar(lat: number, lng: number, nome?: string): boolean }

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
    <label class="check"><input type="checkbox" id="v-montaria"><span class="box"></span><span>Todo o grupo tem montaria</span></label>
    <div id="v-ignora" hidden>
      <p class="muted">A montaria ignora o terreno difícil de:</p>
      ${(["floresta", "montanha", "deserto", "neve"] as Terreno[]).map((t) => `<label class="check"><input type="checkbox" data-ignora="${t}"><span class="box"></span><span>${TERRENOS[t].nome}</span></label>`).join("")}
      <p class="muted">Ex.: camelo → deserto; bode → montanha.</p>
    </div>
    <label class="check"><input type="checkbox" id="v-estradas" checked><span class="box"></span><span>Usar estradas</span></label>
    <div class="actions"><button class="btn primary" id="v-calc"><i class="fa-solid fa-route"></i> Calcular</button><button class="btn" id="v-limpar">Limpar</button></div>
    <div id="v-res"></div>`;

  const q = <T extends HTMLElement>(s: string) => painel.querySelector<T>(s)!;
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
    const k = b.dataset.pick as "de" | "ate"; const ligado = modo === k; sair();
    if (!ligado) { modo = k; b.classList.add("on"); map.getContainer().classList.add("modo-pick"); }
  }));
  map.on("click", (e: L.LeafletMouseEvent) => {
    if (!modo) return;
    const h = hexDe(e.latlng.lng, e.latlng.lat); if (!h) return;
    const k = modo; sair(); definir(k, h);
  });

  q<HTMLInputElement>("#v-montaria").addEventListener("change", (e) => (q("#v-ignora").hidden = !(e.target as HTMLInputElement).checked));

  function limparRota() { camada.clearLayers(); (["de", "ate"] as const).forEach((k) => (marcadores[k] = undefined)); (["de", "ate"] as const).forEach((k) => pontos[k] && definir(k, pontos[k], campo(k).value)); q("#v-res").innerHTML = ""; }
  q("#v-limpar").addEventListener("click", () => { sair(); camada.clearLayers(); pontos.de = pontos.ate = null; campo("de").value = campo("ate").value = ""; q("#v-res").innerHTML = ""; });

  q("#v-calc").addEventListener("click", () => {
    sair(); lerCampo("de"); lerCampo("ate");
    const res = q("#v-res");
    if (!pontos.de || !pontos.ate) { res.innerHTML = `<p class="viagem-aviso">Escolha a origem e o destino (pelo nome, pelo hexágono ou clicando no mapa).</p>`; return; }
    const montaria = q<HTMLInputElement>("#v-montaria").checked;
    const perfil: Perfil = {
      montaria, estradas: q<HTMLInputElement>("#v-estradas").checked,
      ignora: Array.from(painel.querySelectorAll<HTMLInputElement>("[data-ignora]:checked")).map((i) => i.dataset.ignora as Terreno),
    };
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

  return {
    painel,
    // clique num marcador de local durante a escolha no mapa
    capturar(lat, lng, nome) {
      if (!modo) return false;
      const h = hexDe(lng, lat); if (!h) return false;
      const k = modo; sair(); definir(k, h, nome); return true;
    },
  };
}
