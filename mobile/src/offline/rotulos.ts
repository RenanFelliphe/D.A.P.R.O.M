/** Como a pessoa lê cada tipo de evento de campo (a lista de registros recusados). */
const ROTULOS: Record<string, string> = {
  apr_concluida: "APR registrada",
  apr_assinada: "Assinatura da APR",
  apr_recusada: "Recusa da APR",
  execucao_iniciada: "Início da execução",
  pausa_iniciada: "Pausa",
  pausa_encerrada: "Fim da pausa",
  execucao_encerrada: "Encerramento da OS",
  encerramento_assinado: "Assinatura do encerramento",
  execucao_interrompida: "Interrupção por risco",
  execucao_suspensa: "Suspensão da execução",
  execucao_cancelada: "Cancelamento da execução",
  emergencia_acionada: "Emergência acionada",
};

export const rotuloDoEvento = (tipo: string): string => ROTULOS[tipo] ?? "Registro de campo";
