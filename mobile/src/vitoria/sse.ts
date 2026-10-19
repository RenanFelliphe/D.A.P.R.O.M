/** Um evento do fluxo SSE da `api` (`event:` e `data:`). */
export interface EventoSse {
  event: string;
  data: string;
}

/**
 * Lê o texto inteiro de uma resposta `text/event-stream`: blocos separados por linha em branco, cada um com `event: <nome>` e uma ou mais
 * linhas `data: <texto>`. O React Native não entrega o corpo aos poucos, e a `api` manda a resposta da Vitória de uma vez, então o app
 * espera o corpo todo e o lê aqui.
 */
export function lerEventosSse(texto: string): EventoSse[] {
  const eventos: EventoSse[] = [];
  for (const bloco of texto.replace(/\r\n/g, "\n").split("\n\n")) {
    if (!bloco.trim()) continue;
    const linhas = bloco.split("\n");
    const event = linhas.find((l) => l.startsWith("event: "))?.slice("event: ".length) ?? "message";
    const data = linhas
      .filter((l) => l.startsWith("data: "))
      .map((l) => l.slice("data: ".length))
      .join("\n");
    eventos.push({ event, data });
  }
  return eventos;
}
