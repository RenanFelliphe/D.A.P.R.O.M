// Confere o manifesto de destinos da Vitória (`shared/vitoria/destinos.ts`) contra o resto do repositório, sem
// servidor e sem navegador, no padrão de `web/scripts/verificar-treino.mts`:
//   1. cada destino do manifesto corresponde a algo real em `web/src/lib/rotas.ts` (o manifesto não importa `rotas.ts`
//      de propósito — são fontes independentes — então esta é a rede de segurança contra uma tela que mudou de
//      endereço sem o manifesto acompanhar);
//   2. toda chave citada nos manuais (`api/conteudo/vitoria/*.md`) existe no manifesto.
//
//   cd api && node --import tsx scripts/verificar-manifesto-vitoria.mts
import assert from "node:assert/strict";
import { DESTINOS } from "../../shared/vitoria/destinos";
import { todasAsChavesCitadas } from "../src/dominio/vitoria-manual";
import { rotas } from "../../web/src/lib/rotas";

const EXEMPLO = "ABC123";

function baseSemConsultaOuAncora(url: string): string {
  return url.split("?")[0]!.split("#")[0]!;
}

/** Percorre `rotas.ts` juntando toda string literal (destinos fixos) e todo gabarito gerado por uma função (destinos com parâmetro). */
function coletarDeRotas(valor: unknown, literais: Set<string>, gerados: Set<string>) {
  if (typeof valor === "string") {
    literais.add(valor);
  } else if (typeof valor === "function") {
    try {
      const exemplo = (valor as (...args: string[]) => string)(EXEMPLO);
      if (typeof exemplo === "string") gerados.add(exemplo);
    } catch {
      /* função com assinatura diferente de (string) => string: não é um destino da Vitória */
    }
  } else if (valor && typeof valor === "object") {
    for (const v of Object.values(valor)) coletarDeRotas(v, literais, gerados);
  }
}

const literais = new Set<string>();
const gerados = new Set<string>();
coletarDeRotas(rotas, literais, gerados);

let conferidos = 0;
for (const [chave, destino] of Object.entries(DESTINOS)) {
  if (destino.forma === "fixo") {
    assert.ok(literais.has(destino.caminho), `destinos.ts: "${chave}" (fixo) aponta para "${destino.caminho}", que não existe em rotas.ts`);
  } else if (destino.forma === "com_contexto") {
    const exemplo = destino.modelo.replace(`{${destino.campo}}`, EXEMPLO);
    assert.ok(gerados.has(exemplo), `destinos.ts: "${chave}" (com_contexto) gera "${exemplo}", que nenhuma função de rotas.ts produz`);
  } else {
    const exemplo = baseSemConsultaOuAncora(destino.modelo.replace(`{${destino.campo}}`, EXEMPLO));
    assert.ok(literais.has(exemplo) || gerados.has(exemplo), `destinos.ts: "${chave}" (com_filtro) tem a base "${exemplo}", que não existe em rotas.ts`);
  }
  conferidos++;
}
console.log(`ok 1 - ${conferidos} destinos do manifesto correspondem a um endereço real de rotas.ts`);

const citadas = todasAsChavesCitadas();
assert.ok(citadas.length > 0, "nenhuma chave [entre colchetes] foi encontrada nos manuais: a extração de entradas pode ter quebrado");
for (const { perfil, chave } of citadas) {
  assert.ok(chave in DESTINOS, `manual-${perfil}.md cita a chave "${chave}", que não existe em destinos.ts`);
}
console.log(`ok 2 - ${citadas.length} chaves citadas nos manuais existem no manifesto`);
