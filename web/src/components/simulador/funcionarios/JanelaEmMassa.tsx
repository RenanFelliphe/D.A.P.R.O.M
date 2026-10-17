"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { JanelaModal } from "@/components/web/JanelaModal";
import { chamar } from "@/lib/cliente-api";
import { useToast } from "@/state/toast";
import { rotuloDaSituacao, type AcaoEmMassa, type CatalogoDeFuncionarios, type ListaDeFuncionarios, type RecusadoEmMassa, type SituacaoFuncionario } from "./tipos";

interface JanelaEmMassaProps {
  acao: AcaoEmMassa;
  catalogo: CatalogoDeFuncionarios;
  /** Matrículas marcadas; com `todosDaBusca`, a busca é que vale. */
  matriculas: string[];
  todosDaBusca: boolean;
  busca?: string;
  /** Os da página, para contar quantos têm conta no SYNQ OS sem nova consulta. */
  daPagina: { matricula: string; tem_conta: boolean }[];
  aoFechar: (concluiu: boolean) => void;
}

const titulos: Record<AcaoEmMassa, string> = { excluir: "Excluir funcionários", mudar_setor: "Mudar o setor", mudar_situacao: "Mudar a situação" };

/** Quantos funcionários da busca têm conta no SYNQ OS: lê todas as páginas da busca (a seleção pode passar da página). */
async function contarContasDaBusca(busca: string | undefined): Promise<{ total: number; comConta: number }> {
  let total = 0;
  let comConta = 0;
  for (let pagina = 1; pagina <= 100; pagina++) {
    const consulta = new URLSearchParams({ pagina: String(pagina), tamanho: "200" });
    if (busca) consulta.set("busca", busca);
    const r = await chamar<ListaDeFuncionarios>("GET", `/rh-simulado/gestao/funcionarios?${consulta}`);
    total = r.total;
    comConta += r.funcionarios.filter((f) => f.conta_no_synq_os).length;
    if (pagina * 200 >= r.total) break;
  }
  return { total, comConta };
}

/**
 * Confirmação de uma ação em massa (`POST /rh-simulado/gestao/funcionarios/em-massa`). Antes de aplicar, diz quantos dos
 * selecionados têm conta no SYNQ OS e o que vai acontecer com eles: desligar desativa a conta na hora; excluir não vale para quem
 * tem conta. Depois, lista os recusados com o motivo.
 */
