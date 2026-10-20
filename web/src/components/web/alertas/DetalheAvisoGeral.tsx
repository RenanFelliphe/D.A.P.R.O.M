import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { Panel } from "@/components/web/Panel";
import { apiOuNulo } from "@/lib/api";
import { dataHora } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";
import { ehAdmin, type Usuario } from "@/lib/tipos";
import { BotaoReativarConta } from "./BotaoReativarConta";
import { MarcarLidoAoAbrir } from "./MarcarLidoAoAbrir";
import { aparenciaDoAlerta, ehDoUsuario, perfilAgeSobreAlertas, rotuloDaLeitura, rotuloDoAlerta, type Alerta } from "./tipos";

/** O título do painel: de quem ou do que o aviso fala. */
function tituloDoAviso(a: Alerta): string {
  switch (a.tipo) {
    case "equipe_sem_supervisor":
      return a.equipe_alvo_nome ? `Equipe ${a.equipe_alvo_nome}` : "Equipe sem supervisor";
    case "rh_leitura_falhou":
      return "Registro de funcionários";
    case "vitoria_sem_ia":
      return "Vitória sem IA";
    case "treinamento_publicado":
    case "treinamento_problema":
      return a.treinamento_codigo ? `Treinamento do serviço ${a.treinamento_codigo}` : "Treinamento de serviço";
    case "sugestao_materiais_nova":
    case "contestacao_materiais_nova":
    case "sugestao_materiais_aceita":
    case "sugestao_materiais_recusada":
    case "materiais_atualizados":
      return a.servico_codigo ? `Materiais do serviço ${a.servico_codigo}` : "Materiais do serviço";
    default:
      return a.usuario_alvo_nome ?? rotuloDoAlerta(a);
  }
}

/** O atalho do canto: para onde ir resolver o que o aviso pede. */
function atalhoDoAviso(a: Alerta, usuario: Usuario): { rotulo: string; href: string } | null {
  switch (a.tipo) {
    case "cadastro_pendente":
      return { rotulo: "Abrir os cadastros pendentes", href: `${rotas.app.usuarios}?liberacao=pendente` };
    case "funcionario_readmitido":
    case "membro_desativado":
    case "cadastro_liberado":
      return a.usuario_alvo_id ? { rotulo: "Abrir o perfil", href: rotas.app.perfilDe(a.usuario_alvo_id) } : null;
    case "cadastro_recusado":
      return { rotulo: "Abrir Minha equipe", href: rotas.app.usuarios };
    case "equipe_sem_supervisor":
      return a.equipe_alvo_id ? { rotulo: "Abrir a equipe", href: rotas.app.equipe(a.equipe_alvo_id) } : null;
    case "rh_leitura_falhou":
      return { rotulo: "Abrir o registro de funcionários", href: rotas.app.usuarios };
    case "vitoria_sem_ia":
      return { rotulo: "Abrir o perfil da Vitória", href: rotas.app.perfilDaVitoria };
    case "treinamento_problema":
      return a.treinamento_codigo && ehAdmin(usuario) ? { rotulo: "Ver os problemas reportados", href: rotas.app.treinamentoServico(a.treinamento_codigo, "problemas") } : null;
    case "treinamento_publicado":
      return a.treinamento_codigo ? { rotulo: "Jogar o treinamento", href: rotas.app.treinarServico(a.treinamento_codigo) } : null;
    case "sugestao_materiais_nova":
      return a.servico_codigo && a.sugestao_id ? { rotulo: "Avaliar a sugestão", href: rotas.app.sugestaoDeMateriais(a.servico_codigo, a.sugestao_id) } : null;
    case "contestacao_materiais_nova":
      return a.servico_codigo && a.sugestao_id ? { rotulo: "Avaliar a contestação", href: rotas.app.sugestaoDeMateriais(a.servico_codigo, a.sugestao_id) } : null;
    case "sugestao_materiais_aceita":
    case "sugestao_materiais_recusada":
      return a.servico_codigo && a.sugestao_id ? { rotulo: "Abrir a sugestão", href: rotas.app.sugestaoDeMateriais(a.servico_codigo, a.sugestao_id) } : null;
    case "materiais_atualizados":
      return a.servico_codigo ? { rotulo: "Ver a lista do serviço", href: `${rotas.app.catalogo}?busca=${encodeURIComponent(a.servico_codigo)}` } : null;
    default:
      return null;
  }
}

