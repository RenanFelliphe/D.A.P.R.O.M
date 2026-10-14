/**
 * Catálogo de serviço do Campo de treino: materiais, ferramentas e EPIs fictícios e a lista dos serviços (as atividades
 * das OS de treino). Só leitura: no treino ninguém edita o catálogo. Tudo é inventado.
 */
import type { CategoriaMaterial, Material, MaterialDoServico, ServicoDoCatalogo } from "../lib/catalogo";
import { idTreino } from "./ids";

type MaterialTreino = Omit<Material, "servicos_total" | "criado_em">;

const material = (n: number, descricao: string, unidade: string, categoria: CategoriaMaterial, codigo: string | null = null): MaterialTreino => ({
  id: idTreino("3", n),
  codigo,
  descricao,
  unidade,
  categoria,
  ativo: true,
});

const MATERIAIS: MaterialTreino[] = [
  material(1, "Isolador de pino 15 kV", "un", "material", "TR-1001"),
  material(2, "Amarração pré-formada para isolador", "un", "material", "TR-1002"),
  material(3, "Elo fusível 10K", "un", "material", "TR-1003"),
  material(4, "Lâmpada LED 100 W", "un", "material", "TR-1004"),
  material(5, "Relé fotoelétrico", "un", "material", "TR-1005"),
  material(6, "Álcool isopropílico", "L", "material"),
  material(7, "Pano de limpeza sem fiapos", "un", "material"),
  material(8, "Graxa condutiva", "kg", "material"),
  material(9, "Sílica gel para secador de ar", "kg", "material"),
  material(20, "Câmera termográfica", "un", "ferramenta"),
  material(21, "Detector de tensão por aproximação", "un", "ferramenta"),
  material(22, "Vara de manobra telescópica", "un", "ferramenta"),
  material(23, "Conjunto de aterramento temporário", "un", "ferramenta"),
  material(24, "Megôhmetro 5 kV", "un", "ferramenta"),
  material(25, "Torquímetro 20 a 100 N·m", "un", "ferramenta"),
  material(26, "Binóculo", "un", "ferramenta"),
  material(27, "Escada de fibra extensível", "un", "ferramenta"),
  material(40, "Luva isolante classe 2", "par", "epi"),
  material(41, "Vestimenta antichama", "un", "epi"),
  material(42, "Cinto paraquedista com talabarte", "un", "epi"),
  material(43, "Capacete com jugular", "un", "epi"),
  material(44, "Óculos de segurança", "un", "epi"),
];

type Linha = [material: number, quantidade: number | null, observacao?: string, obrigatorio?: boolean];

/** Serviço → descrição e lista. A poda (`COR-PODA`) fica sem lista, para o treino mostrar o serviço ainda não cadastrado. */
const SERVICOS: { codigo: string; descricao: string; linhas: Linha[] }[] = [
  { codigo: "COR-ILUM", descricao: "Iluminação pública", linhas: [[4, 4], [5, 1, "Trocar só se o relé não acender no teste"], [27, 1], [40, 1], [43, 1], [44, 1]] },
  { codigo: "COR-PODA", descricao: "Poda de árvore próxima à rede", linhas: [] },
  {
    codigo: "COR-REDE-ALT",
    descricao: "Manutenção em rede aérea",
    linhas: [[1, 2], [2, 4], [3, 3], [22, 1], [23, 1, "Instalar antes de tocar na rede"], [21, 1], [40, 1], [42, 1], [43, 1]],
  },
  { codigo: "PREV-CHAVE", descricao: "Limpeza e inspeção de chaves seccionadoras", linhas: [[6, 1], [7, 5], [8, 0.2], [22, 1], [40, 1], [44, 1]] },
  { codigo: "PREV-TERMO-MT", descricao: "Inspeção termográfica de média tensão", linhas: [[20, 1], [21, 1], [41, 1, "Obrigatória perto de painel energizado", true], [40, 1], [44, 1]] },
  { codigo: "PREV-TRAFO", descricao: "Manutenção preventiva de transformador", linhas: [[9, 1], [24, 1], [25, 1], [40, 1], [43, 1]] },
  { codigo: "PREV-VISUAL", descricao: "Inspeção visual de equipamentos", linhas: [[26, 1], [43, 1], [44, 1]] },
];

const porId = new Map(MATERIAIS.map((m) => [m.id, m]));
const itensDe = (linhas: Linha[]): MaterialDoServico[] =>
  linhas.map(([n, quantidade, observacao, obrigatorio], i) => {
    const m = porId.get(idTreino("3", n))!;
    return { material_id: m.id, codigo: m.codigo, descricao: m.descricao, unidade: m.unidade, categoria: m.categoria, ativo: m.ativo, quantidade, observacao: observacao ?? null, obrigatorio: obrigatorio ?? false, ordem: i + 1 };
  });

/** Os serviços do catálogo de treino, por código, com o modelo de APR que cada OS de treino usa (`modeloDe`). */
export function servicosDoTreino(modeloDe: (codigo: string) => string | null): ServicoDoCatalogo[] {
  return SERVICOS.map((s) => ({ codigo: s.codigo, descricao: s.descricao, modelo_apr_codigo: modeloDe(s.codigo), provisorio: false, materiais: itensDe(s.linhas) }));
}

/** Os materiais do catálogo de treino, com quantos serviços usam cada um. */
export function materiaisDoTreino(criadoEm: string): Material[] {
  return MATERIAIS.map((m) => ({ ...m, criado_em: criadoEm, servicos_total: SERVICOS.filter((s) => s.linhas.some(([n]) => idTreino("3", n) === m.id)).length }));
}
