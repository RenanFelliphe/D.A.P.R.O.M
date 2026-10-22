/**
 * Cria as OS da apresentação pelo caminho do SAP: grava as ordens no SAP simulado (`ordem_sap_simulada`) e faz uma leitura de
 * verdade (`executarLeitura`), que as importa como OS, cria os locais e os planos de preventiva e registra a importação.
 * Nenhuma OS é inserida direto na tabela `os`; o que acontece depois (APR, execução, encerramento, ciência) entra pelo mesmo
 * canal de eventos da api (`processarEventos`), com a hora de cada evento no passado.
 *
 *   pnpm demo:criar-os 1     (25 primeiras: 12 Instrumentação, 7 Serviços Especiais, 6 Laboratório Químico)
 *   pnpm demo:criar-os 2     (as 25 seguintes, em todos os status: liberada, em execução, encerrando, esperando o supervisor,
 *                            encerrada, pendente, devolvida e cancelada; as execuções passam pelas mesmas regras da api)
 *
 * Dados fictícios. As datas programadas são relativas ao dia em que o script roda. Pode rodar de novo: a ordem que já está no simulador só
 * tem as datas atualizadas, e a OS que já saiu de "liberada" não é conduzida outra vez.
 */
import { inArray, sql } from "drizzle-orm";
import { lerConfig } from "../src/config";
import { conectar } from "../src/db/conexao";
import { ordemSapSimulada } from "../src/db/schema";
import { LOCAIS, paginaDoContrato } from "../src/dominio/sap-simulado";
import type { Deps } from "../src/deps";
import { conduzirCenarios, planejar, type Cenario, type PedidoDeCenario } from "./cenarios-de-os";
import { executarLeitura } from "../src/servicos/leitura-sap";

type Centro = "INSTRUM" | "SERV_ESP" | "LAB_QUI";
type Prioridade = "Muito alto" | "Alto" | "Médio" | "Baixo";

interface Ordem {
  centro: Centro;
  tipo: "YBA1" | "YBA2";
  /** Código ou descrição da atividade cadastrada; nulo nas corretivas que o SAP manda sem atividade. */
  atividade: string | null;
  titulo: string;
  descricao: string;
  /** Prefixo do código em `LOCAIS` (`ERP SERRA`, `VITORIA`…). */
  local: string;
  equipamento: string;
  prioridade: Prioridade;
  /** Dias a partir de hoje (negativo = já deveria ter começado). */
  inicio: number;
  duracao: number;
  /** Só nas preventivas: o intervalo entre ciclos. */
  ciclo?: string;
  solicitante?: string;
  /** Até onde a OS chega depois de importada; sem isto, fica liberada. */
  cenario?: Cenario;
  /** Quem faz (matrículas; a primeira é a responsável); obrigatória em quem está em campo agora. */
  dupla?: string[];
  /** Por que a execução foi interrompida. */
  motivo?: string;
}