/** O que fazer, em uma frase, para cada tipo. */
const COMO_SEGUIR: Partial<Record<Alerta["tipo"], string>> = {
  cadastro_pendente: "Confira o cadastro e libere ou recuse o acesso em Equipes e usuários. Até lá, a pessoa só faz o Campo de treino.",
  funcionario_readmitido:
    "O sistema nunca devolve o acesso sozinho. Se a pessoa deve voltar a usar o SYNQ OS, reative a conta aqui mesmo; confira antes a equipe e o perfil dela.",
  membro_desativado: "As OS reservadas para a pessoa continuam reservadas: libere-as para a equipe no detalhe de cada OS.",
  equipe_sem_supervisor:
    "Escolha um supervisor para a equipe em Equipes e usuários (editar a equipe). Enquanto isso, o representante responde por ela: aprova as ausências, reserva e devolve OS e recebe os alertas.",
  rh_leitura_falhou:
    "Confira se o registro de funcionários está no ar e use \"Ler agora\" no cartão do registro, na tela de usuários. Os desligamentos que o aviso em tempo real já aplicou continuam valendo.",
  vitoria_sem_ia:
    "A Vitória continua respondendo, pelas sugestões fixas e pela busca no manual. O perfil dela mostra o provedor, o modelo e os limites; o limite do dia volta à meia-noite.",
  treinamento_problema: "Confira a fase no editor do treinamento, corrija se for o caso e marque o reporte como tratado.",
  treinamento_publicado: "O treinamento fica no catálogo de serviço, no serviço dele.",
  sugestao_materiais_nova: "Veja o que muda na lista e aceite (com ou sem ajuste) ou recuse com o motivo. Você recebe porque a sua equipe é a que mais faz este serviço.",
  contestacao_materiais_nova: "Leia o motivo. Para aceitar, a contestação precisa de uma lista nova (a da pessoa, se ela mandou uma, ou a sua); senão, recuse com o motivo.",
  sugestao_materiais_aceita: "A lista do serviço já foi atualizada. Quem aceita e quem sugere ganham pontos, na regra Colaboração.",
  sugestao_materiais_recusada: "Você pode enviar outra sugestão para o mesmo serviço quando quiser.",
  materiais_atualizados: "A nova lista já aparece em Materiais recomendados, no detalhe da OS e no catálogo.",
  cadastro_liberado: "A pessoa já usa o sistema todo; no primeiro acesso, ela cadastra a assinatura.",
  cadastro_recusado: "O cadastro recusado não entra mais. O administrador pode excluí-lo para liberar o e-mail e a matrícula.",
};

/**
 * Detalhe dos avisos que não são de OS: a conta de uma pessoa (cadastro, acesso, desligamento, readmissão), a equipe sem supervisor,
 * a leitura do registro de funcionários que falhou, o treinamento e a Vitória sem IA. Mostra o texto do aviso, o atalho para onde
 * se resolve e, na readmissão, o botão de reativar a conta (só o admin, e só enquanto a conta está desativada).
 */
export async function DetalheAvisoGeral({ alerta, usuario, marcarAoAbrir }: { alerta: Alerta; usuario: Usuario; marcarAoAbrir: boolean }) {
  const { icone, urgente } = aparenciaDoAlerta(alerta);
  const naoLido = alerta.lido_em === null;
  const atalho = atalhoDoAviso(alerta, usuario);
  const comoSeguir = COMO_SEGUIR[alerta.tipo];
  // A readmissão: o botão só aparece para o admin e enquanto a conta continua desativada.
  const conta =
    alerta.tipo === "funcionario_readmitido" && alerta.usuario_alvo_id && ehAdmin(usuario)
      ? (await apiOuNulo<{ usuario: Pick<Usuario, "id" | "nome" | "ativo"> }>(`/usuarios/${alerta.usuario_alvo_id}`))?.usuario ?? null
      : null;

  return (
    <Panel style={{ padding: "20px 22px", gap: 16 }}>
      <div className="row between wrap" style={{ alignItems: "flex-start" }}>
        <div className="stack g6" style={{ minWidth: 0 }}>
          <div className="row wrap g8">
            <Badge tone={urgente ? "blq" : "lib"}>
              <Icon name={icone} size={13} />
              {rotuloDoAlerta(alerta)}
            </Badge>
            <Badge tone="neu">{rotuloDaLeitura(alerta, usuario)}</Badge>
          </div>
          <h2 style={{ fontSize: 21, lineHeight: 1.25 }}>{tituloDoAviso(alerta)}</h2>
        </div>
        {atalho && (
          <Link href={atalho.href} style={{ fontSize: 14, fontWeight: 600 }}>
            {atalho.rotulo}
          </Link>
        )}
      </div>

      <Notice tone={urgente ? "blq" : "info"} icon={urgente ? "alert" : "info"} style={{ fontSize: 14.5 }}>
        {alerta.detalhe}
      </Notice>

      <dl className="dl d2">
        <div>
          <dt>Quando</dt>
          <dd>
            {dataHora(alerta.criado_em)}
            {alerta.email_enviado_em ? ` · e-mail enviado em ${dataHora(alerta.email_enviado_em)}` : ""}
          </dd>
        </div>
        {comoSeguir && (
          <div>
            <dt>Como seguir</dt>
            <dd>{comoSeguir}</dd>
          </div>
        )}
      </dl>

      {conta &&
        (conta.ativo ? (
          <Notice tone="off" icon="info" style={{ fontSize: 14 }}>
            A conta de {conta.nome} já foi reativada.
          </Notice>
        ) : (
          <BotaoReativarConta usuarioId={conta.id} nome={conta.nome} />
        ))}

      {perfilAgeSobreAlertas(usuario) && naoLido && marcarAoAbrir && ehDoUsuario(alerta, usuario) && <MarcarLidoAoAbrir alertaId={alerta.id} />}
    </Panel>
  );
}
