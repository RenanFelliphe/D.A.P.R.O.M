import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  ALVO_DO_AVISO,
  CATEGORIA_DO_AVISO,
  caminhoDoAviso,
  ehCategoriaObrigatoria,
  emailLigado,
  ROTULO_DA_CATEGORIA,
  ROTULO_DO_AVISO,
  type CategoriaDeEmail,
} from "../../../shared/notificacoes/avisos";
import { alerta, apr, aprResposta, atividade, ausencia, equipe, evidencia, execucao, itemModeloApr, localInstalacao, os, sugestaoMateriais, treinamentoServico, usuario } from "../db/schema";
import type { Deps } from "../deps";
import { bucketDaEvidencia } from "../dominio/evidencias";
import { escaparHtml, montarEmail, type PartesDoEmail } from "./email-modelo";
import { dataHoraBr } from "./pdf-formato";

type TarefaAtual = { id: string; referenciaId: string | null };
type LinhaAlerta = typeof alerta.$inferSelect;

/** Validade dos links das fotos e dos PDFs no e-mail: o supervisor pode abri-lo dias depois. */
const VALIDADE_LINKS_S = 7 * 24 * 3600;

/** Por que a pessoa recebe e como deixar de receber (as categorias obrigatórias não desligam). */
export function rodapeDoEmail(categoria: CategoriaDeEmail, painelUrl: string): string {
  if (ehCategoriaObrigatoria(categoria)) return "Este aviso é enviado sempre: é sobre a segurança do campo ou sobre a sua conta no SYNQ OS.";
  return `Você recebe este e-mail porque os avisos de "${ROTULO_DA_CATEGORIA[categoria]}" estão ligados nas suas configurações. Para deixar de recebê-los, desligue em ${painelUrl}/app/configuracoes/conta#emails; o aviso continua no sino do SYNQ OS.`;
}

/** Um arquivo de evidência no e-mail: "Foto 2" ou "PDF 1: laudo.pdf", com o link assinado. */
interface Anexo {
  rotulo: string;
  url: string;
}

interface Reprovado {
  texto: string;
  observacao: string | null;
  anexos: Anexo[];
}

const colunasDoAnexo = { tipo: evidencia.tipo, caminho: evidencia.fotoPath, nome: evidencia.nomeArquivo };

/** As fotos e os PDFs de uma evidência, numerados cada um na sua série e com o link que vale por 7 dias. */
function anexosDe(deps: Deps, linhas: { tipo: "foto" | "pdf"; caminho: string; nome: string | null }[]): Promise<Anexo[]> {
  let fotos = 0;
  let pdfs = 0;
  const rotulos = linhas.map((e) => (e.tipo === "pdf" ? `PDF ${++pdfs}: ${e.nome ?? "documento"}` : `Foto ${++fotos}`));
  return Promise.all(linhas.map(async (e, i) => ({ rotulo: rotulos[i]!, url: await deps.armazenamento.urlAssinada(bucketDaEvidencia(e.tipo), e.caminho, VALIDADE_LINKS_S) })));
}

/**
 * O e-mail da atividade impedida (APR bloqueada ou execução interrompida por risco): a OS, o local, a equipe, o técnico, os
 * itens reprovados com a observação e os links das fotos e dos PDFs, e o link do painel.
 */