export function JanelaEmMassa({ acao, catalogo, matriculas, todosDaBusca, busca, daPagina, aoFechar }: JanelaEmMassaProps) {
  const router = useRouter();
  const exibirAviso = useToast();
  const [centro, setCentro] = useState(catalogo.setores[0]?.centro_trabalho ?? "");
  const [situacao, setSituacao] = useState<SituacaoFuncionario>("desligado");
  const [contas, setContas] = useState<{ total: number; comConta: number } | null>(
    todosDaBusca ? null : { total: matriculas.length, comConta: matriculas.filter((m) => daPagina.find((f) => f.matricula === m)?.tem_conta).length },
  );
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [recusados, setRecusados] = useState<RecusadoEmMassa[] | null>(null);

  useEffect(() => {
    if (!todosDaBusca) return;
    let ativo = true;
    contarContasDaBusca(busca)
      .then((r) => ativo && setContas(r))
      .catch((e) => ativo && setErro(e instanceof Error ? e.message : "Não foi possível contar os funcionários"));
    return () => {
      ativo = false;
    };
  }, [todosDaBusca, busca]);

  async function aplicar() {
    setErro(null);
    setOcupado(true);
    try {
      const corpo = {
        ...(todosDaBusca ? { todos_da_busca: true, ...(busca ? { busca } : {}) } : { matriculas }),
        acao,
        ...(acao === "mudar_setor" ? { valor: centro } : acao === "mudar_situacao" ? { valor: situacao } : {}),
      };
      const r = await chamar<{ afetados: number; recusados: RecusadoEmMassa[] }>("POST", "/rh-simulado/gestao/funcionarios/em-massa", corpo);
      exibirAviso(r.afetados === 1 ? "1 funcionário atualizado." : `${r.afetados} funcionários atualizados.`);
      router.refresh();
      if (r.recusados.length > 0) setRecusados(r.recusados);
      else aoFechar(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível aplicar a ação");
    } finally {
      setOcupado(false);
    }
  }

  if (recusados) {
    return (
      <JanelaModal titulo={titulos[acao]} aoFechar={() => aoFechar(true)}>
        <Notice tone="al" icon="alert">
          {recusados.length === 1 ? "1 funcionário foi recusado:" : `${recusados.length} funcionários foram recusados:`}
        </Notice>
        <ul className="sim-recusados">
          {recusados.map((r) => (
            <li key={r.matricula}>
              <span className="mono">{r.matricula}</span> — {r.motivo}
            </li>
          ))}
        </ul>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <Button variant="p" sm onClick={() => aoFechar(true)}>
            Fechar
          </Button>
        </div>
      </JanelaModal>
    );
  }

  const quantos = contas?.total ?? matriculas.length;
  const comConta = contas?.comConta ?? 0;
  const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);
  return (
    <JanelaModal titulo={titulos[acao]} aoFechar={() => aoFechar(false)}>
      <p style={{ fontSize: 14 }}>
        {acao === "excluir" && <>Excluir {contas ? `${quantos} ${plural(quantos, "funcionário", "funcionários")}` : "os funcionários selecionados"} do registro?</>}
        {acao === "mudar_setor" && <>Mudar o setor de {contas ? `${quantos} ${plural(quantos, "funcionário", "funcionários")}` : "os funcionários selecionados"}.</>}
        {acao === "mudar_situacao" && <>Mudar a situação de {contas ? `${quantos} ${plural(quantos, "funcionário", "funcionários")}` : "os funcionários selecionados"}.</>}
      </p>
      {acao === "mudar_setor" && (
        <Field label="Novo setor">
          <select className="input" value={centro} onChange={(e) => setCentro(e.target.value)}>
            {catalogo.setores.map((s) => (
              <option key={s.centro_trabalho} value={s.centro_trabalho}>
                {s.centro_trabalho} · {s.nome}
              </option>
            ))}
          </select>
        </Field>
      )}
      {acao === "mudar_situacao" && (
        <Field label="Nova situação">
          <select className="input" value={situacao} onChange={(e) => setSituacao(e.target.value as SituacaoFuncionario)}>
            {catalogo.situacoes.map((s) => (
              <option key={s} value={s}>
                {rotuloDaSituacao[s]}
              </option>
            ))}
          </select>
        </Field>
      )}
      {contas === null && !erro && <p className="small">Contando quantos têm conta no SYNQ OS…</p>}
      {contas && (
        <Notice tone={comConta > 0 && (acao !== "mudar_setor") ? "al" : "info"} icon={comConta > 0 ? "alert" : "info"}>
          {comConta === 0 && "Nenhum deles tem conta no SYNQ OS: nada muda lá."}
          {comConta > 0 && acao === "excluir" && `${comConta} ${plural(comConta, "tem", "têm")} conta no SYNQ OS e não ${plural(comConta, "será excluído", "serão excluídos")}: quem tem conta deve ser desligado, não excluído. Os demais são excluídos.`}
          {comConta > 0 && acao === "mudar_setor" && `${comConta} ${plural(comConta, "tem", "têm")} conta no SYNQ OS. O setor só sugere a equipe no cadastro: a equipe da conta não muda.`}
          {comConta > 0 && acao === "mudar_situacao" && situacao === "desligado" && `${comConta} ${plural(comConta, "tem", "têm")} conta no SYNQ OS: desligar avisa o SYNQ OS, e a conta é desativada em segundos.`}
          {comConta > 0 && acao === "mudar_situacao" && situacao === "afastado" && `${comConta} ${plural(comConta, "tem", "têm")} conta no SYNQ OS: o afastamento só é anotado lá, e o acesso não muda.`}
          {comConta > 0 && acao === "mudar_situacao" && situacao === "ativo" && `${comConta} ${plural(comConta, "tem", "têm")} conta no SYNQ OS: o SYNQ OS nunca reativa uma conta sozinho. Quem estava desativada continua assim até um admin reativar.`}
        </Notice>
      )}
      {erro && (
        <Notice tone="blq" icon="alert">
          {erro}
        </Notice>
      )}
      <div className="row g8" style={{ justifyContent: "flex-end" }}>
        <Button variant="line" sm onClick={() => aoFechar(false)} disabled={ocupado}>
          Cancelar
        </Button>
        <Button variant={acao === "excluir" ? "d" : "p"} sm onClick={aplicar} disabled={ocupado || (todosDaBusca && contas === null)}>
          {ocupado ? "Aplicando…" : acao === "excluir" ? "Excluir" : "Aplicar"}
        </Button>
      </div>
    </JanelaModal>
  );
}
