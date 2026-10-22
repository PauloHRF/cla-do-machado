// Grade de hexágonos do mapa (topo plano, colunas; colunas ímpares um meio hexágono mais abaixo).
// Medida sobre a arte original (8192 px): lado 48,305 px, escala vertical 1,0025 (a imagem é ~0,25% mais alta
// que um hexágono regular) e centro da coluna 1 / linha 1 em (217,5; 33,0) px. Tudo abaixo está em unidades do
// mapa do site (2000 de largura). Para nudge fino, mexa só em AJUSTE_Y (positivo = desce a grade).
const K = 8192 / 2000;
const LADO = 48.305 / K;
const ESCALA_Y = 1.0025;
const ALTURA = Math.sqrt(3) * LADO * ESCALA_Y; // distância vertical entre centros da mesma coluna
const AJUSTE_Y = 0;
const ORIGEM_X = 217.5 / K; // centro da coluna 4 (a coluna 1 fica na borda esquerda do mapa)
const ORIGEM_Y = (4227 + AJUSTE_Y) / K; // y (a partir do topo) do centro da "linha 51" da coluna par

export const HEX_COLUNAS = 114;
export const HEX_LINHAS = 83;
export const MAPA_ALTURA = 1697;
export const HEX_LADO = LADO;
export const HEX_ESCALA_Y = ESCALA_Y;

export interface Hex { c: number; l: number }

/** Centro do hexágono (coluna c, linha l) em coordenadas do mapa; y medido a partir do topo. */
export function centroTopo(c: number, l: number): [number, number] {
  return [ORIGEM_X + (c - 4) * 1.5 * LADO, ORIGEM_Y + (l - 51 + 0.5 * (c & 1)) * ALTURA];
}
/** Centro do hexágono como o Leaflet usa: [lat (y de baixo para cima), lng (x)]. */
export function centroLatLng(c: number, l: number): [number, number] {
  const [x, yt] = centroTopo(c, l);
  return [MAPA_ALTURA - yt, x];
}

const valido = (c: number, l: number) => c >= 1 && c <= HEX_COLUNAS && l >= 1 && l <= HEX_LINHAS;

/** Hexágono que contém o ponto (x, y do mapa do site, y de baixo para cima). Fora do mapa: null. */
export function hexDe(x: number, y: number): Hex | null {
  const yt = MAPA_ALTURA - y;
  const c0 = Math.round((x - ORIGEM_X) / (1.5 * LADO)) + 4;
  let melhor: Hex | null = null, dMin = Infinity;
  for (let c = c0 - 1; c <= c0 + 1; c++) {
    const l0 = Math.round((yt - ORIGEM_Y) / ALTURA - 0.5 * (c & 1)) + 51;
    for (let l = l0 - 1; l <= l0 + 1; l++) {
      const [cx, cy] = centroTopo(c, l);
      const d = (x - cx) ** 2 + ((yt - cy) / ESCALA_Y) ** 2;
      if (d < dMin) { dMin = d; melhor = { c, l }; }
    }
  }
  return melhor && valido(melhor.c, melhor.l) ? melhor : null;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const rotulo = (h: Hex) => `C${pad(h.c)}-L${pad(h.l)}`;

/** Distância em hexágonos (número de passos) entre dois hexágonos. */
export function distancia(a: Hex, b: Hex): number {
  const cubo = ({ c, l }: Hex) => { const q = c, r = l - (c - (c & 1)) / 2; return [q, r, -q - r]; };
  const [aq, ar, as] = cubo(a), [bq, br, bs] = cubo(b);
  return Math.max(Math.abs(aq - bq), Math.abs(ar - br), Math.abs(as - bs));
}

/** Vértices do hexágono (c, l) em coordenadas do mapa com y a partir do topo. */
export function verticesTopo(c: number, l: number): [number, number][] {
  const [cx, cy] = centroTopo(c, l);
  return Array.from({ length: 6 }, (_, k) => {
    const a = (Math.PI / 3) * k;
    return [cx + LADO * Math.cos(a), cy + LADO * ESCALA_Y * Math.sin(a)];
  });
}

/** Hexágonos em linha reta de a até b (inclui os dois), para ligar cliques não vizinhos. */
export function linhaHex(a: Hex, b: Hex): Hex[] {
  const cubo = ({ c, l }: Hex) => ({ x: c, z: l - (c - (c & 1)) / 2 });
  const A = cubo(a), B = cubo(b), n = distancia(a, b), saida: Hex[] = [];
  for (let i = 0; i <= n; i++) {
    const t = n ? i / n : 0;
    const x = A.x + (B.x - A.x) * t + 1e-6, z = A.z + (B.z - A.z) * t - 1e-6, y = -x - z;
    let rx = Math.round(x), rz = Math.round(z); const ry = Math.round(y);
    const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
    if (dx > dy && dx > dz) rx = -ry - rz; else if (dy <= dz) rz = -rx - ry;
    saida.push({ c: rx, l: rz + (rx - (rx & 1)) / 2 });
  }
  return saida;
}