async function conteudoDoBloqueio(deps: Deps, a: LinhaAlerta): Promise<{ assunto: string } & PartesDoEmail> {
  const { db } = deps;
  // O banco garante a OS em todo alerta de bloqueio (`alerta_alvo`).
  const osId = a.osId;
  if (!osId) throw new Error("Alerta de bloqueio sem OS");
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
  let interrupcao: { motivo: string; anexos: Anexo[] } | null = null;

  if (aprDoAlerta) {
    const [interrompida] = await db
      .select()
      .from(execucao)
      .where(and(eq(execucao.aprId, aprDoAlerta.id), eq(execucao.resultado, "interrompida")))
      .limit(1);
    if (interrompida) {
      tecnicoId = interrompida.executorId;
      const arquivos = await db.select(colunasDoAnexo).from(evidencia).where(eq(evidencia.execucaoId, interrompida.id)).orderBy(asc(evidencia.capturadaEm), asc(evidencia.id));
      interrupcao = { motivo: interrompida.motivo ?? "", anexos: await anexosDe(deps, arquivos) };
    }

    const respostas = await db
      .select({ itemId: itemModeloApr.id, texto: itemModeloApr.texto, tipo: itemModeloApr.tipo, bloqueante: itemModeloApr.respostaBloqueante, resposta: aprResposta.resposta, observacao: aprResposta.observacao, ordem: itemModeloApr.ordem })
      .from(aprResposta)
      .innerJoin(itemModeloApr, eq(itemModeloApr.id, aprResposta.itemId))
      .where(eq(aprResposta.aprId, aprDoAlerta.id))
      .orderBy(asc(itemModeloApr.ordem));
    for (const r of respostas) {
      if (r.tipo !== "eliminatorio" || r.bloqueante === null || r.resposta !== r.bloqueante) continue;
      const arquivos = await db
        .select(colunasDoAnexo)
        .from(evidencia)
        .where(and(eq(evidencia.aprId, aprDoAlerta.id), eq(evidencia.itemId, r.itemId)))
        .orderBy(asc(evidencia.capturadaEm), asc(evidencia.id));
      reprovados.push({ texto: r.texto, observacao: r.observacao, anexos: await anexosDe(deps, arquivos) });
    }
  }

  const [tecnico] = tecnicoId ? await db.select({ nome: usuario.nome, matricula: usuario.matricula }).from(usuario).where(eq(usuario.id, tecnicoId)) : [];
  const numero = base.os.numeroOrdem ?? "(OS de apoio)";
  const nomeTecnico = tecnico ? `${tecnico.nome} (${tecnico.matricula})` : "não identificado";

  const textoExtra: string[] = [];
  const blocos: string[] = [];
  const links = (anexos: Anexo[]) => anexos.map((x) => `<a href="${escaparHtml(x.url)}" style="color:#0F5C78">${escaparHtml(x.rotulo)}</a>`).join(" · ");
  if (interrupcao) {
    textoExtra.push("Execução interrompida por risco.", `Motivo: ${interrupcao.motivo}`);
    interrupcao.anexos.forEach((x) => textoExtra.push(`${x.rotulo}: ${x.url}`));
    textoExtra.push("");
    blocos.push(
      `<p style="margin:0 0 14px;font-size:14px;line-height:1.5;color:#17212B"><strong>Execução interrompida por risco.</strong><br>Motivo: ${escaparHtml(interrupcao.motivo)}${interrupcao.anexos.length ? `<br>${links(interrupcao.anexos)}` : ""}</p>`,
    );
  }
  if (reprovados.length > 0) {
    textoExtra.push("Itens reprovados:");
    reprovados.forEach((r, i) => {
      textoExtra.push(`${i + 1}. ${r.texto}`);
      if (r.observacao) textoExtra.push(`   Observação: ${r.observacao}`);
      r.anexos.forEach((x) => textoExtra.push(`   ${x.rotulo}: ${x.url}`));
    });
    blocos.push(
      `<p style="margin:0 0 6px;font-size:14px;color:#17212B"><strong>Itens reprovados:</strong></p><ol style="margin:0 0 14px;padding-left:20px;color:#17212B">${reprovados
        .map(
          (r) =>
            `<li style="margin:0 0 8px;font-size:14px;line-height:1.4">${escaparHtml(r.texto)}${r.observacao ? `<br>Observação: ${escaparHtml(r.observacao)}` : ""}${r.anexos.length ? `<br>${links(r.anexos)}` : ""}</li>`,
        )
        .join("")}</ol>`,
    );
  }

  return {
    assunto: `[SYNQ OS] Atividade impedida — OS ${numero}`,
    titulo: `Atividade impedida na OS ${numero}`,
    urgente: true,
    itens: [
      { rotulo: "OS", valor: `${numero} — ${base.os.titulo}` },
      { rotulo: "Local", valor: base.local.codigo },
      { rotulo: "Equipe", valor: base.equipe.nome },
      { rotulo: "Técnico", valor: nomeTecnico },
      { rotulo: "Registrado em", valor: dataHoraBr(a.criadoEm) },
      ...(a.detalhe ? [{ rotulo: "Detalhe", valor: a.detalhe }] : []),
    ],
    textoExtra,
    htmlExtra: blocos.join(""),
    botao: { texto: "Abrir a OS no painel", url: `${deps.config.painelUrl}/app/os/${base.os.id}` },
    rodape: rodapeDoEmail("seguranca", deps.config.painelUrl),
  };
}