const LOTE_1: Ordem[] = [
  // ---- Instrumentação (12) ----
  { centro: "INSTRUM", tipo: "YBA1", atividade: null, titulo: "Falha de comunicação do transmissor de pressão PIT-0204", descricao: "Transmissor sem sinal no supervisório desde a madrugada. Verificar alimentação 24 Vcc, cabo de sinal e conexões; substituir o transmissor se estiver danificado. Ferramentas: multímetro, calibrador de processo.", local: "ERP SERRA", equipamento: "PIT-0204", prioridade: "Muito alto", inicio: -1, duracao: 1, solicitante: "Central de Operação", cenario: "interrompida", motivo: "Infiltração de água no conduíte do transmissor com risco de curto-circuito; atividade interrompida até a vedação ser refeita." },
  { centro: "INSTRUM", tipo: "YBA1", atividade: null, titulo: "Medidor de vazão FQIT-0001 com indicação zerada", descricao: "O totalizador não incrementa há dois dias, com vazão confirmada no campo. Conferir o sinal de pulso, o conversor de vazão e a bateria do computador de vazão.", local: "TUBARAO", equipamento: "FQIT-0001", prioridade: "Muito alto", inicio: -2, duracao: 2, solicitante: "Faturamento", cenario: "bloqueada" },
  { centro: "INSTRUM", tipo: "YBA1", atividade: null, titulo: "Substituição de manômetro com leitura instável", descricao: "Manômetro da linha de entrada oscilando fora da faixa. Substituir pelo novo, aferir contra o padrão e lacrar. Materiais: manômetro, fita veda-rosca.", local: "VITORIA", equipamento: "PI-0108", prioridade: "Médio", inicio: 0, duracao: 1, cenario: "liberada" },
  { centro: "INSTRUM", tipo: "YBA2", atividade: "CLB - Calibração PT", titulo: "CLB - Calibração PT", descricao: "Calibração do transmissor de pressão contra o padrão rastreável, registrando os desvios antes e depois do ajuste.", local: "ERP SERRA", equipamento: "PT-0101", prioridade: "Médio", inicio: 1, duracao: 1, ciclo: "semestral", cenario: "liberada" },
  { centro: "INSTRUM", tipo: "YBA2", atividade: "CLB - Calibração PIT", titulo: "CLB - Calibração PIT", descricao: "Calibração do transmissor indicador de pressão e conferência do sinal de 4 a 20 mA no supervisório.", local: "VITORIA", equipamento: "PIT-0204", prioridade: "Médio", inicio: -1, duracao: 1, ciclo: "semestral", cenario: "bloqueada" },
  { centro: "INSTRUM", tipo: "YBA2", atividade: "CLB - Calibração TIT", titulo: "CLB - Calibração TIT", descricao: "Calibração do transmissor de temperatura em banho seco, com registro dos pontos de 0, 50 e 100 %.", local: "TUBARAO", equipamento: "TIT-0312", prioridade: "Médio", inicio: -8, duracao: 1, ciclo: "anual", cenario: "encerrada" },
  { centro: "INSTRUM", tipo: "YBA2", atividade: "CLB - Calibração Pressostato", titulo: "CLB - Calibração Pressostato", descricao: "Verificar o ponto de atuação do pressostato de alta e baixa e ajustar o diferencial.", local: "GUARAPARI", equipamento: "PSH-0108", prioridade: "Baixo", inicio: -3, duracao: 1, ciclo: "anual", cenario: "aguardando" },
  { centro: "INSTRUM", tipo: "YBA2", atividade: "CLB - Calibração PSV", titulo: "CLB - Calibração PSV", descricao: "Teste de abertura e reassentamento da válvula de segurança, com ajuste da pressão de ajuste e lacre.", local: "SERRA", equipamento: "PSV-0210", prioridade: "Alto", inicio: -1, duracao: 2, ciclo: "anual", cenario: "suspensa" },
  { centro: "INSTRUM", tipo: "YBA2", atividade: "CLB - Calibração FQIT", titulo: "CLB - Calibração FQIT", descricao: "Conferência do medidor de vazão contra o padrão e do computador de vazão: fator K, pulsos e totalizador.", local: "ARACRUZ", equipamento: "FQIT-0007", prioridade: "Alto", inicio: -1, duracao: 2, ciclo: "anual", cenario: "encerrando" },
  { centro: "INSTRUM", tipo: "YBA2", atividade: "8.3.1", titulo: "8.3.1 - Preventiva Bancos de Baterias", descricao: "Medir a tensão e a densidade de cada elemento, apertar os terminais e testar a autonomia do banco.", local: "ERP SERRA", equipamento: "BB-ERP01", prioridade: "Médio", inicio: -2, duracao: 1, ciclo: "trimestral", cenario: "aguardando" },
  { centro: "INSTRUM", tipo: "YBA2", atividade: "8.3.9", titulo: "8.3.9 - Limpeza Painel Solar - Mensal", descricao: "Limpeza dos painéis solares, verificação das conexões e da tensão de saída do controlador de carga.", local: "GUARAPARI", equipamento: "PS-GUA01", prioridade: "Baixo", inicio: -10, duracao: 1, ciclo: "mensal", cenario: "encerrada" },
  { centro: "INSTRUM", tipo: "YBA2", atividade: "8.6.1", titulo: "8.6.1 - Calibração AIT COGN", descricao: "Calibração do analisador de cogeração com gás padrão, ajuste de zero e span e registro do certificado.", local: "ERP SERRA", equipamento: "AIT-0021", prioridade: "Médio", inicio: -2, duracao: 1, ciclo: "semestral", cenario: "interrompida", motivo: "Presença de gás acima de 10% do LIE na casa de instrumentos; atividade interrompida até a ventilação e nova medição." },

  // ---- Serviços Especiais (7) ----
  { centro: "SERV_ESP", tipo: "YBA1", atividade: null, titulo: "Desobstrução de caixa de válvula", descricao: "Caixa de válvula com acúmulo de água e sedimento. Desobstruir, drenar e verificar o estado da válvula. Materiais: bomba de sucção, mangote, EPI. Ferramentas: chave de caixa, espelho.", local: "VILA VELHA", equipamento: "DCV-VV-0042", prioridade: "Muito alto", inicio: 0, duracao: 2, solicitante: "Atendimento Operacional", cenario: "em_execucao", dupla: ["2005","2010"] },
  { centro: "SERV_ESP", tipo: "YBA1", atividade: "Tratamento em corrosão e pintura", titulo: "Tratamento de corrosão em suporte de tubulação", descricao: "Corrosão em suporte e na tubulação aérea. Remover a ferrugem, aplicar o primer epóxi e a tinta de acabamento. Materiais: tinta epóxi, diluente, lixa.", local: "ERP SERRA", equipamento: "SUP-ERP-0012", prioridade: "Alto", inicio: -1, duracao: 3, cenario: "suspensa" },
  { centro: "SERV_ESP", tipo: "YBA1", atividade: "Teste, manutenção e válvulas", titulo: "Manutenção de válvula esfera 2\" com passagem", descricao: "Válvula de bloqueio com vazamento pela haste. Substituir o kit de vedação, lubrificar e testar a estanqueidade. Materiais: kit de vedação, vaselina industrial.", local: "GUARAPARI", equipamento: "VE-GUA-0017", prioridade: "Alto", inicio: 5, duracao: 1, cenario: "liberada" },
  { centro: "SERV_ESP", tipo: "YBA2", atividade: "8.7.1", titulo: "8.7.1 - Drenagem Caixa de Válvula", descricao: "Drenagem e verificação da caixa de válvula, com inspeção visual da tampa e do lacre.", local: "VILA VELHA", equipamento: "CV-VV-0008", prioridade: "Médio", inicio: -1, duracao: 1, ciclo: "mensal", cenario: "bloqueada" },
  { centro: "SERV_ESP", tipo: "YBA2", atividade: "8.7.11", titulo: "8.7.11 - Roçagem Faixa Trimestral", descricao: "Roçagem da faixa de servidão do gasoduto e remoção do material cortado.", local: "LINHARES", equipamento: "FX-LIN-0003", prioridade: "Baixo", inicio: -2, duracao: 2, ciclo: "trimestral", cenario: "bloqueada" },
  { centro: "SERV_ESP", tipo: "YBA2", atividade: "8.7.13", titulo: "8.7.13 - Lavagem Trimestral", descricao: "Lavagem geral da estação: pisos, canaletas e equipamentos externos. Materiais: detergente, escovas. Ferramentas: lavadora de alta pressão.", local: "VITORIA", equipamento: "EST-VIT-0001", prioridade: "Baixo", inicio: -4, duracao: 1, ciclo: "trimestral", cenario: "aguardando" },
  { centro: "SERV_ESP", tipo: "YBA2", atividade: "8.2.8", titulo: "8.2.8 - Inspeção em válvula enterrada", descricao: "Inspeção da válvula enterrada: acesso, caixa, indicador de posição e ausência de vazamento.", local: "CARIACICA", equipamento: "VE-CAR-0005", prioridade: "Médio", inicio: -6, duracao: 1, ciclo: "semestral", cenario: "encerrada" },

  // ---- Laboratório Químico (6) ----
  { centro: "LAB_QUI", tipo: "YBA1", atividade: null, titulo: "Cromatógrafo com desvio na leitura de poder calorífico", descricao: "O poder calorífico medido diverge do padrão de verificação. Conferir o gás de arraste, a coluna e a última calibração; recalibrar se necessário.", local: "ERP SERRA", equipamento: "CG-ERP01", prioridade: "Alto", inicio: 0, duracao: 1, solicitante: "Qualidade", cenario: "liberada" },
  { centro: "LAB_QUI", tipo: "YBA1", atividade: "Análise de combustão", titulo: "Análise de combustão em aquecedor de cliente", descricao: "Medir os gases de combustão do aquecedor, registrar o CO e o excesso de ar e orientar o ajuste do queimador.", local: "ARACRUZ", equipamento: "AQ-ARA-0004", prioridade: "Médio", inicio: 3, duracao: 1, solicitante: "Atendimento Comercial", cenario: "liberada" },
  { centro: "LAB_QUI", tipo: "YBA2", atividade: "8.3.11", titulo: "8.3.11 - Verificação Cromatógrafo Mensal", descricao: "Verificação mensal do cromatógrafo com gás padrão e registro dos desvios por componente.", local: "ERP SERRA", equipamento: "CG-ERP01", prioridade: "Médio", inicio: -1, duracao: 1, ciclo: "mensal", cenario: "bloqueada" },
  { centro: "LAB_QUI", tipo: "YBA2", atividade: "8.3.6", titulo: "8.3.6 - Verificação da Odorização Mensal", descricao: "Coleta de amostra e medição do teor de odorante no ponto de entrega, com registro do resultado.", local: "VITORIA", equipamento: "OD-VIT-0002", prioridade: "Médio", inicio: -2, duracao: 1, ciclo: "mensal", cenario: "suspensa" },
  { centro: "LAB_QUI", tipo: "YBA2", atividade: "8.3.10", titulo: "8.3.10 - Calibração Cromatógrafo Bimestral", descricao: "Calibração bimestral do cromatógrafo com a mistura padrão certificada e emissão do relatório.", local: "TUBARAO", equipamento: "CG-TUB01", prioridade: "Alto", inicio: -2, duracao: 1, ciclo: "bimestral", cenario: "aguardando" },
  { centro: "LAB_QUI", tipo: "YBA2", atividade: "CLB - Calibração Explosímetro Semestral", titulo: "CLB - Calibração Explosímetro Semestral", descricao: "Calibração do explosímetro portátil com gás padrão e teste dos alarmes.", local: "SERRA", equipamento: "EXP-0003", prioridade: "Médio", inicio: -1, duracao: 1, ciclo: "semestral", cenario: "interrompida", motivo: "Odor de gás no ponto de coleta durante a montagem do amostrador; atividade interrompida até a verificação da linha." },
];

