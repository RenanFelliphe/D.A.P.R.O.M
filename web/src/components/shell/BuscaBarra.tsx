"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "@/components/ui/Icon";
import { chamar } from "@/lib/cliente-api";
import { destacar } from "@/lib/destacar";
import { rotas } from "@/lib/rotas";
import { rotuloDoPerfil, rotuloDoStatus, type OsStatus, type Perfil } from "@/lib/tipos";

interface BuscaBarraProps {
  /** Área em que a pessoa está: define para onde vão a página de resultados e o detalhe das OS. */
  area: "web" | "app";
}

interface OsPrevia {
  id: string;
  numero_ordem: string | null;
  titulo: string;
  status: OsStatus;
  local_instalacao: { codigo: string; cliente: string | null };
}

interface UsuarioPrevia {
  id: string;
  nome: string;
  /** Só o admin recebe o e-mail; para os demais a prévia mostra o cargo. */
  email?: string;
  cargo: string | null;
  perfil: Perfil;
}

interface EquipePrevia {
  id: string;
  nome: string;
  centro_trabalho: string;
  supervisor_nome: string | null;
  total_membros: number;
}

interface Resultados {
  os: OsPrevia[];
  usuarios: UsuarioPrevia[];
  equipes: EquipePrevia[];
}

interface Item {
  chave: string;
  href: string;
  tipo: "os" | "usuario" | "equipe";
  titulo: string;
  detalhe: string;
  extra: string;
}

const TOTAL_DE_PREVIAS = 5;
const MINIMO_DE_LETRAS = 2;
const ESPERA_MS = 250;

/**
 * Busca global da barra superior (OS, usuários e equipes). Enquanto se digita, mostra as 5 primeiras correspondências num
 * menu. Enter sem escolher nada envia a busca com `abrir=1`: se o texto é exatamente um item só (o e-mail completo, a
 * matrícula, o número da ordem...), abre a página dele; senão, a página de resultados. "Ver todos os resultados" vai
 * sempre para a página de resultados. Abaixo de 901px o campo some e a lupa o abre numa faixa que desce por baixo da
 * barra.
 */
