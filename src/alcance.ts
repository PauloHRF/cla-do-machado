// Alcance do Clã (temporada 4): todos os hexágonos a até RAIO passos do hexágono de Sheidrost.
import L from "leaflet";
import { cidades } from "./data";
import { HEX_COLUNAS as NC, HEX_LINHAS as NL, MAPA_ALTURA, distancia, hexDe, verticesTopo, type Hex } from "./hex";

export const RAIO = 10;
const CENTRO_SLUG = "sheidrost";
const COR = "#e8412c";

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
  for (const k of dentro) {
    const [c, l] = k.split(",").map(Number);
    const v = verticesTopo(c, l);
    L.polygon(v.map(latlng), { stroke: false, fillColor: COR, fillOpacity: 0.28, interactive: false }).addTo(grupo);
    vizinho(c, l).forEach((n, i) => { if (!tem(n.c, n.l)) { const [a, b] = lados[i]; borda.push([v[a], v[b]]); } });
  }
  for (const seg of borda) L.polyline(seg.map(latlng), { color: "#fff", weight: 5, opacity: 0.85, interactive: false, lineCap: "round" }).addTo(grupo);
  for (const seg of borda) L.polyline(seg.map(latlng), { color: COR, weight: 3, opacity: 1, interactive: false, lineCap: "round" }).addTo(grupo);
  return grupo;
}
