// Todo o conteúdo vem de src/content/**.json (editável pelo CMS em /admin).
export type Tipo = "estado" | "grande" | "media" | "pequena";

export interface Evento { data: string; texto: string }

export interface Cidade {
  slug: string; nome: string; tipo: Tipo; x: number; y: number; oculto?: boolean;
  dominio?: string; governo?: string; populacao?: string; clima?: string;
  economia?: string; religiao?: string; estabelecimentos?: string;
  texto?: string; pagina?: string; link?: string; eventos?: Evento[];
}

export interface Ponto {
  slug: string; nome: string; categoria: string; x: number; y: number; oculto?: boolean;
  icone?: string; cor?: string; descricao: string; link?: string; eventos?: Evento[];
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
export const panteao = load<Panteao>(import.meta.glob("./content/panteao/*.json", { eager: true, import: "default" })).sort(
  (a, b) => a.ordem - b.ordem,
);
export const mapasCidade = load<MapaCidade>(
  import.meta.glob("./content/mapas-cidade/*.json", { eager: true, import: "default" }),
);

export const TIPOS: Record<Tipo, { nome: string; cor: string; tamanho: number }> = {
  estado: { nome: "Cidade-Estado", cor: "#c0392b", tamanho: 32 },
  grande: { nome: "Cidade grande", cor: "#d9822b", tamanho: 28 },
  media: { nome: "Cidade média", cor: "#c9b92b", tamanho: 25 },
  pequena: { nome: "Cidade pequena", cor: "#2e7fc4", tamanho: 22 },
};

export const CATEGORIAS: Record<string, { nome: string; icone: string }> = {
  assentamento: { nome: "Assentamentos", icone: "tents" },
  covil: { nome: "Covil de Criatura", icone: "dragon" },
  dungeon: { nome: "Dungeon", icone: "dungeon" },
  mais: { nome: "Mais", icone: "plus" },
  pdi_construcao: { nome: "PDI (Construção)", icone: "landmark" },
  pdi_itinerante: { nome: "PDI itinerante", icone: "shoe-prints" },
  pdi_natural: { nome: "PDI (Natural)", icone: "tree" },
};

// Símbolos da legenda do mapa: cidade grande, cidade pequena, ponto de interesse e PDI itinerante.
export type Simbolo = "grande" | "pequena" | "pdi" | "itinerante";
export const simboloTipo = (t: Tipo): Simbolo => (t === "estado" || t === "grande" ? "grande" : "pequena");
export const simboloCategoria = (cat: string): Simbolo =>
  cat === "assentamento" ? "pequena" : cat === "pdi_itinerante" ? "itinerante" : "pdi";

export type Local = ({ kind: "cidade" } & Cidade) | ({ kind: "ponto" } & Ponto);
export const locais = new Map<string, Local>();
for (const c of cidades) locais.set(c.slug, { kind: "cidade", ...c });
for (const p of pontos) locais.set(p.slug, { kind: "ponto", ...p });

// Reescreve "/img/..." (como salvo nos JSON) para a base do site.
export const asset = (s: string) => s.replace(/(["'(]|^)\/(?:cla-do-machado\/)?img\//g, `$1${import.meta.env.BASE_URL}img/`);

export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