const alvoDoAviso = alias(usuario, "alvo_do_aviso");

/**
 * O e-mail dos demais avisos: o rótulo do aviso no título, o texto do sino, o que ele aponta (a OS, a pessoa, a equipe, o
 * treinamento) e o botão para abrir no painel, no mesmo lugar para onde o sino leva.
 */
async function conteudoDoAviso(deps: Deps, a: LinhaAlerta): Promise<{ assunto: string } & PartesDoEmail> {
  const { db } = deps;
  const [r] = await db
    .select({
      numeroOrdem: os.numeroOrdem,
      tituloOs: os.titulo,
      localCodigo: localInstalacao.codigo,
      equipeDaOs: equipe.nome,
      alvoNome: alvoDoAviso.nome,
      alvoMatricula: alvoDoAviso.matricula,
      ausenciaEquipeId: ausencia.equipeId,
      treinamentoCodigo: treinamentoServico.atividadeCodigo,
      servicoDescricao: atividade.descricao,
      sugestaoServico: sugestaoMateriais.atividadeCodigo,
    })
    .from(alerta)
    .leftJoin(os, eq(os.id, alerta.osId))
    .leftJoin(localInstalacao, eq(localInstalacao.id, os.localInstalacaoId))
    .leftJoin(equipe, eq(equipe.id, os.equipeId))
    .leftJoin(alvoDoAviso, eq(alvoDoAviso.id, alerta.usuarioAlvoId))
    .leftJoin(ausencia, eq(ausencia.id, alerta.ausenciaId))
    .leftJoin(treinamentoServico, eq(treinamentoServico.id, alerta.treinamentoId))
    .leftJoin(sugestaoMateriais, eq(sugestaoMateriais.id, alerta.sugestaoMateriaisId))
    .leftJoin(atividade, eq(atividade.codigo, sql`coalesce(${treinamentoServico.atividadeCodigo}, ${sugestaoMateriais.atividadeCodigo}, ${alerta.atividadeCodigo})`))
    .where(eq(alerta.id, a.id));
  const [equipeAlvo] = a.equipeId ? await db.select({ nome: equipe.nome }).from(equipe).where(eq(equipe.id, a.equipeId)) : [];

  const alvo = ALVO_DO_AVISO[a.tipo];
  const itens: { rotulo: string; valor: string }[] = [];
  let sufixo = "";
  if (alvo === "os" && r?.tituloOs) {
    const numero = r.numeroOrdem ?? "(OS de apoio)";
    sufixo = ` — OS ${numero}`;
    itens.push({ rotulo: "OS", valor: `${numero} — ${r.tituloOs}` });
    if (r.localCodigo) itens.push({ rotulo: "Local", valor: r.localCodigo });
    if (r.equipeDaOs) itens.push({ rotulo: "Equipe", valor: r.equipeDaOs });
  } else if ((alvo === "usuario" || alvo === "ausencia") && r?.alvoNome && a.usuarioAlvoId !== a.destinatarioId) {
    sufixo = ` — ${r.alvoNome}`;
    itens.push({ rotulo: "Pessoa", valor: `${r.alvoNome}${r.alvoMatricula ? ` (matrícula ${r.alvoMatricula})` : ""}` });
  } else if (alvo === "equipe" && equipeAlvo) {
    sufixo = ` — ${equipeAlvo.nome}`;
    itens.push({ rotulo: "Equipe", valor: equipeAlvo.nome });
  } else if (alvo === "treinamento" && r?.treinamentoCodigo) {
    const servico = r.servicoDescricao ? `${r.treinamentoCodigo} · ${r.servicoDescricao}` : r.treinamentoCodigo;
    sufixo = ` — ${r.servicoDescricao ?? r.treinamentoCodigo}`;
    itens.push({ rotulo: "Serviço", valor: servico });
  } else if (alvo === "sugestao" && r?.sugestaoServico) {
    sufixo = ` — ${r.servicoDescricao ?? r.sugestaoServico}`;
    itens.push({ rotulo: "Serviço", valor: r.servicoDescricao ? `${r.sugestaoServico} · ${r.servicoDescricao}` : r.sugestaoServico });
  }
  itens.push({ rotulo: "Registrado em", valor: dataHoraBr(a.criadoEm) });

  const caminho = caminhoDoAviso({
    id: a.id,
    tipo: a.tipo,
    destinatarioId: a.destinatarioId,
    osId: a.osId,
    ausenciaEquipeId: r?.ausenciaEquipeId ?? null,
    usuarioAlvoId: a.usuarioAlvoId,
    equipeAlvoId: a.equipeId,
    treinamentoCodigo: r?.treinamentoCodigo ?? null,
    sugestaoId: a.sugestaoMateriaisId,
    servicoCodigo: r?.sugestaoServico ?? a.atividadeCodigo,
  });
  // Quem teve o acesso recusado não entra mais: não há o que abrir.
  const botao = a.tipo === "acesso_recusado" ? undefined : { texto: a.tipo === "conta_criada" || a.tipo === "senha_redefinida" ? "Entrar no SYNQ OS" : "Abrir no SYNQ OS", url: `${deps.config.painelUrl}${caminho}` };
  const rotulo = ROTULO_DO_AVISO[a.tipo];
  return {
    assunto: `[SYNQ OS] ${rotulo}${sufixo}`,
    titulo: rotulo,
    urgente: a.tipo === "emergencia" || a.tipo === "preventiva_vencida" || a.tipo === "ausencia_vencida" || a.tipo === "falha_importacao" || a.tipo === "rh_leitura_falhou",
    paragrafos: [a.detalhe],
    itens,
    ...(botao ? { botao } : {}),
    rodape: rodapeDoEmail(CATEGORIA_DO_AVISO[a.tipo]!, deps.config.painelUrl),
  };
}

