"use client";

import { useState } from "react";
import { z } from "zod";
import { JanelaDeAssinatura } from "@/components/ausencia/JanelaDeAssinatura";
import { Button } from "@/components/ui/Button";
import { Field, ligarAoErro } from "@/components/ui/Field";
import { useFormulario } from "@/components/ui/useFormulario";
import { chamar } from "@/lib/cliente-api";
import type { Usuario } from "@/lib/tipos";
import { useMinhaAssinatura } from "@/state/minha-assinatura";
import { useToast } from "@/state/toast";

type Alvo = Pick<Usuario, "id" | "nome">;

const esquemaDoMotivo = z.object({
  motivo: z.string().trim().min(3, "Informe o motivo da recusa, com pelo menos 3 caracteres.").max(500, "O motivo pode ter até 500 caracteres."),
});

/** Janela para liberar o cadastro pendente: o admin assina a decisão (`POST /usuarios/{id}/liberar`). */
export function JanelaLiberar({ usuario, aoFechar }: { usuario: Alvo; aoFechar: () => void }) {
  const exibirAviso = useToast();
  const assinaturaPath = useMinhaAssinatura();

  return (
    <JanelaDeAssinatura
      titulo="Liberar cadastro"
      resumo={
        <>
          Liberar o acesso de <b>{usuario.nome}</b>? A pessoa passa a usar o sistema todo e vai cadastrar a assinatura dela no primeiro acesso.
        </>
      }
      rotuloConfirmar="Assinar e liberar"
      assinaturaPath={assinaturaPath}
      aoConfirmar={async () => {
        await chamar("POST", `/usuarios/${usuario.id}/liberar`);
        exibirAviso(`${usuario.nome} foi liberado(a): o acesso geral já vale.`);
      }}
      aoFechar={aoFechar}
    />
  );
}

/** Janela para recusar um cadastro pendente: o motivo é obrigatório, vai para quem for tentar entrar, e o admin assina a decisão (`POST /usuarios/{id}/recusar`). */
export function JanelaRecusar({ usuario, aoFechar }: { usuario: Alvo; aoFechar: () => void }) {
  const exibirAviso = useToast();
  const assinaturaPath = useMinhaAssinatura();
  const { form, validar } = useFormulario(esquemaDoMotivo, { motivo: "" });
  const erro = form.formState.errors.motivo?.message;

  return (
    <JanelaDeAssinatura
      titulo="Recusar cadastro"
      tom="d"
      resumo={
        <>
          Recusar o cadastro de <b>{usuario.nome}</b>? A pessoa deixa de entrar no sistema e vê o motivo abaixo ao tentar. Depois você pode excluir o cadastro para liberar o e-mail e a matrícula.
        </>
      }
      rotuloConfirmar="Assinar e recusar"
      assinaturaPath={assinaturaPath}
      validar={validar}
      aoConfirmar={async () => {
        await chamar("POST", `/usuarios/${usuario.id}/recusar`, { motivo: form.getValues("motivo").trim() });
        exibirAviso(`O cadastro de ${usuario.nome} foi recusado.`);
      }}
      aoFechar={aoFechar}
    >
      <Field label="Motivo da recusa (obrigatório)" htmlFor="recusa-motivo" erro={erro}>
        <textarea className="textarea" rows={3} maxLength={500} autoFocus {...form.register("motivo")} {...ligarAoErro("recusa-motivo", erro)} />
      </Field>
    </JanelaDeAssinatura>
  );
}

/** Botões "Liberar" e "Recusar" de um cadastro pendente (painel de pendentes do admin): cada um abre a janela da assinatura. */
export function BotoesLiberacao({ usuario }: { usuario: Alvo }) {
  const [janela, setJanela] = useState<"liberar" | "recusar" | null>(null);
  const fechar = () => setJanela(null);
  return (
    <span className="row g8">
      <Button variant="p" sm onClick={() => setJanela("liberar")} aria-label={`Liberar ${usuario.nome}`}>
        Liberar
      </Button>
      <Button variant="line" sm onClick={() => setJanela("recusar")} aria-label={`Recusar ${usuario.nome}`}>
        Recusar
      </Button>
      {janela === "liberar" && <JanelaLiberar usuario={usuario} aoFechar={fechar} />}
      {janela === "recusar" && <JanelaRecusar usuario={usuario} aoFechar={fechar} />}
    </span>
  );
}
