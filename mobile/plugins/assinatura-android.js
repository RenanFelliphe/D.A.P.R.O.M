const { withAppBuildGradle } = require("expo/config-plugins");

/**
 * Assina o APK de release com a chave que o build recebe por variável de ambiente (o Dockerfile do `mobile` as define; ver `docker/gerar-apk.sh`):
 *
 *   SYNQOS_KEYSTORE        caminho do arquivo .keystore
 *   SYNQOS_KEYSTORE_SENHA  senha do arquivo e da chave
 *   SYNQOS_CHAVE_ALIAS     apelido da chave (padrão "synqos")
 *
 * As variáveis são lidas pelo Gradle na hora de montar o APK: a senha nunca é escrita em arquivo do projeto, e a chave nunca fica no repositório.
 * Sem `SYNQOS_KEYSTORE` (`pnpm android`, o build de desenvolvimento), nada muda: o release continua com a chave de depuração do template.
 */
const MARCA = "synqos-assinatura";

const BLOCO_DA_CHAVE = `
        release { // ${MARCA}
            if (System.getenv("SYNQOS_KEYSTORE")) {
                storeFile file(System.getenv("SYNQOS_KEYSTORE"))
                storePassword System.getenv("SYNQOS_KEYSTORE_SENHA")
                keyAlias System.getenv("SYNQOS_CHAVE_ALIAS") ?: "synqos"
                keyPassword System.getenv("SYNQOS_KEYSTORE_SENHA")
            }
        }`;

/** Troca a chave do `release` e declara a chave de release. Lança se o template do Expo mudou e o texto esperado não existe mais. */
function aplicarAssinatura(gradle) {
  if (gradle.includes(MARCA)) return gradle;

  const noRelease = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
  if (!noRelease.test(gradle)) {
    throw new Error("assinatura-android: o `release` do build.gradle do template mudou; ajuste plugins/assinatura-android.js.");
  }
  const comEscolha = gradle.replace(
    noRelease,
    `$1signingConfig System.getenv("SYNQOS_KEYSTORE") ? signingConfigs.release : signingConfigs.debug`,
  );

  const nasChaves = /(signingConfigs\s*\{)/;
  if (!nasChaves.test(comEscolha)) {
    throw new Error("assinatura-android: o bloco `signingConfigs` do build.gradle do template mudou; ajuste plugins/assinatura-android.js.");
  }
  return comEscolha.replace(nasChaves, `$1${BLOCO_DA_CHAVE}`);
}

module.exports = function assinaturaAndroid(config) {
  return withAppBuildGradle(config, (c) => {
    if (c.modResults.language !== "groovy") {
      throw new Error("assinatura-android: só o build.gradle em Groovy é tratado.");
    }
    c.modResults.contents = aplicarAssinatura(c.modResults.contents);
    return c;
  });
};

module.exports.aplicarAssinatura = aplicarAssinatura;
