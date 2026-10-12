import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { alerta, apr, aprResposta, equipe, evidencia, execucao, itemModeloApr, localInstalacao, os, usuario } from "../db/schema";
import type { Deps } from "../deps";
import { dataHoraBr } from "./pdf-formato";

type TarefaAtual = { id: string; referenciaId: string | null };

/** Validade dos links das fotos no e-mail: o supervisor pode abri-lo dias depois. */
const VALIDADE_LINKS_S = 7 * 24 * 3600;

const escaparHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

interface Reprovado {
  texto: string;
  observacao: string | null;
  fotos: string[];
}

/**
 * Tarefa `email_alerta`: `referenciaId` é o `alerta.id`. Só o alerta `bloqueio` vai por e-mail, para o e-mail institucional do destinatário.
 * Reenvio da tarefa não duplica: `email_enviado_em` preenchido encerra sem enviar.
 */
export async function manipularEmailAlerta(deps: Deps, tarefa: TarefaAtual): Promise<void> {
  if (!tarefa.referenciaId) throw new Error("Tarefa email_alerta sem referência ao alerta");
  const { db } = deps;

  const [a] = await db.select().from(alerta).where(eq(alerta.id, tarefa.referenciaId));
  if (!a) throw new Error("Alerta não encontrado");
  if (a.tipo !== "bloqueio" || a.emailEnviadoEm !== null) return;
  // O banco garante a OS em todo alerta de bloqueio (`alerta_alvo`); só a falha de importação vem sem ela.
  const osId = a.osId;
  if (!osId) throw new Error("Alerta de bloqueio sem OS");

  const [destinatario] = await db.select({ email: usuario.email }).from(usuario).where(eq(usuario.id, a.destinatarioId));
  if (!destinatario?.email) return;

  const [base] = await db
    .select({ os, local: localInstalacao, equipe })
    .from(os)
    .innerJoin(localInstalacao, eq(localInstalacao.id, os.localInstalacaoId))
    .innerJoin(equipe, eq(equipe.id, os.equipeId))
    .where(eq(os.id, osId));
  if (!base) throw new Error("OS do alerta não encontrada");

  // A APR do bloqueio: a mais recente concluída até o alerta (a bloqueada, ou a que amparou a execução interrompida).
  const aprs = await db.select().from(apr).where(eq(apr.osId, osId)).orderBy(desc(apr.concluidaEm));
  const aprDoAlerta = aprs.find((x) => x.concluidaEm.getTime() <= a.criadoEm.getTime()) ?? aprs[0];

  let tecnicoId = aprDoAlerta?.preenchidaPor ?? null;
  const reprovados: Reprovado[] = [];
  let interrupcao: { motivo: string; fotos: string[] } | null = null;

  const urlFoto = (caminho: string) => deps.armazenamento.urlAssinada("fotos", caminho, VALIDADE_LINKS_S);

  if (aprDoAlerta) {
    const [interrompida] = await db
      .select()
      .from(execucao)
      .where(and(eq(execucao.aprId, aprDoAlerta.id), eq(execucao.resultado, "interrompida")))
      .limit(1);
    if (interrompida) {
      tecnicoId = interrompida.executorId;
      const fotos = await db.select({ f: evidencia.fotoPath }).from(evidencia).where(eq(evidencia.execucaoId, interrompida.id)).orderBy(asc(evidencia.capturadaEm));
      interrupcao = { motivo: interrompida.motivo ?? "", fotos: await Promise.all(fotos.map((x) => urlFoto(x.f))) };
    }

    const respostas = await db
      .select({ itemId: itemModeloApr.id, texto: itemModeloApr.texto, tipo: itemModeloApr.tipo, bloqueante: itemModeloApr.respostaBloqueante, resposta: aprResposta.resposta, observacao: aprResposta.observacao, ordem: itemModeloApr.ordem })
      .from(aprResposta)
      .innerJoin(itemModeloApr, eq(itemModeloApr.id, aprResposta.itemId))
      .where(eq(aprResposta.aprId, aprDoAlerta.id))
      .orderBy(asc(itemModeloApr.ordem));
    for (const r of respostas) {
      if (r.tipo !== "eliminatorio" || r.bloqueante === null || r.resposta !== r.bloqueante) continue;
      const fotos = await db.select({ f: evidencia.fotoPath }).from(evidencia).where(and(eq(evidencia.aprId, aprDoAlerta.id), eq(evidencia.itemId, r.itemId))).orderBy(asc(evidencia.capturadaEm));
      reprovados.push({ texto: r.texto, observacao: r.observacao, fotos: await Promise.all(fotos.map((x) => urlFoto(x.f))) });
    }
  }

  const [tecnico] = tecnicoId ? await db.select({ nome: usuario.nome, matricula: usuario.matricula }).from(usuario).where(eq(usuario.id, tecnicoId)) : [];
  const numero = base.os.numeroOrdem ?? "(OS de apoio)";
  const link = `${deps.config.painelUrl}/os/${base.os.id}`;
  const nomeTecnico = tecnico ? `${tecnico.nome} (${tecnico.matricula})` : "não identificado";

  const linhas: string[] = [
    `Atividade impedida na OS ${numero}.`,
    "",
    `OS: ${numero} — ${base.os.titulo}`,
    `Local: ${base.local.codigo}`,
    `Equipe: ${base.equipe.nome}`,
    `Técnico: ${nomeTecnico}`,
    `Registrado em: ${dataHoraBr(a.criadoEm)}`,
  ];
  if (a.detalhe) linhas.push(`Detalhe: ${a.detalhe}`);
  if (interrupcao) {
    linhas.push("", "Execução interrompida por risco.", `Motivo: ${interrupcao.motivo}`);
    interrupcao.fotos.forEach((u, i) => linhas.push(`Foto ${i + 1}: ${u}`));
  }
  if (reprovados.length > 0) {
    linhas.push("", "Itens reprovados:");
    reprovados.forEach((r, i) => {
      linhas.push(`${i + 1}. ${r.texto}`);
      if (r.observacao) linhas.push(`   Observação: ${r.observacao}`);
      r.fotos.forEach((u, k) => linhas.push(`   Foto ${k + 1}: ${u}`));
    });
  }
  linhas.push("", `Abrir no painel: ${link}`);

  const li = (s: string) => `<li>${s}</li>`;
  const links = (urls: string[]) => urls.map((u, k) => `<a href="${escaparHtml(u)}">Foto ${k + 1}</a>`).join(" · ");
  const html = [
    `<p><strong>Atividade impedida na OS ${escaparHtml(numero)}.</strong></p>`,
    "<ul>",
    li(`<strong>OS:</strong> ${escaparHtml(numero)} — ${escaparHtml(base.os.titulo)}`),
    li(`<strong>Local:</strong> ${escaparHtml(base.local.codigo)}`),
    li(`<strong>Equipe:</strong> ${escaparHtml(base.equipe.nome)}`),
    li(`<strong>Técnico:</strong> ${escaparHtml(nomeTecnico)}`),
    li(`<strong>Registrado em:</strong> ${dataHoraBr(a.criadoEm)}`),
    a.detalhe ? li(`<strong>Detalhe:</strong> ${escaparHtml(a.detalhe)}`) : "",
    "</ul>",
    interrupcao ? `<p><strong>Execução interrompida por risco.</strong><br>Motivo: ${escaparHtml(interrupcao.motivo)}<br>${links(interrupcao.fotos)}</p>` : "",
    reprovados.length > 0
      ? `<p><strong>Itens reprovados:</strong></p><ol>${reprovados
          .map((r) => li(`${escaparHtml(r.texto)}${r.observacao ? `<br>Observação: ${escaparHtml(r.observacao)}` : ""}${r.fotos.length ? `<br>${links(r.fotos)}` : ""}`))
          .join("")}</ol>`
      : "",
    `<p><a href="${escaparHtml(link)}">Abrir a OS no painel</a></p>`,
  ].join("\n");

  await deps.email.enviar({ para: destinatario.email, assunto: `[D.A.P.R.O.M] Atividade impedida — OS ${numero}`, texto: linhas.join("\n"), html });

  // Condicional: duas tarefas simultâneas (ou um reenvio) não marcam duas vezes.
  await db.update(alerta).set({ emailEnviadoEm: deps.agora() }).where(and(eq(alerta.id, a.id), isNull(alerta.emailEnviadoEm)));
}
