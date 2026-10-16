import L from "leaflet";
import { TIPOS, type Tipo } from "./data";

// Pino de cidade: SVG colorido, maior quanto mais importante a cidade.
export function pin(tipo: Tipo) {
  const { cor, tamanho: w } = TIPOS[tipo];
  const h = Math.round(w * 1.4);
  return L.divIcon({
    className: "pin",
    iconSize: [w, h],
    iconAnchor: [w / 2, Math.round((h * 34) / 35)], // ponta do pino exatamente sobre o ponto
    tooltipAnchor: [0, -h + 6],
    html: `<svg viewBox="0 0 25 35" width="${w}" height="${h}" aria-hidden="true">
      <path d="M12.5 1C6.2 1 1 6 1 12.2 1 20.6 12.5 34 12.5 34S24 20.6 24 12.2C24 6 18.8 1 12.5 1Z" fill="${cor}" stroke="#fff" stroke-width="1.6"/>
      <circle cx="12.5" cy="12.3" r="4.4" fill="#fff" fill-opacity=".92"/></svg>`,
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
