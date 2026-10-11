import { BotaoAviso } from "@/components/ui/Aviso";
import { Req } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { fotosExecucao } from "@/data/execucao";

/** Grade de fotos já anexadas e botão para adicionar mais. */
export function FotosExecucao() {
  return (
    <div className="field">
      <div className="row between">
        <label>
          Fotos <Req style={{ color: "var(--exe)" }}>· ao menos 1</Req>
        </label>
        <span className="small">3 fotos · com data, hora e GPS</span>
      </div>
      <div className="photo-grid">
        {fotosExecucao.map((hora) => (
          <div key={hora} className="photo sq" role="img" aria-label={`Foto das ${hora}`}>
            <Icon name="image" size={16} />
            <span className="mono">{hora}</span>
          </div>
        ))}
        <BotaoAviso
          className="photo-add sq"
          aria-label="Adicionar foto"
          aviso="Abriria a câmera do aparelho."
          style={{ aspectRatio: "1/1" }}
        >
          <Icon name="camera" size={24} />
        </BotaoAviso>
      </div>
    </div>
  );
}
