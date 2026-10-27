// Todo o conteúdo vem de src/content/**.json (editável pelo CMS em /admin).
export type Tipo = "grande" | "pequena";

export interface Evento { data: string; texto: string }

export interface Cidade {
  slug: string; nome: string; tipo: Tipo; x: number; y: number; oculto?: boolean;
  dominio?: string; governo?: string; populacao?: string; clima?: string;
  economia?: string; religiao?: string; estabelecimentos?: string;
  texto?: string; pagina?: string; link?: string; link_texto?: string; eventos?: Evento[];
}

export interface Ponto {
  slug: string; nome: string; categoria: string; x: number; y: number; oculto?: boolean;
  icone?: string; cor?: string; descricao: string; link?: string; link_texto?: string; eventos?: Evento[];
}

export interface Jornal {
  slug: string; nome: string; edicao: number; data?: string; manchete?: string; imagem: string;
}

export interface Panteao {
  slug: string; nome: string; subtitulo: string; tipo: "deus" | "historia"; ordem: number; corpo: string;
}

export interface Poi {
  nome: string; icone: string; cor: string; x: number; y: number; descricao: string; detalhe: string;
}

export interface MapaCidade {
  slug: string; nome: string; imagem: string; largura: number; altura: number;
  centroX: number; centroY: number; zoom: number; zoomMin: number; texto: string; pois: Poi[];
}

const load = <T>(files: Record<string, unknown>) =>
  Object.entries(files).map(([path, v]) => ({
    slug: path.split("/").pop()!.replace(/\.json$/, ""),
    ...(v as object),
  })) as T[];

export const cidades = load<Cidade>(import.meta.glob("./content/cidades/*.json", { eager: true, import: "default" }));
export const pontos = load<Ponto>(import.meta.glob("./content/pontos/*.json", { eager: true, import: "default" }));
export const jornais = load<Jornal>(import.meta.glob("./content/jornais/*.json", { eager: true, import: "default" })).sort(
  (a, b) => b.edicao - a.edicao,
);
export const panteao = load<Panteao>(import.meta.glob("./content/panteao/*.json", { eager: true, import: "default" })).sort(
  (a, b) => a.ordem - b.ordem,
);
export const mapasCidade = load<MapaCidade>(
  import.meta.glob("./content/mapas-cidade/*.json", { eager: true, import: "default" }),
);

export const TIPOS: Record<Tipo, { nome: string; cor: string }> = {
  grande: { nome: "Cidade grande", cor: "#c0392b" },
  pequena: { nome: "Cidade pequena", cor: "#2e7fc4" },
};

// Categorias dos pontos. "oficial" = marcos do mapa oficial (símbolo da legenda); as demais são contribuições da comunidade.
export const CATEGORIAS: Record<string, { nome: string; icone: string; cor: string; oficial?: boolean }> = {
  pdi_fixo: { nome: "PDI (Fixo)", icone: "location-dot", cor: "#2a1d12", oficial: true },
  pdi_itinerante: { nome: "PDI (Itinerante)", icone: "shoe-prints", cor: "#2a1d12", oficial: true },
  teleporte: { nome: "Teleportes", icone: "wand-magic-sparkles", cor: "#7b3fc4", oficial: true },
  porto: { nome: "Portos", icone: "anchor", cor: "#1f5f8b", oficial: true },
  doca: { nome: "Docas (portos fluviais)", icone: "sailboat", cor: "#2d8f8a", oficial: true },
  assentamento: { nome: "Assentamentos/Vilas", icone: "tents", cor: "#8a5a2b" },
  boato: { nome: "Boatos", icone: "comment-dots", cor: "#b5527a" },
  construcao_humana: { nome: "Construções Humanas", icone: "landmark", cor: "#5b6f8f" },
  covil: { nome: "Covil de Criatura", icone: "dragon", cor: "#a23b2a" },
  estrutura_natural: { nome: "Estruturas Naturais", icone: "tree", cor: "#2f7a3f" },
  fauna_flora: { nome: "Fauna e Flora Phantyriana", icone: "paw", cor: "#7a6a1f" },
  historia: { nome: "Histórias/Contos/Marcos Artísticos", icone: "book-open", cor: "#6d4a9c" },
  masmorra: { nome: "Masmorras", icone: "dungeon", cor: "#3d3d46" },
  mais: { nome: "Mais", icone: "plus", cor: "#5c5c5c" },
};
export const CATEGORIAS_OFICIAIS = Object.keys(CATEGORIAS).filter((k) => CATEGORIAS[k].oficial);
export const CATEGORIAS_COMUNIDADE = Object.keys(CATEGORIAS).filter((k) => !CATEGORIAS[k].oficial);

// Símbolos da legenda do mapa: cidade grande, cidade pequena, ponto de interesse e PDI itinerante.
export type Simbolo = "grande" | "pequena" | "pdi" | "itinerante";
export const simboloTipo = (t: Tipo): Simbolo => t;
export const simboloCategoria = (cat: string): Simbolo | null => (cat === "pdi_fixo" ? "pdi" : cat === "pdi_itinerante" ? "itinerante" : null);

export type Local = ({ kind: "cidade" } & Cidade) | ({ kind: "ponto" } & Ponto);
export const locais = new Map<string, Local>();
for (const c of cidades) locais.set(c.slug, { kind: "cidade", ...c });
for (const p of pontos) locais.set(p.slug, { kind: "ponto", ...p });

// Reescreve "/img/..." (como salvo nos JSON) para a base do site.
export const asset = (s: string) => s.replace(/(["'(]|^)\/(?:cla-do-machado\/)?img\//g, `$1${import.meta.env.BASE_URL}img/`);

export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
