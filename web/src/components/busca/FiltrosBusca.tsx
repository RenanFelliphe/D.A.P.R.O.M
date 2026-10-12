"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useOptimistic, useRef, useState, useTransition, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ordemDosStatus } from "@/lib/os-app";
import { rotuloDoPerfil, rotuloDoStatus, type OsStatus, type Perfil } from "@/lib/tipos";

/** Tudo o que a busca guarda na URL (texto vazio = sem filtro). */
export interface ValoresDaBusca {
  q: string;
  mostrar: string;
  equipe: string;
  supervisor: string;
  perfil: string;
  ativo: string;
  status: string;
  tipo: string;
  critica: string;
}

interface Opcao {
  id: string;
  nome: string;
}

interface FiltrosBuscaProps {
  caminho: string;
  valores: ValoresDaBusca;
  equipes: Opcao[];
  supervisores: Opcao[];
  /** OS por situação com o texto atual (alimenta os números do filtro de situação). */
  contagem: Record<OsStatus, number> | null;
  perfis: Perfil[];
  /** Só o admin filtra pela situação da conta. */
  admin: boolean;
  /** Admin, analista e Segurança enxergam e filtram todas as equipes; os demais só a própria. */
  veEquipes: boolean;
}

type Secao = "equipes" | "usuarios" | "os";

const ATRASO_DO_TEXTO_MS = 350;
const CAMPOS_DAS_SECOES: Record<Secao, (keyof ValoresDaBusca)[]> = {
  equipes: ["equipe", "supervisor"],
  usuarios: ["perfil", "ativo"],
  os: ["status", "tipo", "critica"],
};

const SEM_FILTROS: ValoresDaBusca = { q: "", mostrar: "", equipe: "", supervisor: "", perfil: "", ativo: "", status: "", tipo: "", critica: "" };

const OPCOES_DE_MOSTRAR: [string, string][] = [
  ["", "Tudo"],
  ["equipes", "Equipes"],
  ["usuarios", "Usuários"],
  ["os", "OS"],
];

function Grupo({ id, icone, titulo, ativos, aberta, aoAlternar, children }: {
  id: string;
  icone: IconName;
  titulo: string;
  ativos: number;
  aberta: boolean;
  aoAlternar: () => void;
  children: ReactNode;
}) {
  return (
    <section className="busca-secao" data-aberta={aberta}>
      <h3>
        <button type="button" className="busca-secao-cab" aria-expanded={aberta} aria-controls={id} onClick={aoAlternar}>
          <Icon name={icone} size={16} />
          <span className="grow">{titulo}</span>
          {ativos > 0 && (
            <span className="busca-secao-n" aria-label={`${ativos} ${ativos === 1 ? "filtro ativo" : "filtros ativos"}`}>
              {ativos}
            </span>
          )}
          <Icon name="down" size={16} className="busca-secao-seta" />
        </button>
      </h3>
      <div id={id} className="busca-secao-corpo" hidden={!aberta}>
        {children}
      </div>
    </section>
  );
}

/**
 * Filtros da busca. O campo de texto fica sempre à vista; "Mostrar" e uma seção fechada por tópico (equipes, usuários e
 * OS) ficam no corpo, que no tablet e no celular se recolhe atrás do botão "Filtros". Cada mudança vai direto para a URL
 * (o texto, depois de uma pausa na digitação), e os resultados se atualizam sem botão. Enquanto a página nova não chega,
 * os controles já mostram o valor escolhido. O Enter no texto manda `abrir=1`: se o texto é exatamente um item só, abre
 * a página dele (a pausa na digitação nunca tira a pessoa desta página).
 */
