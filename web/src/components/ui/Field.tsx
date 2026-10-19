import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Icon } from "./Icon";

interface FieldProps {
  label: ReactNode;
  htmlFor?: string;
  labelStyle?: CSSProperties;
  className?: string;
  /** Mensagem de validação: aparece logo abaixo do controle e marca o campo (o foco vai para ele ao tentar enviar). */
  erro?: string;
  children: ReactNode;
}

/** Id da mensagem de erro de um controle: o `aria-describedby` dele aponta para cá. */
export const idDoErro = (id: string) => `${id}-erro`;

/**
 * A mensagem de erro de um campo (`.field-erro`): em destaque, com ícone, e lida pelos leitores de tela assim que aparece
 * (`role="alert"`). É o lugar certo para dizer por que o formulário não foi enviado, no campo e não num rodapé.
 */
export function MensagemDeErro({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <span id={id} role="alert" className="field-erro">
      <Icon name="alert" size={13} />
      <span>{children}</span>
    </span>
  );
}

/**
 * Os atributos de acessibilidade de um controle que tem (ou pode ter) erro: `id`, `aria-invalid` e `aria-describedby`.
 * Use junto do `register` do React Hook Form: `<input {...register("motivo")} {...ligarAoErro("motivo", erros.motivo?.message)} />`.
 */
export function ligarAoErro(id: string, erro?: string) {
  return { id, "aria-invalid": erro ? (true as const) : undefined, "aria-describedby": erro ? idDoErro(id) : undefined };
}

/** Campo de formulário: rótulo + controle (.field) e, se houver, a mensagem de erro. */
export function Field({ label, htmlFor, labelStyle, className, erro, children }: FieldProps) {
  return (
    <div className={cx("field", className)} data-erro={erro ? "" : undefined}>
      <label htmlFor={htmlFor} style={labelStyle}>
        {label}
      </label>
      {children}
      {erro && <MensagemDeErro id={htmlFor ? idDoErro(htmlFor) : undefined}>{erro}</MensagemDeErro>}
    </div>
  );
}

/**
 * Um controle sem rótulo (a célula de uma tabela editável) com a mensagem de erro logo abaixo, em vermelho. Marca o campo
 * (`data-erro`) como o `Field`, para o foco ir até ele ao tentar enviar. O controle usa `ligarAoErro(id, erro)`.
 */
export function CampoDeCelula({ id, erro, children }: { id: string; erro?: string; children: ReactNode }) {
  return (
    <div className="celula-campo" data-erro={erro ? "" : undefined}>
      {children}
      {erro && <MensagemDeErro id={idDoErro(id)}>{erro}</MensagemDeErro>}
    </div>
  );
}

/** Complemento "· obrigatória" do rótulo (.req). */
export function Req({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span className="req" style={style}>
      {children}
    </span>
  );
}