/**
 * Tarefa `email_alerta`: `referenciaId` é o `alerta.id`. Envia o aviso por e-mail ao e-mail institucional do destinatário
 * quando: o servidor de e-mail está configurado, o tipo tem categoria de e-mail, a pessoa está ativa (menos no acesso recusado,
 * que é o aviso de que ela não entra mais) e não desligou a categoria no perfil. Fora isso, termina sem enviar: o aviso fica
 * no sino. Reenvio da tarefa não duplica: `email_enviado_em` preenchido encerra sem enviar.
 */
export async function manipularEmailAlerta(deps: Deps, tarefa: TarefaAtual): Promise<void> {
  if (!tarefa.referenciaId) throw new Error("Tarefa email_alerta sem referência ao alerta");
  const { db } = deps;

  const [a] = await db.select().from(alerta).where(eq(alerta.id, tarefa.referenciaId));
  // O aviso pode ter sido apagado junto com a conta (o cadastro pendente cancelado): não há o que enviar.
  if (!a || a.emailEnviadoEm !== null) return;
  if (!deps.email.configurado || CATEGORIA_DO_AVISO[a.tipo] === null) return;

  const [destinatario] = await db
    .select({ email: usuario.email, ativo: usuario.ativo, emailsDesligados: usuario.emailsDesligados })
    .from(usuario)
    .where(eq(usuario.id, a.destinatarioId));
  if (!destinatario?.email) return;
  if (!destinatario.ativo && a.tipo !== "acesso_recusado") return;
  if (!emailLigado(a.tipo, destinatario.emailsDesligados)) return;

  const { assunto, ...partes } = a.tipo === "bloqueio" ? await conteudoDoBloqueio(deps, a) : await conteudoDoAviso(deps, a);
  const { texto, html } = montarEmail(partes);
  await deps.email.enviar({ para: destinatario.email, assunto, texto, html });

  // Condicional: duas tarefas simultâneas (ou um reenvio) não marcam duas vezes.
  await db.update(alerta).set({ emailEnviadoEm: deps.agora() }).where(and(eq(alerta.id, a.id), isNull(alerta.emailEnviadoEm)));
}
