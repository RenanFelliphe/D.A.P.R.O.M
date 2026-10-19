const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// `shared/` fica fora de `mobile/` e é o mesmo código da `web` e da `api` (tipos, regras puras, textos da Vitória e dos avisos).
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, "..", "shared")];

module.exports = config;
