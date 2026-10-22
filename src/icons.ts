import L from "leaflet";
import type { Simbolo } from "./data";

// Símbolos da legenda do mapa (cidade grande, cidade pequena, ponto de interesse, PDI itinerante).
const TINTA = "#2a1d12", FUNDO = "#f2e6c8";
const TAMANHOS: Record<Simbolo, number> = { grande: 26, pequena: 18, pdi: 18, itinerante: 22 };

export function htmlSimbolo(s: Simbolo, tam = TAMANHOS[s], classe = "") {
  if (s === "itinerante")
    return `<i class="fa-solid fa-shoe-prints ${classe}" style="font-size:${Math.round(tam * 0.8)}px;color:${TINTA}" aria-hidden="true"></i>`;
  const corpo =
    s === "grande"
      ? `<circle cx="12" cy="12" r="9.8" fill="${FUNDO}" stroke="${TINTA}" stroke-width="2.6"/><circle cx="12" cy="12" r="4.6" fill="${TINTA}"/>`
      : s === "pequena"
        ? `<circle cx="12" cy="12" r="6.4" fill="${FUNDO}" stroke="${TINTA}" stroke-width="2.8"/><circle cx="12" cy="12" r="1.9" fill="${TINTA}"/>`
        : `<path d="M12 2.6 21.4 12 12 21.4 2.6 12Z" fill="${TINTA}" stroke="${FUNDO}" stroke-width="1.4" stroke-linejoin="round"/>`;
  return `<svg class="${classe}" viewBox="0 0 24 24" width="${tam}" height="${tam}" aria-hidden="true">${corpo}</svg>`;
}

// Marcador no mapa: o símbolo da legenda centrado sobre o ponto, com área de clique um pouco maior.
export function simbolo(s: Simbolo) {
  const tam = TAMANHOS[s], caixa = tam + 10;
  return L.divIcon({
    className: "simbolo",
    iconSize: [caixa, caixa],
    iconAnchor: [caixa / 2, caixa / 2],
    tooltipAnchor: [0, -caixa / 2],
    html: htmlSimbolo(s, tam),
  });
}

// Ícone redondo para pontos de interesse e locais de cidade.
export function disco(icone: string, cor: string, tamanho = 30) {
  return L.divIcon({
    className: "disco",
    iconSize: [tamanho, tamanho],
    iconAnchor: [tamanho / 2, tamanho / 2],
    tooltipAnchor: [0, -tamanho / 2],
    html: `<span style="background:${cor};width:${tamanho}px;height:${tamanho}px;font-size:${Math.round(tamanho * 0.46)}px"><i class="fa-solid fa-${icone}"></i></span>`,
  });
}
