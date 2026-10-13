/**
 * Gera um PDF de exemplo no layout da "Ordem de Manutenção" impressa pelo SAP, com texto (como o SAP gera), para testar a
 * importação por PDF na aba Importação de OS. Os PDFs de `base/os-examples` são digitalizações (só imagem) e não servem.
 *
 *   pnpm pdf:exemplo                  -> grava ./ordens-exemplo.pdf
 *   pnpm pdf:exemplo -- saida.pdf     -> grava no caminho dado
 *
 * Contra a api local (`pnpm dev:local`), o PDF traz três situações: a 4023470, que já existe (veio do SAP simulado: só o
 * planejamento muda); a 4032001, nova, do centro INSTRUM; e a 4019821 do centro PROT_CAT, que não tem equipe no modo
 * local (a conferência avisa que ela fica de fora).
 */
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CORRETIVA_4023470, gerarPdfDeOs, PREVENTIVA_4019821 } from "../test/fixture-pdf-os";

const destino = resolve(process.argv.slice(2).find((a) => a !== "--") ?? "ordens-exemplo.pdf");
const pdf = await gerarPdfDeOs([
  CORRETIVA_4023470,
  {
    ...PREVENTIVA_4019821,
    numero: "4032001",
    dataOrdem: "05/10/2026",
    impressao: "10/10/2026",
    centroPrincipal: "INSTRUM",
    descricaoCentro: "Instrumentação",
    titulo: "Calibração do manômetro da ERP Serra",
    local: "ERP SERRA/ESTACAO ERP SERRA",
    equipamento: "MAN-ERP01-004",
    plano: "10580",
    item: "10611",
    inicio: "20/10/2026",
    fim: "21/10/2026",
    prioridade: "Médio",
    textoLongo: ["Calibrar o manômetro de entrada contra o padrão.", "Registrar as leituras antes e depois do ajuste."],
  },
  PREVENTIVA_4019821,
]);
await writeFile(destino, pdf);
console.log(`PDF de exemplo gravado em ${destino}`);
