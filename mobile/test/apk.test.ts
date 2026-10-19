import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";
import { ErroDeOpcoes, montarArgumentosDoDocker } from "../scripts/apk-comando";

const exigir = createRequire(__filename);
const { aplicarAssinatura } = exigir("../plugins/assinatura-android.js") as { aplicarAssinatura: (gradle: string) => string };

describe("comando do docker que gera o APK", () => {
  it("monta o build com o alvo `saida`, o endereço da api e o contexto na raiz", () => {
    const args = montarArgumentosDoDocker({ api: "https://api.exemplo.com.br/", saida: "/tmp/apk" });
    assert.deepEqual(args.slice(0, 7), ["build", "-f", "mobile/Dockerfile", "--target", "saida", "--output", "type=local,dest=/tmp/apk"]);
    assert.ok(args.includes("EXPO_PUBLIC_API_URL=https://api.exemplo.com.br"), "sem a barra final");
    assert.equal(args.at(-1), ".");
    assert.ok(!args.some((a) => a.startsWith("--secret")), "sem chave, sem segredos");
  });

  it("repassa versão, arquiteturas, web e os dois segredos da chave", () => {
    const args = montarArgumentosDoDocker({
      api: "https://api.exemplo.com.br",
      web: "https://app.exemplo.com.br/",
      versionCode: 7,
      arquiteturas: "arm64-v8a,x86_64",
      chave: "/k/synqos.keystore",
      senha: "/k/synqos.senha",
      saida: "/tmp/apk",
    });
    for (const esperado of ["APP_VERSION_CODE=7", "ARQUITETURAS=arm64-v8a,x86_64", "EXPO_PUBLIC_WEB_URL=https://app.exemplo.com.br", "id=chave,src=/k/synqos.keystore", "id=chave_senha,src=/k/synqos.senha"]) {
      assert.ok(args.includes(esperado), esperado);
    }
  });

  it("recusa http:// sem --http, aceita com ele e liga APP_PERMITIR_HTTP", () => {
    assert.throws(() => montarArgumentosDoDocker({ api: "http://192.168.0.10:3333", saida: "x" }), ErroDeOpcoes);
    const args = montarArgumentosDoDocker({ api: "http://192.168.0.10:3333", permitirHttp: true, saida: "x" });
    assert.ok(args.includes("APP_PERMITIR_HTTP=true"));
  });

  it("recusa api vazia ou sem protocolo", () => {
    assert.throws(() => montarArgumentosDoDocker({ api: "  ", saida: "x" }), ErroDeOpcoes);
    assert.throws(() => montarArgumentosDoDocker({ api: "api.exemplo.com.br", saida: "x" }), ErroDeOpcoes);
  });

  it("recusa chave sem senha (e o contrário), versão inválida e arquitetura desconhecida", () => {
    const base = { api: "https://a.com", saida: "x" };
    assert.throws(() => montarArgumentosDoDocker({ ...base, chave: "/k" }), ErroDeOpcoes);
    assert.throws(() => montarArgumentosDoDocker({ ...base, senha: "/s" }), ErroDeOpcoes);
    assert.throws(() => montarArgumentosDoDocker({ ...base, versionCode: 0 }), ErroDeOpcoes);
    assert.throws(() => montarArgumentosDoDocker({ ...base, versionCode: Number.NaN }), ErroDeOpcoes);
    assert.throws(() => montarArgumentosDoDocker({ ...base, arquiteturas: "arm64" }), ErroDeOpcoes);
  });
});

/** O trecho do `app/build.gradle` que o `expo prebuild` gera (SDK 58) e que o plugin precisa reconhecer. */
const GRADLE_DO_TEMPLATE = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            signingConfig signingConfigs.debug
            minifyEnabled enableMinifyInReleaseBuilds
        }
    }
}`;

describe("plugin de assinatura do APK", () => {
  it("declara a chave de release lida do ambiente e a escolhe só no release", () => {
    const g = aplicarAssinatura(GRADLE_DO_TEMPLATE);
    assert.match(g, /signingConfigs \{\s+release \{ \/\/ synqos-assinatura/);
    assert.match(g, /storeFile file\(System\.getenv\("SYNQOS_KEYSTORE"\)\)/);
    assert.match(g, /release \{\s+\/\/ Caution[^\n]*\n\s+signingConfig System\.getenv\("SYNQOS_KEYSTORE"\) \? signingConfigs\.release : signingConfigs\.debug/);
    // o `debug` continua com a chave de depuração
    assert.match(g, /debug \{\s+signingConfig signingConfigs\.debug/);
  });

  it("não guarda senha nenhuma no arquivo e é idempotente", () => {
    const g = aplicarAssinatura(GRADLE_DO_TEMPLATE);
    assert.ok(!g.includes("synqos-demonstracao"));
    assert.equal(aplicarAssinatura(g), g);
  });

  it("falha alto se o template do Expo mudou", () => {
    assert.throws(() => aplicarAssinatura("android { buildTypes { release { } } }"), /release/);
    assert.throws(() => aplicarAssinatura("android { buildTypes { release { signingConfig signingConfigs.debug } } }"), /signingConfigs/);
  });
});