const LOTE_2: Ordem[] = [
  // ---- Instrumentação (12) ----
  { centro: "INSTRUM", tipo: "YBA2", atividade: "CLB - Calibração PI", titulo: "CLB - Calibração PI", descricao: "Calibração do indicador de pressão contra o padrão, com registro dos desvios nos cinco pontos.", local: "ERP SERRA", equipamento: "PI-0102", prioridade: "Médio", inicio: 2, duracao: 1, ciclo: "semestral", cenario: "liberada" },
  { centro: "INSTRUM", tipo: "YBA2", atividade: "CLB - Calibração TE", titulo: "CLB - Calibração TE", descricao: "Calibração do elemento de temperatura em banho seco e conferência da curva do transmissor associado.", local: "GUARAPARI", equipamento: "TE-0415", prioridade: "Médio", inicio: 4, duracao: 1, ciclo: "anual", cenario: "reservada", dupla: ["2003", "1212"] },
  { centro: "INSTRUM", tipo: "YBA1", atividade: null, titulo: "Substituição de transmissor de temperatura TIT-0118", descricao: "Transmissor com leitura travada. Substituir, configurar a faixa e conferir o sinal no supervisório.", local: "ARACRUZ", equipamento: "TIT-0118", prioridade: "Médio", inicio: 1, duracao: 1, cenario: "cancelada" },
  { centro: "INSTRUM", tipo: "YBA2", atividade: "8.1.2", titulo: "8.1.2 - Inspeção Elétrica no Retificador", descricao: "Inspeção elétrica do retificador de proteção catódica: tensões, correntes, fusíveis, DPS e aperto dos bornes.", local: "ERP SERRA", equipamento: "RET-ERP01-003", prioridade: "Alto", inicio: 0, duracao: 1, ciclo: "mensal", cenario: "em_execucao", dupla: ["2003", "1212"] },
  { centro: "INSTRUM", tipo: "YBA1", atividade: null, titulo: "Falha no computador de vazão FC-0003", descricao: "O computador de vazão reinicia sozinho e perde o totalizador. Verificar a alimentação, a bateria e o firmware; substituir a placa se preciso.", local: "VITORIA", equipamento: "FC-0003", prioridade: "Muito alto", inicio: 0, duracao: 1, solicitante: "Faturamento", cenario: "em_pausa", dupla: ["100002", "2001"] },
  { centro: "INSTRUM", tipo: "YBA1", atividade: null, titulo: "Substituição de manômetro com vidro trincado", descricao: "Manômetro com o vidro trincado e a escala ilegível. Substituir pelo novo, aferir e lacrar. Materiais: manômetro, fita veda-rosca.", local: "SERRA", equipamento: "PI-0231", prioridade: "Médio", inicio: -1, duracao: 1, cenario: "encerrando" },
  { centro: "INSTRUM", tipo: "YBA2", atividade: "CLB - Calibração FI", titulo: "CLB - Calibração FI", descricao: "Calibração do indicador de vazão contra o padrão e conferência da escala.", local: "VITORIA", equipamento: "FI-0306", prioridade: "Médio", inicio: -2, duracao: 1, ciclo: "anual", cenario: "aguardando" },
  { centro: "INSTRUM", tipo: "YBA2", atividade: "8.1.1", titulo: "8.1.1 - Verificação elétrica", descricao: "Verificação elétrica do painel de instrumentação: alimentação, aterramento, disjuntores e aperto dos bornes.", local: "TUBARAO", equipamento: "PN-TUB-0002", prioridade: "Baixo", inicio: -4, duracao: 1, ciclo: "anual", cenario: "aguardando" },
  { centro: "INSTRUM", tipo: "YBA2", atividade: "CLB - Calibração PDIT", titulo: "CLB - Calibração PDIT", descricao: "Calibração do transmissor de pressão diferencial do filtro, com registro dos desvios e do zero.", local: "ERP SERRA", equipamento: "PDIT-0044", prioridade: "Médio", inicio: -9, duracao: 1, ciclo: "semestral", cenario: "encerrada" },
  { centro: "INSTRUM", tipo: "YBA1", atividade: null, titulo: "Substituição de transmissor de temperatura danificado", descricao: "Transmissor danificado por descarga atmosférica. Substituir, configurar a faixa e conferir o sinal no supervisório.", local: "ARACRUZ", equipamento: "TIT-0131", prioridade: "Alto", inicio: -7, duracao: 1, cenario: "encerrada" },
  { centro: "INSTRUM", tipo: "YBA2", atividade: "8.3.5", titulo: "8.3.5 - Verificar presença de insetos", descricao: "Verificar a presença de insetos nos quadros e nos instrumentos de campo e aplicar o repelente indicado.", local: "GUARAPARI", equipamento: "QD-GUA-0003", prioridade: "Baixo", inicio: -12, duracao: 1, ciclo: "mensal", cenario: "encerrada" },
  { centro: "INSTRUM", tipo: "YBA1", atividade: null, titulo: "Troca de detector de gás fixo", descricao: "Detector de gás da casa de instrumentos com falha de autodiagnóstico. Substituir o sensor, calibrar e testar os alarmes.", local: "ERP SERRA", equipamento: "GD-0007", prioridade: "Muito alto", inicio: -2, duracao: 1, cenario: "interrompida", motivo: "Presença de gás acima de 10% do LIE na casa de instrumentos; atividade interrompida até a ventilação e nova medição." },

  // ---- Serviços Especiais (7) ----
  { centro: "SERV_ESP", tipo: "YBA2", atividade: "8.7.12", titulo: "8.7.12 - Roçagem Bimestral", descricao: "Roçagem da faixa de servidão do ramal e remoção do material cortado.", local: "CARIACICA", equipamento: "FX-CAR-0002", prioridade: "Baixo", inicio: 3, duracao: 2, ciclo: "bimestral", cenario: "liberada" },
  { centro: "SERV_ESP", tipo: "YBA1", atividade: null, titulo: "Reparo em cerca da faixa de servidão", descricao: "Cerca danificada na faixa de servidão, com acesso de terceiros ao gasoduto. Refazer o trecho e recolocar as placas de sinalização.", local: "LINHARES", equipamento: "CE-LIN-0001", prioridade: "Médio", inicio: 1, duracao: 2, cenario: "devolvida" },
  { centro: "SERV_ESP", tipo: "YBA2", atividade: "8.7.2", titulo: "8.7.2 - Limpeza e Drenagem Caixa Válvula Anual", descricao: "Limpeza e drenagem da caixa de válvula, com inspeção da válvula, do lacre e da tampa.", local: "VILA VELHA", equipamento: "CV-VV-0011", prioridade: "Médio", inicio: 0, duracao: 1, ciclo: "anual", cenario: "em_execucao", dupla: ["2008", "2009"] },
  { centro: "SERV_ESP", tipo: "YBA1", atividade: "Tratamento em corrosão e pintura", titulo: "Tratamento de corrosão em abrigo de medidores", descricao: "Corrosão no abrigo e na tubulação de entrada. Remover a ferrugem, aplicar o primer epóxi e o acabamento. Materiais: tinta epóxi, diluente, lixa.", local: "GUARAPARI", equipamento: "AB-GUA-0031", prioridade: "Baixo", inicio: -1, duracao: 2, cenario: "encerrando" },
  { centro: "SERV_ESP", tipo: "YBA2", atividade: "8.7.14", titulo: "8.7.14 - Lavagem Bimestral", descricao: "Lavagem geral da estação: pisos, canaletas e equipamentos externos. Materiais: detergente, escovas. Ferramentas: lavadora de alta pressão.", local: "ERP SERRA", equipamento: "EST-ERP-0001", prioridade: "Baixo", inicio: -3, duracao: 1, ciclo: "bimestral", cenario: "aguardando" },
  { centro: "SERV_ESP", tipo: "YBA1", atividade: "Teste, manutenção e válvulas", titulo: "Manutenção de válvula de bloqueio com difícil acionamento", descricao: "Válvula de bloqueio com acionamento pesado. Lubrificar, substituir a gaxeta e testar o curso completo. Materiais: gaxeta, vaselina industrial.", local: "CARIACICA", equipamento: "VB-CAR-0009", prioridade: "Médio", inicio: -8, duracao: 1, cenario: "encerrada" },
  { centro: "SERV_ESP", tipo: "YBA1", atividade: "Pré-montagem e montagem de tubulação", titulo: "Substituição de trecho de tubulação aérea", descricao: "Trecho com corrosão avançada. Pré-montar o trecho novo, substituir e testar a estanqueidade. Materiais: tubo, conexões, vedante.", local: "VITORIA", equipamento: "TB-VIT-0014", prioridade: "Alto", inicio: -1, duracao: 2, cenario: "suspensa" },

  // ---- Laboratório Químico (6) ----
  { centro: "LAB_QUI", tipo: "YBA2", atividade: "CLB - Calibração HAND-HELD I", titulo: "CLB - Calibração HAND-HELD I", descricao: "Calibração do terminal portátil de configuração e conferência da comunicação com os instrumentos.", local: "ARACRUZ", equipamento: "HH-0002", prioridade: "Baixo", inicio: 5, duracao: 1, ciclo: "anual", cenario: "liberada" },
  { centro: "LAB_QUI", tipo: "YBA1", atividade: null, titulo: "Odorizador com consumo de odorante acima do esperado", descricao: "O consumo de odorante subiu 30% sem aumento de vazão. Verificar a bomba dosadora, a linha e o ajuste do odorizador e medir o teor na rede.", local: "VILA VELHA", equipamento: "OD-VV-0001", prioridade: "Alto", inicio: 1, duracao: 1, solicitante: "Qualidade", cenario: "liberada" },
  { centro: "LAB_QUI", tipo: "YBA2", atividade: "8.6.3", titulo: "8.6.3 - Manutenção Externa Cromatógrafo", descricao: "Manutenção externa do cromatógrafo: limpeza do gabinete, conferência das linhas de gás, filtros e pressões de arraste.", local: "TUBARAO", equipamento: "CG-TUB01", prioridade: "Médio", inicio: 0, duracao: 1, ciclo: "semestral", cenario: "em_execucao", dupla: ["2004", "2002"] },
  { centro: "LAB_QUI", tipo: "YBA1", atividade: null, titulo: "Coleta de amostra para análise da qualidade do gás", descricao: "Coleta de amostra no ponto de entrega para análise de composição, umidade e teor de enxofre, a pedido da qualidade.", local: "TUBARAO", equipamento: "PC-TUB-0001", prioridade: "Médio", inicio: -3, duracao: 1, solicitante: "Qualidade", cenario: "aguardando" },
  { centro: "LAB_QUI", tipo: "YBA1", atividade: "Análise de combustão", titulo: "Análise de combustão em caldeira de cliente", descricao: "Medir os gases de combustão da caldeira, registrar o CO e o excesso de ar e orientar o ajuste do queimador.", local: "GUARAPARI", equipamento: "CD-GUA-0002", prioridade: "Médio", inicio: -6, duracao: 1, solicitante: "Atendimento Comercial", cenario: "encerrada" },
  { centro: "LAB_QUI", tipo: "YBA1", atividade: null, titulo: "Coleta de amostra em estação com suspeita de condensado", descricao: "Suspeita de condensado na linha de entrada. Coletar amostra do líquido, medir a umidade do gás e registrar o ponto de orvalho.", local: "ARACRUZ", equipamento: "ERS-ARA-0005", prioridade: "Muito alto", inicio: -1, duracao: 1, cenario: "bloqueada" },
];

