/**
 * Teste do schema: aplica as migrações num Postgres embutido (PGlite) e confere que o banco aceita o fluxo
 * válido e recusa o inválido. Rodar com `pnpm db:test`.
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { join } from "node:path";

const db = new PGlite();
// Usa o migrador oficial do Drizzle, o mesmo que a api usará: aplica db/migrations em ordem.
await migrate(drizzle(db), { migrationsFolder: join(import.meta.dirname, "..", "migrations") });
console.log("ok  migrações aplicadas");

const tabelas = (await db.query(
  "select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by 1",
)).rows;
console.log("\ntabelas:", tabelas.length, "| sem RLS:", tabelas.filter((t) => !t.relrowsecurity).map((t) => t.relname));

let falhas = 0;
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
async function deve(nome, sql, params = []) {
  try { await db.query(sql, params); console.log("ok  aceita ", nome); }
  catch (e) { falhas++; console.log("XX  deveria aceitar:", nome, "->", e.message); }
}
async function recusa(nome, sql, params = []) {
  try { await db.query(sql, params); falhas++; console.log("XX  deveria recusar:", nome); }
  catch (e) { console.log("ok  recusa ", nome, "·", e.message.split("\n")[0].slice(0, 70)); }
}

// base
await deve("equipe", `insert into equipe (id,nome,centro_trabalho) values ('${id(1)}','Serviços Especiais','SERV_ESP')`);
await deve("usuário técnico", `insert into usuario (id,nome,matricula,email,perfil,equipe_id) values ('${id(10)}','Carlos','10482','carlos.silva@empresa.com.br','tecnico','${id(1)}')`);
await deve("usuário técnico 2", `insert into usuario (id,nome,matricula,email,perfil,equipe_id) values ('${id(11)}','Diego','10483','diego.souza@empresa.com.br','tecnico','${id(1)}')`);
await deve("usuário com cargo e CREA", `update usuario set cargo='Técnico em Elétrica', registro_profissional='ES-050003/D' where id='${id(11)}'`);
await recusa("usuário sem e-mail", `insert into usuario (id,nome,matricula,perfil) values ('${id(12)}','Marcos','90001','tecnico')`);
await deve("técnico (futuro supervisor) com e-mail", `insert into usuario (id,nome,matricula,perfil,email) values ('${id(12)}','Marcos','90001','tecnico','marcos.lima@empresa.com.br')`);
await recusa("e-mail repetido", `insert into usuario (id,nome,matricula,perfil,email) values ('${id(14)}','Outro','90002','tecnico','marcos.lima@empresa.com.br')`);
await recusa("e-mail com maiúsculas", `insert into usuario (id,nome,matricula,perfil,email) values ('${id(14)}','Outro','90002','tecnico','Outro.Nome@empresa.com.br')`);
await recusa("matrícula repetida", `insert into usuario (id,nome,matricula,perfil,email) values ('${id(13)}','Outro','10482','tecnico','outro.nome@empresa.com.br')`);
await recusa("perfil inválido (supervisor e analista não são mais perfis)", `insert into usuario (id,nome,matricula,perfil,email) values ('${id(13)}','X','777','supervisor','x.y@empresa.com.br')`);
await deve("supervisor da equipe", `update equipe set supervisor_id='${id(12)}' where id='${id(1)}'`);
await recusa("liberação inválida", `update usuario set liberacao='quase' where id='${id(11)}'`);
await deve("usuário pendente, criado pelo supervisor", `insert into usuario (id,nome,matricula,perfil,email,equipe_id,liberacao,criado_por_id) values ('${id(15)}','Novato','90010','tecnico','novato.silva@empresa.com.br','${id(1)}','pendente','${id(12)}')`);
await deve("recusar com motivo", `update usuario set liberacao='recusado', ativo=false, recusa_motivo='Matrícula não confere' where id='${id(15)}'`);

// modelo
await deve("modelo rascunho", `insert into modelo_apr (id,codigo,versao,titulo) values ('${id(20)}','APR 03',4,'Operação e manutenção')`);
await deve("item eliminatório", `insert into item_modelo_apr (id,modelo_apr_id,secao,ordem,texto,resposta_bloqueante,tipo) values ('${id(21)}','${id(20)}','verificacao',1,'EPI completo?','nao','eliminatorio')`);
await deve("item 2", `insert into item_modelo_apr (id,modelo_apr_id,secao,ordem,texto,resposta_bloqueante,tipo) values ('${id(22)}','${id(20)}','verificacao',2,'Impedimento?','sim','eliminatorio')`);
await deve("risco do modelo", `insert into risco_modelo_apr (id,modelo_apr_id,classificacao,nome,ordem) values ('${id(23)}','${id(20)}','Ambiente de trabalho','Insolação',1)`);
await recusa("ordem de risco repetida", `insert into risco_modelo_apr (modelo_apr_id,classificacao,nome,ordem) values ('${id(20)}','Veicular','Outro',1)`);
await deve("medida de um risco", `insert into item_modelo_apr (id,modelo_apr_id,secao,ordem,texto,tipo,risco_id) values ('${id(24)}','${id(20)}','medida_preventiva',3,'Faz uso do protetor solar?','alerta','${id(23)}')`);
await recusa("medida sem risco", `insert into item_modelo_apr (modelo_apr_id,secao,ordem,texto,tipo) values ('${id(20)}','medida_preventiva',4,'x','alerta')`);
await recusa("item de verificação com risco", `insert into item_modelo_apr (modelo_apr_id,secao,ordem,texto,tipo,risco_id) values ('${id(20)}','verificacao',5,'x','alerta','${id(23)}')`);
await recusa("ordem de item repetida", `insert into item_modelo_apr (modelo_apr_id,secao,ordem,texto,tipo) values ('${id(20)}','verificacao',1,'dup','alerta')`);
await recusa("versão repetida do modelo", `insert into modelo_apr (codigo,versao,titulo) values ('APR 03',4,'dup')`);
await deve("publicar modelo", `update modelo_apr set publicado_em=now() where id='${id(20)}'`);
await recusa("editar modelo publicado", `update modelo_apr set titulo='x' where id='${id(20)}'`);
await recusa("apagar modelo publicado", `delete from modelo_apr where id='${id(20)}'`);
await deve("arquivar modelo publicado", `update modelo_apr set arquivado_em=now() where id='${id(20)}'`);
await recusa("editar o título ao restaurar", `update modelo_apr set arquivado_em=null, titulo='x' where id='${id(20)}'`);
await deve("restaurar modelo arquivado", `update modelo_apr set arquivado_em=null where id='${id(20)}'`);
await recusa("arquivar rascunho", `insert into modelo_apr (codigo,versao,titulo,arquivado_em) values ('APR 98',1,'rascunho',now())`);
await recusa("novo item em modelo publicado", `insert into item_modelo_apr (modelo_apr_id,secao,ordem,texto,tipo) values ('${id(20)}','verificacao',9,'x','alerta')`);
await recusa("editar item de modelo publicado", `update item_modelo_apr set texto='x' where id='${id(21)}'`);
await recusa("novo risco em modelo publicado", `insert into risco_modelo_apr (modelo_apr_id,classificacao,nome,ordem) values ('${id(20)}','Veicular','Novo',9)`);
await recusa("editar risco de modelo publicado", `update risco_modelo_apr set nome='x' where id='${id(23)}'`);
await deve("rascunho apaga com itens", `with m as (insert into modelo_apr (id,codigo,versao,titulo) values ('${id(29)}','APR 99',1,'rascunho') returning id)
  insert into item_modelo_apr (modelo_apr_id,secao,ordem,texto,tipo) select id,'verificacao',1,'x','alerta' from m`);
await deve("apagar rascunho", `delete from modelo_apr where id='${id(29)}'`);

// os
await deve("atividade", `insert into atividade (codigo,descricao) values ('8.7.1','Drenagem Caixa de Válvula')`);
await deve("local", `insert into local_instalacao (id,codigo) values ('${id(30)}','VILA VELHA/REDE VILA VELHA')`);
await deve("OS SAP", `insert into os (id,numero_ordem,tipo,codigo_atividade,titulo,local_instalacao_id,equipe_id,data_inicio_prog,origem) values ('${id(40)}','4031187','corretiva','8.7.1','DCV','${id(30)}','${id(1)}','2026-10-13','sap')`);
await recusa("ordem SAP repetida", `insert into os (numero_ordem,tipo,codigo_atividade,titulo,local_instalacao_id,equipe_id,data_inicio_prog,origem) values ('4031187','corretiva','8.7.1','dup','${id(30)}','${id(1)}','2026-10-13','sap')`);
await recusa("OS do SAP sem número", `insert into os (tipo,codigo_atividade,titulo,local_instalacao_id,equipe_id,data_inicio_prog,origem) values ('corretiva','8.7.1','x','${id(30)}','${id(1)}','2026-10-13','sap')`);
await deve("OS de apoio sem número", `insert into os (id,tipo,codigo_atividade,titulo,local_instalacao_id,equipe_id,data_inicio_prog,origem,os_origem_id) values ('${id(41)}','corretiva','8.7.1','apoio','${id(30)}','${id(1)}','2026-10-14','apoio','${id(40)}')`);
await recusa("OS de apoio sem OS de origem", `insert into os (tipo,codigo_atividade,titulo,local_instalacao_id,equipe_id,data_inicio_prog,origem) values ('corretiva','8.7.1','apoio','${id(30)}','${id(1)}','2026-10-14','apoio')`);
await recusa("OS do SAP ligada a uma OS de origem", `insert into os (numero_ordem,tipo,codigo_atividade,titulo,local_instalacao_id,equipe_id,data_inicio_prog,origem,os_origem_id) values ('4031188','corretiva','8.7.1','x','${id(30)}','${id(1)}','2026-10-14','sap','${id(40)}')`);
await recusa("origem manual não existe mais", `insert into os (numero_ordem,tipo,codigo_atividade,titulo,local_instalacao_id,equipe_id,data_inicio_prog,origem) values ('4031189','corretiva','8.7.1','x','${id(30)}','${id(1)}','2026-10-14','manual')`);
await deve("OS sem atividade mapeada",`insert into os (id,numero_ordem,tipo,titulo,local_instalacao_id,equipe_id,data_inicio_prog,origem) values ('${id(42)}','4023470','corretiva','DCV Desobstrução de caixa de valvula','${id(30)}','${id(1)}','2026-05-15','sap')`);
await deve("OS preventiva com plano e item", `insert into os (id,numero_ordem,tipo,titulo,local_instalacao_id,equipe_id,data_inicio_prog,origem,plano_manutencao,item_manutencao,data_ordem,criado_por_sap,status_sap) values ('${id(43)}','4019821','preventiva','1.2 - Inspeção Funcional de Retificador','${id(30)}','${id(1)}','2026-01-12','sap','10573','10603','2025-12-02','IP1020251202','LIB CAPC NOAP SCDM')`);
// catálogo de serviço
await deve("material", `insert into material (id,codigo,descricao,unidade,categoria) values ('${id(110)}','10002345','Luva de vaqueta','par','epi')`);
await recusa("código de material repetido", `insert into material (codigo,descricao,unidade) values ('10002345','Outra','un')`);
await recusa("categoria de material inválida", `insert into material (descricao,unidade,categoria) values ('X','un','consumivel')`);
await recusa("material sem descrição", `insert into material (descricao,unidade) values ('  ','un')`);
await deve("material na lista do serviço", `insert into atividade_material (atividade_codigo,material_id,quantidade,ordem) values ('8.7.1','${id(110)}',2,1)`);
await recusa("material repetido no serviço", `insert into atividade_material (atividade_codigo,material_id,ordem) values ('8.7.1','${id(110)}',2)`);
await recusa("quantidade zero", `update atividade_material set quantidade=0 where material_id='${id(110)}'`);
await recusa("serviço inexistente", `insert into atividade_material (atividade_codigo,material_id,ordem) values ('9.9.9','${id(110)}',1)`);
await recusa("excluir material em uso", `delete from material where id='${id(110)}'`);
await recusa("atividade inexistente", `insert into os (numero_ordem,tipo,codigo_atividade,titulo,local_instalacao_id,equipe_id,data_inicio_prog,origem) values ('1','corretiva','9.9.9','x','${id(30)}','${id(1)}','2026-10-13','sap')`);
await recusa("status inválido", `update os set status='aberta' where id='${id(40)}'`);
await recusa("fim antes do início", `update os set data_fim_prog='2026-10-01' where id='${id(40)}'`);
const antes = (await db.query(`select atualizada_em from os where id='${id(40)}'`)).rows[0].atualizada_em;
await new Promise((r) => setTimeout(r, 20));
await db.query(`update os set prioridade='Alto' where id='${id(40)}'`);
const depois = (await db.query(`select atualizada_em from os where id='${id(40)}'`)).rows[0].atualizada_em;
console.log(depois > antes ? "ok  trigger atualizada_em" : "XX  trigger atualizada_em não mexeu"); if (!(depois > antes)) falhas++;

// APR
await deve("APR aprovada", `insert into apr (id,os_id,modelo_apr_id,preenchida_por,resultado,concluida_em) values ('${id(50)}','${id(40)}','${id(20)}','${id(10)}','aprovada',now())`);
await deve("participante responsável", `insert into apr_participante values ('${id(50)}','${id(10)}','responsavel','a.png',now())`);
await deve("participante executor", `insert into apr_participante values ('${id(50)}','${id(11)}','executor','b.png',now())`);
await deve("risco marcado na APR", `insert into apr_risco values ('${id(50)}','${id(23)}')`);
await recusa("risco marcado duas vezes", `insert into apr_risco values ('${id(50)}','${id(23)}')`);
await recusa("risco inexistente", `insert into apr_risco values ('${id(50)}','${id(99)}')`);
await recusa("dois responsáveis", `update apr_participante set funcao='responsavel' where apr_id='${id(50)}' and usuario_id='${id(11)}'`);
await recusa("participante duplicado", `insert into apr_participante values ('${id(50)}','${id(10)}','executor','a.png',now())`);
await deve("resposta", `insert into apr_resposta values ('${id(50)}','${id(21)}','sim',null,now())`);
await recusa("NA sem observação", `insert into apr_resposta values ('${id(50)}','${id(22)}','na',null,now())`);
await recusa("NA com observação vazia", `insert into apr_resposta values ('${id(50)}','${id(22)}','na','  ',now())`);
await deve("NA com observação", `insert into apr_resposta values ('${id(50)}','${id(22)}','na','não se aplica',now())`);
await recusa("resposta repetida", `insert into apr_resposta values ('${id(50)}','${id(21)}','nao','x',now())`);

// execução
await deve("execução", `insert into execucao (id,os_id,apr_id,executor_id,numero_pessoas,inicio) values ('${id(60)}','${id(40)}','${id(50)}','${id(10)}',2,'2026-10-13 09:31')`);
await recusa("2ª execução na mesma APR", `insert into execucao (id,os_id,apr_id,executor_id,numero_pessoas,inicio) values ('${id(61)}','${id(40)}','${id(50)}','${id(10)}',2,'2026-10-13 09:40')`);
await recusa("0 pessoas", `update execucao set numero_pessoas=0 where id='${id(60)}'`);
await recusa("encerrar sem descrição", `update execucao set resultado='encerrada', fim='2026-10-13 11:18' where id='${id(60)}'`);
await recusa("interromper sem motivo", `update execucao set resultado='interrompida', fim='2026-10-13 10:00' where id='${id(60)}'`);
await recusa("fim antes do início", `update execucao set fim='2026-10-13 08:00' where id='${id(60)}'`);
await deve("pausa", `insert into execucao_pausa (id,execucao_id,inicio) values ('${id(70)}','${id(60)}','2026-10-13 10:15')`);
await recusa("2ª pausa aberta", `insert into execucao_pausa (id,execucao_id,inicio) values ('${id(71)}','${id(60)}','2026-10-13 10:20')`);
await deve("fechar pausa", `update execucao_pausa set fim='2026-10-13 10:27', motivo='almoco' where id='${id(70)}'`);
await recusa("motivo de pausa inválido", `update execucao_pausa set motivo='ferias' where id='${id(70)}'`);
await deve("nova pausa após fechar", `insert into execucao_pausa (id,execucao_id,inicio) values ('${id(71)}','${id(60)}','2026-10-13 10:40')`);
await deve("foto da execução", `insert into evidencia (id,execucao_id,foto_path,capturada_em,latitude,longitude) values ('${id(80)}','${id(60)}','f.jpg',now(),-20.3,-40.3)`);
await deve("foto do item respondido", `insert into evidencia (id,apr_id,item_id,foto_path,capturada_em) values ('${id(81)}','${id(50)}','${id(21)}','g.jpg',now())`);
await recusa("foto de item não respondido", `insert into evidencia (id,apr_id,item_id,foto_path,capturada_em) values ('${id(82)}','${id(50)}','${id(20)}','g.jpg',now())`);
await recusa("foto sem dono", `insert into evidencia (id,foto_path,capturada_em) values ('${id(83)}','g.jpg',now())`);
await recusa("item sem APR", `insert into evidencia (id,execucao_id,item_id,foto_path,capturada_em) values ('${id(84)}','${id(60)}','${id(21)}','g.jpg',now())`);
await recusa("GPS pela metade", `insert into evidencia (id,execucao_id,foto_path,capturada_em,latitude) values ('${id(85)}','${id(60)}','g.jpg',now(),-20)`);
await recusa("latitude fora da faixa", `insert into evidencia (id,execucao_id,foto_path,capturada_em,latitude,longitude) values ('${id(86)}','${id(60)}','g.jpg',now(),95,0)`);
await deve("PDF da execução, com o nome", `insert into evidencia (id,execucao_id,tipo,foto_path,nome_arquivo,capturada_em) values ('${id(87)}','${id(60)}','pdf','laudo-id','laudo.pdf',now())`);
await deve("PDF do item respondido", `insert into evidencia (id,apr_id,item_id,tipo,foto_path,capturada_em) values ('${id(88)}','${id(50)}','${id(21)}','pdf','atestado-id',now())`);
await recusa("tipo de evidência inválido", `insert into evidencia (id,execucao_id,tipo,foto_path,capturada_em) values ('${id(89)}','${id(60)}','video','v.mp4',now())`);
await recusa("nome de arquivo na foto", `insert into evidencia (id,execucao_id,foto_path,nome_arquivo,capturada_em) values ('${id(89)}','${id(60)}','f2.jpg','foto.jpg',now())`);
await deve("assinatura da execução", `insert into execucao_assinatura values ('${id(60)}','${id(10)}','a.png',now())`);
await recusa("assinatura repetida", `insert into execucao_assinatura values ('${id(60)}','${id(10)}','a.png',now())`);
await deve("encerrar completa", `update execucao set resultado='encerrada', fim='2026-10-13 11:18', descricao_atividade='Drenagem concluída' where id='${id(60)}'`);
await deve("dados de inspeção", `update execucao set dados_inspecao='{"tensao_saida_vcc": 5.25, "telemetria": "nao_funcional"}' where id='${id(60)}'`);

// cancelada libera a APR
await deve("APR 2", `insert into apr (id,os_id,modelo_apr_id,preenchida_por,resultado,concluida_em) values ('${id(51)}','${id(40)}','${id(20)}','${id(10)}','aprovada',now())`);
await deve("execução a cancelar", `insert into execucao (id,os_id,apr_id,executor_id,numero_pessoas,inicio) values ('${id(62)}','${id(40)}','${id(51)}','${id(10)}',1,now())`);
await deve("cancelar", `update execucao set resultado='cancelada' where id='${id(62)}'`);
await deve("reusar APR após cancelar", `insert into execucao (id,os_id,apr_id,executor_id,numero_pessoas,inicio) values ('${id(63)}','${id(40)}','${id(51)}','${id(10)}',1,now())`);

// evento, alerta, reprogramação, tarefa
await deve("evento", `insert into evento_campo (id,usuario_id,tipo,os_id,payload,ocorrido_em) values ('${id(90)}','${id(10)}','apr_concluida','${id(40)}','{}',now())`);
await recusa("evento repetido (idempotência)", `insert into evento_campo (id,usuario_id,tipo,os_id,payload,ocorrido_em) values ('${id(90)}','${id(10)}','apr_concluida','${id(40)}','{}',now())`);
await deve("evento repetido com ON CONFLICT DO NOTHING", `insert into evento_campo (id,usuario_id,tipo,os_id,payload,ocorrido_em) values ('${id(90)}','${id(10)}','apr_concluida','${id(40)}','{}',now()) on conflict (id) do nothing`);
await recusa("tipo de evento inválido", `insert into evento_campo (id,usuario_id,tipo,payload,ocorrido_em) values ('${id(91)}','${id(10)}','voou','{}',now())`);
await deve("alerta", `insert into alerta (tipo,os_id,destinatario_id,detalhe) values ('bloqueio','${id(40)}','${id(12)}','Caixa alagada')`);
await recusa("alerta de tipo inválido", `insert into alerta (tipo,os_id,destinatario_id,detalhe) values ('x','${id(40)}','${id(12)}','d')`);
await recusa("alerta de OS sem OS", `insert into alerta (tipo,destinatario_id,detalhe) values ('bloqueio','${id(12)}','d')`);
await deve("importação que falhou", `insert into importacao (id,origem,erro) values ('${id(95)}','api','SAP fora do ar')`);
await deve("alerta de falha de importação", `insert into alerta (tipo,importacao_id,destinatario_id,detalhe) values ('falha_importacao','${id(95)}','${id(12)}','A sincronização falhou')`);
await recusa("falha de importação sem a importação", `insert into alerta (tipo,destinatario_id,detalhe) values ('falha_importacao','${id(12)}','d')`);
await recusa("falha de importação ligada a uma OS", `insert into alerta (tipo,os_id,importacao_id,destinatario_id,detalhe) values ('falha_importacao','${id(40)}','${id(95)}','${id(12)}','d')`);
await recusa("alerta de OS ligado a uma importação", `insert into alerta (tipo,os_id,importacao_id,destinatario_id,detalhe) values ('bloqueio','${id(40)}','${id(95)}','${id(12)}','d')`);
// ciclo das preventivas
await deve("plano de preventiva sem intervalo", `insert into plano_preventiva (id,plano_manutencao,item_manutencao) values ('${id(96)}','10573','10603')`);
await recusa("mesmo plano e item duas vezes", `insert into plano_preventiva (plano_manutencao,item_manutencao) values ('10573','10603')`);
await deve("plano sem item", `insert into plano_preventiva (plano_manutencao) values ('10574')`);
await recusa("mesmo plano sem item duas vezes", `insert into plano_preventiva (plano_manutencao) values ('10574')`);
await deve("intervalo de 3 meses", `update plano_preventiva set intervalo_quantidade=3, intervalo_unidade='mes' where id='${id(96)}'`);
await recusa("intervalo sem unidade", `update plano_preventiva set intervalo_unidade=null where id='${id(96)}'`);
await recusa("unidade inválida", `update plano_preventiva set intervalo_unidade='decada' where id='${id(96)}'`);
await recusa("intervalo zero", `update plano_preventiva set intervalo_quantidade=0 where id='${id(96)}'`);
await recusa("plano em branco", `insert into plano_preventiva (plano_manutencao) values ('  ')`);
await deve("alerta de ciclo vencido", `insert into alerta (tipo,os_id,plano_preventiva_id,destinatario_id,detalhe) values ('preventiva_vencida','${id(40)}','${id(96)}','${id(12)}','O ciclo venceu')`);
await recusa("alerta de ciclo sem o plano", `insert into alerta (tipo,os_id,destinatario_id,detalhe) values ('preventiva_proxima','${id(40)}','${id(12)}','d')`);
await recusa("alerta de OS ligado a um plano", `insert into alerta (tipo,os_id,plano_preventiva_id,destinatario_id,detalhe) values ('bloqueio','${id(40)}','${id(96)}','${id(12)}','d')`);
await deve("reprogramação", `insert into reprogramacao (os_id,usuario_id,data_anterior,data_nova,justificativa) values ('${id(40)}','${id(12)}','2026-10-13','2026-10-16','Aguardar drenagem')`);
await recusa("reprogramar sem justificativa", `insert into reprogramacao (os_id,usuario_id,data_anterior,data_nova,justificativa) values ('${id(40)}','${id(12)}','2026-10-13','2026-10-16','   ')`);
await deve("tarefa", `insert into tarefa (tipo,referencia_id) values ('pdf_os','${id(40)}')`);
await recusa("tarefa de tipo inválido", `insert into tarefa (tipo) values ('x')`);

console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
