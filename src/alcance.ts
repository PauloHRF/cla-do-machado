// Alcance do Clã (temporada 4): todos os hexágonos a até RAIO passos do hexágono de Sheidrost.
import L from "leaflet";
import { cidades } from "./data";
import { HEX_COLUNAS as NC, HEX_LINHAS as NL, MAPA_ALTURA, distancia, hexDe, verticesTopo, type Hex } from "./hex";

export const RAIO = 10;
const CENTRO_SLUG = "sheidrost";
const COR = "#e8412c";
const COR_FORA = "#0b1218";

export function hexCentroAlcance(): Hex | null {
  const c = cidades.find((x) => x.slug === CENTRO_SLUG);
  return c ? hexDe(c.x, c.y) : null;
}

const latlng = ([x, yt]: [number, number]) => [MAPA_ALTURA - yt, x] as [number, number];

export function camadaAlcance(): L.LayerGroup {
  const grupo = L.layerGroup();
  const centro = hexCentroAlcance();
  if (!centro) return grupo;
  const dentro = new Set<string>();
  for (let c = 1; c <= NC; c++) for (let l = 1; l <= NL; l++) if (distancia(centro, { c, l }) <= RAIO) dentro.add(`${c},${l}`);
  const tem = (c: number, l: number) => dentro.has(`${c},${l}`);
  // lados do hexágono (vértice a → vértice b) e o vizinho que fica do outro lado de cada um
  const lados = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]];
  const vizinho = (c: number, l: number): Hex[] => c & 1
    ? [{ c: c + 1, l: l + 1 }, { c, l: l + 1 }, { c: c - 1, l: l + 1 }, { c: c - 1, l }, { c, l: l - 1 }, { c: c + 1, l }]
    : [{ c: c + 1, l }, { c, l: l + 1 }, { c: c - 1, l }, { c: c - 1, l: l - 1 }, { c, l: l - 1 }, { c: c + 1, l: l - 1 }];
  const borda: [number, number][][] = [];
  const baixoGrupo = L.layerGroup().addTo(grupo);   // escurecimento fica por baixo do vermelho
  for (const k of dentro) {
    const [c, l] = k.split(",").map(Number);
    const v = verticesTopo(c, l);
    L.polygon(v.map(latlng), { stroke: false, fillColor: COR, fillOpacity: 0.16, interactive: false }).addTo(grupo);
    vizinho(c, l).forEach((n, i) => { if (!tem(n.c, n.l)) { const [a, b] = lados[i]; borda.push([v[a], v[b]]); } });
  }
  // anéis do contorno: liga as arestas de borda pelos vértices em comum
  const chave = (p: [number, number]) => `${Math.round(p[0] * 100)},${Math.round(p[1] * 100)}`;
  const liga = new Map<string, { p: [number, number]; prox: string[] }>();
  for (const [a, b] of borda) {
    for (const [u, w] of [[a, b], [b, a]] as [number, number][][]) {
      const k = chave(u as [number, number]); const e = liga.get(k) ?? { p: u as [number, number], prox: [] };
      e.prox.push(chave(w as [number, number])); liga.set(k, e);
    }
  }
  const usado = new Set<string>(), aneis: [number, number][][] = [];
  const arestaK = (x: string, y: string) => (x < y ? `${x}|${y}` : `${y}|${x}`);
  for (const [k0, e0] of liga) {
    for (const k1 of e0.prox) {
      if (usado.has(arestaK(k0, k1))) continue;
      const anel: [number, number][] = [e0.p]; let ant = k0, atual = k1; usado.add(arestaK(k0, k1));
      while (atual !== k0) {
        const e = liga.get(atual)!; anel.push(e.p);
        const prox = e.prox.find((n) => n !== ant && !usado.has(arestaK(atual, n))) ?? e.prox.find((n) => !usado.has(arestaK(atual, n)));
        if (!prox) break;
        usado.add(arestaK(atual, prox)); ant = atual; atual = prox;
      }
      aneis.push(anel);
    }
  }
  const GRANDE = 20000;
  const fora: [number, number][] = [[-GRANDE, -GRANDE], [-GRANDE, GRANDE], [GRANDE, GRANDE], [GRANDE, -GRANDE]];
  L.polygon([fora, ...aneis.map((r) => r.map(latlng))], { stroke: false, fillColor: COR_FORA, fillOpacity: 0.58, fillRule: "evenodd", interactive: false }).addTo(baixoGrupo);
  for (const seg of borda) L.polyline(seg.map(latlng), { color: "#fff", weight: 5, opacity: 0.85, interactive: false, lineCap: "round" }).addTo(grupo);
  for (const seg of borda) L.polyline(seg.map(latlng), { color: COR, weight: 3, opacity: 1, interactive: false, lineCap: "round" }).addTo(grupo);
  return grupo;
}