export function FiltrosBusca({ caminho, valores, equipes, supervisores, contagem, perfis, admin, veEquipes }: FiltrosBuscaProps) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [vistos, mostrarEscolha] = useOptimistic(valores, (atuais, novos: Partial<ValoresDaBusca>) => ({ ...atuais, ...novos }));
  const [texto, setTexto] = useState(valores.q);
  const [textoDaUrl, setTextoDaUrl] = useState(valores.q);
  const [abertas, setAbertas] = useState<Record<Secao, boolean>>(() => ({
    equipes: CAMPOS_DAS_SECOES.equipes.some((c) => valores[c]),
    usuarios: CAMPOS_DAS_SECOES.usuarios.some((c) => valores[c]),
    os: CAMPOS_DAS_SECOES.os.some((c) => valores[c]),
  }));
  const [corpoAberto, setCorpoAberto] = useState(false);
  const [digitando, setDigitando] = useState(false);
  const espera = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const id = useId();

  // O texto também muda por fora (a busca da barra superior): acompanha a URL, menos enquanto se digita aqui.
  if (valores.q !== textoDaUrl) {
    setTextoDaUrl(valores.q);
    if (!digitando) setTexto(valores.q);
  }

  useEffect(() => () => clearTimeout(espera.current), []);

  function ir(novos: Partial<ValoresDaBusca>, abrir = false) {
    const todos = { ...vistos, q: texto.trim(), ...novos };
    const params = new URLSearchParams();
    for (const [chave, valor] of Object.entries(todos)) if (valor) params.set(chave, valor);
    if (abrir && todos.q) params.set("abrir", "1");
    const consulta = params.toString();
    iniciar(() => {
      mostrarEscolha(novos);
      router.replace(consulta ? `${caminho}?${consulta}` : caminho, { scroll: false });
    });
  }

  function mudarTexto(novo: string) {
    setTexto(novo);
    clearTimeout(espera.current);
    espera.current = setTimeout(() => ir({ q: novo.trim() }), ATRASO_DO_TEXTO_MS);
  }

  function limparTudo() {
    clearTimeout(espera.current);
    setTexto("");
    iniciar(() => {
      mostrarEscolha(SEM_FILTROS);
      router.replace(caminho, { scroll: false });
    });
  }

  const ativosDe = (secao: Secao) => CAMPOS_DAS_SECOES[secao].filter((c) => vistos[c]).length;
  const totalDeFiltros = ativosDe("equipes") + ativosDe("usuarios") + ativosDe("os") + (vistos.mostrar ? 1 : 0);
  const algumFiltro = totalDeFiltros > 0 || Boolean(valores.q) || Boolean(texto);
  const alternar = (secao: Secao) => setAbertas((a) => ({ ...a, [secao]: !a[secao] }));

  return (
    <form
      className="panel busca-form"
      role="search"
      aria-busy={pendente}
      onSubmit={(e) => {
        e.preventDefault();
        clearTimeout(espera.current);
        ir({ q: texto.trim() }, true);
      }}
    >
      <div className="field">
        <label htmlFor={`${id}-q`}>Buscar por</label>
        <div className="busca-campo">
          <Icon name={pendente ? "refresh" : "search"} size={16} className={pendente ? "spin" : undefined} />
          <input
            id={`${id}-q`}
            className="input"
            type="search"
            value={texto}
            placeholder="Nome, matrícula, nº da OS…"
            autoComplete="off"
            enterKeyHint="search"
            onFocus={() => setDigitando(true)}
            onBlur={() => setDigitando(false)}
            onChange={(e) => mudarTexto(e.target.value)}
          />
        </div>
      </div>

      <button
        type="button"
        className="btn btn-line btn-sm busca-toggle"
        aria-expanded={corpoAberto}
        aria-controls={`${id}-corpo`}
        onClick={() => setCorpoAberto((a) => !a)}
      >
        <Icon name="filter" size={16} />
        Filtros
        {totalDeFiltros > 0 && (
          <span className="busca-secao-n" aria-label={`${totalDeFiltros} ${totalDeFiltros === 1 ? "filtro ativo" : "filtros ativos"}`}>
            {totalDeFiltros}
          </span>
        )}
        <Icon name="down" size={16} className="busca-toggle-seta" />
      </button>

      <div id={`${id}-corpo`} className="busca-corpo" data-aberto={corpoAberto}>
        <div className="busca-corpo-cab">
          <h2>Filtros</h2>
          {algumFiltro && (
            <button type="button" className="busca-limpar" onClick={limparTudo}>
              Limpar tudo
            </button>
          )}
        </div>

        <fieldset className="busca-mostrar">
          <legend className="lbl">Mostrar</legend>
          <div className="busca-seg">
            {OPCOES_DE_MOSTRAR.map(([valor, rotulo]) => (
              <label key={valor}>
                <input type="radio" name="mostrar" value={valor} checked={vistos.mostrar === valor} onChange={() => ir({ mostrar: valor })} />
                <span>{rotulo}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {veEquipes && (
          <Grupo id={`${id}-eq`} icone="users" titulo="Equipes" ativos={ativosDe("equipes")} aberta={abertas.equipes} aoAlternar={() => alternar("equipes")}>
            <div className="field">
              <label htmlFor={`${id}-equipe`}>Equipe</label>
              <select id={`${id}-equipe`} className="select" value={vistos.equipe} onChange={(e) => ir({ equipe: e.target.value })}>
                <option value="">Todas as equipes</option>
                {equipes.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
              <span className="small">Também restringe os usuários e as OS à equipe escolhida.</span>
            </div>
            <div className="field">
              <label htmlFor={`${id}-sup`}>Supervisor</label>
              <select id={`${id}-sup`} className="select" value={vistos.supervisor} onChange={(e) => ir({ supervisor: e.target.value })}>
                <option value="">Qualquer supervisor</option>
                {supervisores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>
          </Grupo>
        )}

        <Grupo id={`${id}-us`} icone="user" titulo="Usuários" ativos={ativosDe("usuarios")} aberta={abertas.usuarios} aoAlternar={() => alternar("usuarios")}>
          <div className="field">
            <label htmlFor={`${id}-perfil`}>Perfil</label>
            <select id={`${id}-perfil`} className="select" value={vistos.perfil} onChange={(e) => ir({ perfil: e.target.value })}>
              <option value="">Todos os perfis</option>
              {perfis.map((p) => (
                <option key={p} value={p}>
                  {rotuloDoPerfil[p]}
                </option>
              ))}
            </select>
          </div>
          {admin && (
            <div className="field">
              <label htmlFor={`${id}-ativo`}>Situação da conta</label>
              <select id={`${id}-ativo`} className="select" value={vistos.ativo} onChange={(e) => ir({ ativo: e.target.value })}>
                <option value="">Ativas e inativas</option>
                <option value="true">Só ativas</option>
                <option value="false">Só inativas</option>
              </select>
            </div>
          )}
        </Grupo>

        <Grupo id={`${id}-os`} icone="clip" titulo="Ordens de serviço" ativos={ativosDe("os")} aberta={abertas.os} aoAlternar={() => alternar("os")}>
          <div className="field">
            <label htmlFor={`${id}-status`}>Situação</label>
            <select id={`${id}-status`} className="select" value={vistos.status} onChange={(e) => ir({ status: e.target.value })}>
              <option value="">Todas</option>
              {ordemDosStatus.map((s) => (
                <option key={s} value={s}>
                  {rotuloDoStatus[s]}
                  {contagem ? ` (${contagem[s]})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`${id}-tipo`}>Tipo</label>
            <select id={`${id}-tipo`} className="select" value={vistos.tipo} onChange={(e) => ir({ tipo: e.target.value })}>
              <option value="">Preventiva e corretiva</option>
              <option value="preventiva">Preventiva</option>
              <option value="corretiva">Corretiva</option>
            </select>
          </div>
          <label className="busca-check">
            <input type="checkbox" checked={vistos.critica === "true"} onChange={(e) => ir({ critica: e.target.checked ? "true" : "" })} />
            <span>Só locais críticos</span>
          </label>
        </Grupo>
      </div>
    </form>
  );
}
