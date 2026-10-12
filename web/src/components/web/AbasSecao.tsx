"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";

export interface AbaDaSecao {
  href: string;
  rotulo: string;
  icone: IconName;
}

interface AbasSecaoProps {
  rotulo: string;
  abas: AbaDaSecao[];
  /** Parâmetros da URL que acompanham a troca de aba (o filtro comum dos dashboards: período e equipe). */
  manterConsulta?: string[];
}

function Abas({ rotulo, abas, consulta }: { rotulo: string; abas: AbaDaSecao[]; consulta: string }) {
  const pathname = usePathname();
  return (
    <nav className="abas" aria-label={rotulo}>
      {abas.map((aba) => (
        <Link
          key={aba.href}
          href={consulta ? `${aba.href}?${consulta}` : aba.href}
          aria-current={pathname === aba.href || pathname.startsWith(`${aba.href}/`) ? "page" : undefined}
        >
          <Icon name={aba.icone} size={16} />
          {aba.rotulo}
        </Link>
      ))}
    </nav>
  );
}

function AbasComConsulta({ rotulo, abas, manterConsulta }: Required<AbasSecaoProps>) {
  const atuais = useSearchParams();
  const consulta = new URLSearchParams();
  for (const chave of manterConsulta) {
    const valor = atuais.get(chave);
    if (valor) consulta.set(chave, valor);
  }
  return <Abas rotulo={rotulo} abas={abas} consulta={consulta.toString()} />;
}

/**
 * Abas de uma seção do painel (Ordem de Serviço, APR, Dashboard); a da tela atual fica marcada, inclusive
 * nas subpáginas dela (o layout não sabe o endereço, por isso é cliente).
 */
export function AbasSecao({ rotulo, abas, manterConsulta }: AbasSecaoProps) {
  if (!manterConsulta?.length) return <Abas rotulo={rotulo} abas={abas} consulta="" />;
  return (
    <Suspense fallback={<Abas rotulo={rotulo} abas={abas} consulta="" />}>
      <AbasComConsulta rotulo={rotulo} abas={abas} manterConsulta={manterConsulta} />
    </Suspense>
  );
}
