/** Dados da tela "OS da equipe" do app. */

import type { BadgeTone } from "@/components/ui/Badge";
import type { IconName } from "@/components/ui/Icon";
import { rotas } from "@/lib/telas";

export type StatusOs = "blq" | "lib" | "exe" | "enc";

/** Selo de cada status da OS. */
export const statusOs: Record<StatusOs, { tone: BadgeTone; rotulo: string }> = {
  blq: { tone: "blq", rotulo: "Pendente" },
  lib: { tone: "lib", rotulo: "Liberada" },
  exe: { tone: "exe", rotulo: "Em execução" },
  enc: { tone: "enc", rotulo: "Encerrada" },
};

export interface OsApp {
  numero: string;
  tipo: "Preventiva" | "Corretiva";
  status: StatusOs;
  titulo: string;
  icone: IconName;
  detalhe: string;
  /** Sem destino = OS encerrada, renderizada como botão. */
  href?: string;
  /** Mensagem do botão quando não há destino. */
  aviso?: string;
}

export interface GrupoOsApp {
  nome: string;
  criticidade?: string;
  resumo: string;
  os: OsApp[];
}

export type FiltroOsId = "todas" | StatusOs;

export interface FiltroOs {
  id: FiltroOsId;
  rotulo: string;
}

export const filtrosOs: FiltroOs[] = [
  { id: "todas", rotulo: "Todas · 6" },
  { id: "lib", rotulo: "Liberadas · 2" },
  { id: "exe", rotulo: "Em execução · 1" },
  { id: "blq", rotulo: "Pendentes · 2" },
  { id: "enc", rotulo: "Encerradas · 1" },
];

export const gruposOs: GrupoOsApp[] = [
  {
    nome: "ERP Serra",
    criticidade: "Local crítico",
    resumo: "3 OS · uma APR por OS",
    os: [
      {
        numero: "4031187",
        tipo: "Preventiva",
        status: "blq",
        titulo: "Inspeção de corrosão em válvulas da ERP",
        icone: "lock",
        detalhe: "APR negativa em 12/10 · faça uma APR nova",
        href: rotas.app.detalhe,
      },
      {
        numero: "4031190",
        tipo: "Preventiva",
        status: "lib",
        titulo: "Calibração da PSV da linha 2",
        icone: "clock",
        detalhe: "Prog. 13/10 · Prioridade alta · APR 03",
        href: rotas.app.detalhe,
      },
      {
        numero: "4031204",
        tipo: "Preventiva",
        status: "lib",
        titulo: "Teste de estanqueidade do filtro F-201",
        icone: "clock",
        detalhe: "Prog. 13/10 · Prioridade média · APR 03",
        href: rotas.app.detalhe,
      },
    ],
  },
  {
    nome: "Mineração Atlântica",
    criticidade: "Cliente crítico",
    resumo: "1 OS",
    os: [
      {
        numero: "4031012",
        tipo: "Corretiva",
        status: "exe",
        titulo: "Vazamento em conexão do medidor industrial",
        icone: "user",
        detalhe: "Iniciada 08:41 · Fernanda Lopes",
        href: rotas.app.execucao,
      },
    ],
  },
  {
    nome: "Rede Vila Velha",
    resumo: "1 OS",
    os: [
      {
        numero: "4030877",
        tipo: "Corretiva",
        status: "blq",
        titulo: "DCV Desobstrução de caixa de válvula",
        icone: "lock",
        detalhe: "APR negativa em 12/10 · aguardando nova APR",
        href: rotas.app.bloqueio,
      },
    ],
  },
  {
    nome: "ERS Vila Velha 02",
    resumo: "1 OS",
    os: [
      {
        numero: "4030951",
        tipo: "Preventiva",
        status: "enc",
        titulo: "Pintura anticorrosiva de suportes",
        icone: "file",
        detalhe: "Encerrada 12/10 · PDF gerado",
        aviso: "OS encerrada e já enviada ao servidor.",
      },
    ],
  },
];