const LOTES: Record<string, { primeiro: number; ordens: Ordem[] }> = {
  "1": { primeiro: 4100001, ordens: LOTE_1 },
  "2": { primeiro: 4100026, ordens: LOTE_2 },
};

const CRIADORES = ["RFAVARO", "MSANTOS", "LCARDOSO", "TPEREIRA"];

const escolhidos = process.argv.slice(2);
if (escolhidos.length === 0 || escolhidos.some((k) => !LOTES[k])) {
  console.error(`Uso: pnpm demo:criar-os <lote> [<lote>...]  (lotes: ${Object.keys(LOTES).join(", ")})`);
  process.exit(1);
}
/** As OS dos lotes pedidos, com o número da ordem de cada uma. */
const selecionadas = escolhidos.flatMap((k) => LOTES[k]!.ordens.map((o, i) => ({ o, i, numero: LOTES[k]!.primeiro + i })));

const somaDias = (base: Date, dias: number) => new Date(base.getTime() + dias * 86_400_000).toISOString().slice(0, 10);

/** Os pedidos de cenário de todos os lotes juntos: as duplas e as horas não mudam conforme o lote que roda. */
const pedidos: PedidoDeCenario[] = Object.values(LOTES).flatMap((l) =>
  l.ordens.map((o, i) => ({ numeroOrdem: String(l.primeiro + i), centro: o.centro, cenario: o.cenario ?? "liberada", diasAtras: Math.max(0, -o.inicio), ...(o.dupla && { dupla: o.dupla }), ...(o.motivo && { motivo: o.motivo }) })),
);
const numerosDoLote = new Set(selecionadas.map((s) => String(s.numero)));

