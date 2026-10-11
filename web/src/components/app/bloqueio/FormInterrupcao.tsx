import { BotaoAviso } from "@/components/ui/Aviso";
import { Field, Req } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";

const tamanhoFoto = { width: 112, height: 112 };

/** Observação e foto exigidas ao interromper a execução por risco. */
export function FormInterrupcao() {
  return (
    <div className="panel" style={{ gap: 14 }}>
      <Field
        label={
          <>
            Observação <Req>· obrigatória</Req>
          </>
        }
        htmlFor="obs"
      >
        <textarea className="textarea" id="obs" rows={3} placeholder="Descreva o motivo da interrupção" defaultValue="" />
      </Field>
      <Field
        label={
          <>
            Foto do impedimento <Req>· ao menos 1</Req>
          </>
        }
      >
        <div className="row g8">
          <div className="photo" role="img" aria-label="Foto 1: caixa de válvula alagada" style={tamanhoFoto}>
            <Icon name="image" size={18} />
            <span>
              Foto 1<br />
              09:14 · GPS ok
            </span>
          </div>
          <BotaoAviso className="photo-add" aviso="Abriria a câmera do aparelho." style={tamanhoFoto}>
            <Icon name="camera" size={24} />
            Adicionar
          </BotaoAviso>
        </div>
      </Field>
    </div>
  );
}
