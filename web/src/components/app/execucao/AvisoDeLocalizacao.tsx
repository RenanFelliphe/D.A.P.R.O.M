import { Icon } from "@/components/ui/Icon";
import { AVISO_DE_LOCALIZACAO } from "@/lib/geolocalizacao";

/** O aviso de privacidade (LGPD) junto dos botões e das janelas que registram a localização: discreto, mas visível. */
export function AvisoDeLocalizacao() {
  return (
    <p className="small row g8" style={{ alignItems: "flex-start" }} data-aviso-localizacao>
      <Icon name="pin" size={13} style={{ marginTop: 2, flex: "none" }} />
      <span>{AVISO_DE_LOCALIZACAO}</span>
    </p>
  );
}
