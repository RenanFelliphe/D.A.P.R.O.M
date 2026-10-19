import type { ImageSourcePropType } from "react-native";
import type { Reacao } from "@shared/vitoria/reacoes";

/**
 * A foto de perfil da Vitória (sempre a mesma) e as figurinhas de cada reação, copiadas de `web/public/vitoria/` (geradas por
 * `web/scripts/gerar-vitoria.mjs`). Cada reação tem o quadro parado e a animação. Os `require` são literais: o Metro só empacota o que
 * consegue ler.
 */
export const FOTO_DA_VITORIA: ImageSourcePropType = require("../../assets/vitoria/icone.webp");

export const QUADRO_DA_REACAO: Record<Reacao, ImageSourcePropType> = {
  ola: require("../../assets/vitoria/reacao-ola-quadro.webp"),
  certo: require("../../assets/vitoria/reacao-certo-quadro.webp"),
  atencao: require("../../assets/vitoria/reacao-atencao-quadro.webp"),
  comemorando: require("../../assets/vitoria/reacao-comemorando-quadro.webp"),
  errada: require("../../assets/vitoria/reacao-errada-quadro.webp"),
  pensando: require("../../assets/vitoria/reacao-pensando-quadro.webp"),
  triste: require("../../assets/vitoria/reacao-triste-quadro.webp"),
  surpresa: require("../../assets/vitoria/reacao-surpresa-quadro.webp"),
  vergonha: require("../../assets/vitoria/reacao-vergonha-quadro.webp"),
  fofo: require("../../assets/vitoria/reacao-fofo-quadro.webp"),
};

export const ANIMACAO_DA_REACAO: Record<Reacao, ImageSourcePropType> = {
  ola: require("../../assets/vitoria/reacao-ola.webp"),
  certo: require("../../assets/vitoria/reacao-certo.webp"),
  atencao: require("../../assets/vitoria/reacao-atencao.webp"),
  comemorando: require("../../assets/vitoria/reacao-comemorando.webp"),
  errada: require("../../assets/vitoria/reacao-errada.webp"),
  pensando: require("../../assets/vitoria/reacao-pensando.webp"),
  triste: require("../../assets/vitoria/reacao-triste.webp"),
  surpresa: require("../../assets/vitoria/reacao-surpresa.webp"),
  vergonha: require("../../assets/vitoria/reacao-vergonha.webp"),
  fofo: require("../../assets/vitoria/reacao-fofo.webp"),
};
