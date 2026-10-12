import Link from "next/link";
import { Notice } from "@/components/ui/Notice";
import { rotas } from "@/lib/rotas";

/** Importação aberta pelo endereço por quem não tem a aba (supervisor e Segurança do Trabalho). */
export function AcessoRestrito() {
  return (
    <Notice tone="al" icon="lock" style={{ fontSize: 14.5 }}>
      Esta aba é do analista e do administrador. Você pode acompanhar as OS no <Link href={rotas.web.quadro}>quadro</Link>.
    </Notice>
  );
}