const config = lerConfig();
const { pool, db } = conectar(config.databaseUrl);
try {
  planejar(pedidos); // recusa, antes de gravar qualquer coisa, a pessoa que estaria em duas OS ao mesmo tempo

  const agora = new Date();
  const linhas = selecionadas.map(({ o, i, numero }) => {
    const local = LOCAIS.find((l) => l.codigo.startsWith(`${o.local}/`));
    if (!local) throw new Error(`Local desconhecido: ${o.local}`);
    const preventiva = o.tipo === "YBA2";
    return {
      numeroOrdem: String(numero),
      numeroNota: preventiva ? null : String(10_020_000 + numero - 4_100_000),
      tipoOrdem: o.tipo,
      tipoAtividade: preventiva ? "Z02-Manutenção Preventiva" : "Z01-Manutenção Corretiva",
      codigoAtividade: o.atividade,
      titulo: o.titulo,
      descricao: o.descricao,
      centroTrabalho: o.centro,
      localCodigo: local.codigo,
      localEndereco: local.endereco,
      localPlusCode: local.plus_code,
      localCliente: local.cliente,
      equipamento: o.equipamento,
      prioridade: o.prioridade,
      dataInicioProg: somaDias(agora, o.inicio),
      dataFimProg: somaDias(agora, o.inicio + o.duracao),
      statusSap: "LIB IMPR",
      solicitante: o.solicitante ?? null,
      criadoPor: CRIADORES[i % CRIADORES.length]!,
      criadaEm: new Date(agora.getTime() - (i + 1) * 3_600_000),
      planoManutencao: preventiva ? String(20_000 + numero - 4_100_000) : null,
      itemManutencao: preventiva ? String(30_000 + numero - 4_100_000) : null,
      intervaloCiclo: preventiva && o.ciclo ? o.ciclo : null,
      alteradaEm: agora,
    };
  });

  // Uma ordem que já está no simulador mantém tudo, menos as datas (o planejamento mudou: o SAP "reprogramou" a ordem).
  const gravadas = await db
    .insert(ordemSapSimulada)
    .values(linhas)
    .onConflictDoUpdate({ target: ordemSapSimulada.numeroOrdem, set: { dataInicioProg: sql`excluded.data_inicio_prog`, dataFimProg: sql`excluded.data_fim_prog`, alteradaEm: agora } })
    .returning({ n: ordemSapSimulada.numeroOrdem });
  console.log(`SAP simulado: ${gravadas.length} ordem(ns) gravada(s) ou atualizada(s).`);

  // Leituras de verdade do simulador, como a agendada: só o que o executor usa das dependências.
  const depsDaLeitura = {
    db,
    agora: () => new Date(),
    sap: { listarOrdens: (o: { alteradasDesde?: Date; pagina: number; tamanho: number }) => paginaDoContrato(db, o), obterOrdem: async () => null },
  } as unknown as Deps;
  const ler = async () => {
    const r = await executarLeitura(depsDaLeitura);
    if (r.erro) throw new Error(`A leitura falhou: ${r.erro}`);
    console.log(`Leitura do SAP: ${r.criadas} OS criada(s), ${r.atualizadas} atualizada(s), ${r.ignoradas.length} ignorada(s), ${r.avisos.length} aviso(s).`);
    for (const i of r.ignoradas) console.log(`  ignorada ${i.numero_ordem ?? `linha ${i.linha}`}: ${i.motivo}`);
    for (const a of r.avisos) console.log(`  aviso ${a.numero_ordem}: ${a.motivo}`);
  };
  await ler();

  // A cancelada é cancelada no SAP: a ordem perde o LIB no simulador e a leitura seguinte traz isso.
  const canceladas = pedidos.filter((p) => p.cenario === "cancelada" && numerosDoLote.has(p.numeroOrdem)).map((p) => p.numeroOrdem);
  if (canceladas.length > 0) {
    await db.update(ordemSapSimulada).set({ statusSap: "CRTD", alteradaEm: new Date() }).where(inArray(ordemSapSimulada.numeroOrdem, canceladas));
    await ler();
  }

  const resultado = await conduzirCenarios({ db, config }, pedidos, numerosDoLote);

  // No SAP, a OS que o SYNQ OS encerrou (com a ciência do supervisor) está encerrada também; as demais seguem liberadas.
  const encerradas = Object.entries(resultado).filter(([, s]) => s === "encerrada").map(([n]) => n);
  if (encerradas.length > 0) await db.update(ordemSapSimulada).set({ statusSap: "ENCE" }).where(inArray(ordemSapSimulada.numeroOrdem, encerradas));

  const porStatus: Record<string, number> = {};
  for (const s of Object.values(resultado)) porStatus[s] = (porStatus[s] ?? 0) + 1;
  console.log("Status das OS desta rodada:", porStatus);
} finally {
  await pool.end();
}
