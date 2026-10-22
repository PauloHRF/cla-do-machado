// Corta o mapa do mundo em ladrilhos para o Leaflet (esquema TMS, 256 px).
//   node scripts/gerar-tiles.mjs "<caminho do mapa em alta resolução>"
// Gera public/img/mapa/{z}/{x}/{y}.webp para z de -2 a 2 (2000×1697 unidades × 2^z px).
import sharp from "sharp";
import { mkdir, rm } from "node:fs/promises";

const origem = process.argv[2];
if (!origem) { console.error("Uso: node scripts/gerar-tiles.mjs <mapa.webp|png>"); process.exit(1); }

const LARGURA = 2000, ALTURA = 1697, T = 256, ZOOMS = [-2, -1, 0, 1, 2];
const SAIDA = new URL("../public/img/mapa/", import.meta.url).pathname;
await rm(SAIDA, { recursive: true, force: true });

let total = 0;
for (const z of ZOOMS) {
  const s = 2 ** z;
  const w = Math.round(LARGURA * s), h = Math.round(ALTURA * s);
  const cols = Math.ceil(w / T), linhas = Math.ceil(h / T);
  // a imagem fica colada na base (lat 0); o excesso transparente vai para o topo
  const base = await sharp(origem)
    .resize(w, h, { kernel: "lanczos3" })
    .extend({ top: linhas * T - h, right: cols * T - w, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();
  for (let x = 0; x < cols; x++) {
    await mkdir(`${SAIDA}${z}/${x}`, { recursive: true });
    for (let y = 0; y < linhas; y++) { // y conta de baixo para cima (TMS)
      await sharp(base)
        .extract({ left: x * T, top: (linhas - 1 - y) * T, width: T, height: T })
        .webp({ quality: z === 2 ? 80 : 85, effort: 5 })
        .toFile(`${SAIDA}${z}/${x}/${y}.webp`);
      total++;
    }
  }
  console.log(`z=${z}: ${cols}×${linhas} ladrilhos`);
}
console.log(`${total} ladrilhos em ${SAIDA}`);