export function BuscaBarra({ area }: BuscaBarraProps) {
  const router = useRouter();
  const [faixaAberta, setFaixaAberta] = useState(false);
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<Resultados | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const botao = useRef<HTMLButtonElement>(null);
  const formulario = useRef<HTMLFormElement>(null);
  const pedido = useRef(0);
  const id = useId();

  const termo = texto.trim();
  const paginaDeBusca = area === "web" ? rotas.web.busca : rotas.app.busca;
  const hrefDeTodos = `${paginaDeBusca}?q=${encodeURIComponent(termo)}`;

  // Busca em tempo real: espera o fim da digitação e ignora respostas de pedidos que já ficaram para trás.
  useEffect(() => {
    const numero = ++pedido.current;
    if (termo.length < MINIMO_DE_LETRAS) return;
    const espera = setTimeout(async () => {
      setCarregando(true);
      const q = encodeURIComponent(termo);
      try {
        const [os, usuarios, equipes] = await Promise.all([
          chamar<{ os: OsPrevia[] }>("GET", `/os?busca=${q}&tamanho=${TOTAL_DE_PREVIAS}`),
          chamar<{ usuarios: UsuarioPrevia[] }>("GET", `/usuarios?busca=${q}&tamanho=${TOTAL_DE_PREVIAS}`),
          chamar<{ equipes: EquipePrevia[] }>("GET", `/equipes?busca=${q}&tamanho=${TOTAL_DE_PREVIAS}`),
        ]);
        if (numero !== pedido.current) return;
        setResultados({ os: os.os, usuarios: usuarios.usuarios, equipes: equipes.equipes });
        setErro(false);
      } catch {
        if (numero !== pedido.current) return;
        setResultados(null);
        setErro(true);
      } finally {
        if (numero === pedido.current) setCarregando(false);
      }
    }, ESPERA_MS);
    return () => clearTimeout(espera);
  }, [termo]);

  // As 5 prévias: cada tipo começa com uma cota (equipe 1, usuários 2, OS 2) e as vagas que sobram vão para quem ainda tem resultados.
  const itens: Item[] = [];
  if (resultados) {
    const todos: Record<"equipe" | "usuario" | "os", Item[]> = {
      equipe: resultados.equipes.map((e) => ({
        chave: `eq-${e.id}`,
        href: area === "web" ? rotas.web.equipe(e.id) : rotas.app.equipe(e.id),
        tipo: "equipe" as const,
        titulo: `Equipe ${e.nome}`,
        detalhe: `${e.centro_trabalho} · ${e.total_membros} ${e.total_membros === 1 ? "membro" : "membros"}${e.supervisor_nome ? ` · ${e.supervisor_nome}` : ""}`,
        extra: "Equipe",
      })),
      usuario: resultados.usuarios.map((u) => ({
        chave: `us-${u.id}`,
        href: area === "web" ? rotas.web.perfilDe(u.id) : rotas.app.perfilDe(u.id),
        tipo: "usuario" as const,
        titulo: u.nome,
        detalhe: u.email ?? u.cargo ?? rotuloDoPerfil[u.perfil],
        extra: rotuloDoPerfil[u.perfil],
      })),
      os: resultados.os.map((o) => ({
        chave: `os-${o.id}`,
        href: area === "web" ? rotas.web.os(o.id) : rotas.app.os(o.id),
        tipo: "os" as const,
        titulo: o.titulo,
        detalhe: [o.numero_ordem ?? "OS de apoio", o.local_instalacao.codigo, o.local_instalacao.cliente].filter(Boolean).join(" · "),
        extra: rotuloDoStatus[o.status],
      })),
    };
    const cotas = { equipe: 1, usuario: 2, os: 2 };
    const tomados = { equipe: 0, usuario: 0, os: 0 };
    const ordem = ["os", "usuario", "equipe"] as const;
    for (const tipo of ordem) tomados[tipo] = Math.min(cotas[tipo], todos[tipo].length);
    let sobram = TOTAL_DE_PREVIAS - ordem.reduce((soma, tipo) => soma + tomados[tipo], 0);
    for (const tipo of ordem) {
      const extra = Math.min(sobram, todos[tipo].length - tomados[tipo]);
      tomados[tipo] += extra;
      sobram -= extra;
    }
    for (const tipo of ordem) itens.push(...todos[tipo].slice(0, tomados[tipo]));
  }
  const buscando = termo.length >= MINIMO_DE_LETRAS;
  const mostrarMenu = menuAberto && buscando;

  const fecharTudo = () => {
    setMenuAberto(false);
    setFaixaAberta(false);
    setAtivo(-1);
  };

  useEffect(() => {
    if (!faixaAberta) return;
    formulario.current?.querySelector("input")?.focus();
  }, [faixaAberta]);

  useEffect(() => {
    if (!faixaAberta && !menuAberto) return;
    const aoClicarFora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (formulario.current?.contains(alvo) || botao.current?.contains(alvo)) return;
      setMenuAberto(false);
      setFaixaAberta(false);
    };
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, [faixaAberta, menuAberto]);

  function aoTeclar(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      if (mostrarMenu) setMenuAberto(false);
      else {
        setFaixaAberta(false);
        botao.current?.focus();
      }
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (itens.length === 0) return;
      e.preventDefault();
      setMenuAberto(true);
      // O ciclo tem uma posição a mais que as prévias: -1 é "nenhuma escolhida" (Enter abre a página de resultados).
      const passo = e.key === "ArrowDown" ? 1 : -1;
      setAtivo((a) => ((a + 1 + passo + itens.length + 1) % (itens.length + 1)) - 1);
    } else if (e.key === "Enter" && ativo >= 0 && itens[ativo]) {
      e.preventDefault();
      router.push(itens[ativo].href);
      fecharTudo();
    }
  }

  return (
    <>
      <form
        ref={formulario}
        id={id}
        className="searchbox"
        data-aberto={faixaAberta}
        action={paginaDeBusca}
        method="get"
        role="search"
        onSubmit={fecharTudo}
      >
        <input type="hidden" name="abrir" value="1" />
        <div className="searchbox-campo">
          {carregando && buscando ? <Icon name="refresh" className="spin" /> : <Icon name="search" />}
          <label className="sr" htmlFor={`${id}-q`}>
            Buscar ordens de serviço, usuários e equipes
          </label>
          <input
            id={`${id}-q`}
            name="q"
            type="search"
            autoComplete="off"
            placeholder="Buscar OS, usuário ou equipe"
            value={texto}
            role="combobox"
            aria-expanded={mostrarMenu}
            aria-controls={`${id}-lista`}
            aria-activedescendant={ativo >= 0 ? `${id}-${ativo}` : undefined}
            onChange={(e) => {
              setTexto(e.target.value);
              setMenuAberto(true);
              setAtivo(-1);
            }}
            onFocus={() => setMenuAberto(true)}
            onKeyDown={aoTeclar}
          />
          {mostrarMenu && (
            <div className="busca-menu" id={`${id}-lista`} role="listbox" aria-label="Resultados da busca">
              {erro && <p className="busca-aviso">Não foi possível buscar agora. Aperte Enter para tentar na página de resultados.</p>}
              {!erro && !resultados && <p className="busca-aviso">Buscando…</p>}
              {!erro && resultados && itens.length === 0 && (
                <p className="busca-aviso">
                  Nada encontrado para <strong>“{termo}”</strong>.
                </p>
              )}
              {itens.map((item, i) => (
                <Link
                  key={item.chave}
                  id={`${id}-${i}`}
                  href={item.href}
                  role="option"
                  aria-selected={i === ativo}
                  className="busca-item"
                  onClick={fecharTudo}
                  onMouseEnter={() => setAtivo(i)}
                >
                  <span className={`ic ${item.tipo === "os" ? "os" : item.tipo === "equipe" ? "eq" : "us"}`}>
                    <Icon name={item.tipo === "os" ? "clip" : item.tipo === "equipe" ? "users" : "user"} size={16} />
                  </span>
                  <span className="busca-txt">
                    <span className="busca-tit">{destacar(item.titulo, termo)}</span>
                    <span className="busca-det">{destacar(item.detalhe, termo)}</span>
                  </span>
                  <span className="busca-tag">{item.extra}</span>
                </Link>
              ))}
              <Link href={hrefDeTodos} className="busca-todos" onClick={fecharTudo}>
                <Icon name="search" size={16} />
                Ver todos os resultados para “{termo}”
              </Link>
            </div>
          )}
        </div>
      </form>
      <button
        ref={botao}
        type="button"
        className="bell busca-lupa"
        aria-label="Buscar"
        aria-expanded={faixaAberta}
        aria-controls={id}
        onClick={() => setFaixaAberta((a) => !a)}
      >
        <Icon name={faixaAberta ? "x" : "search"} size={18} />
      </button>
    </>
  );
}
