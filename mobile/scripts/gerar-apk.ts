/**
 * Gera o APK do SYNQ OS pelo Dockerfile do `mobile` (`pnpm apk`). Só monta e roda o `docker build`; o trabalho está em `mobile/Dockerfile`.
 *
 *   pnpm apk --api https://api.exemplo.com.br
 *   pnpm apk --api https://api.exemplo.com.br --chave ../chaves/synqos.keystore --senha ../chaves/synqos.senha --versao 2
 *   pnpm apk --api http://192.168.0.10:3333 --http --arquiteturas arm64-v8a      (teste com a api local, só no aparelho)
 *   pnpm apk --api ... --simular                                                  (só mostra o comando)
 *
 * Opções: --api (ou EXPO_PUBLIC_API_URL), --web (EXPO_PUBLIC_WEB_URL), --http (APP_PERMITIR_HTTP=true), --versao (APP_VERSION_CODE),
 * --arquiteturas, --chave e --senha (os dois), --saida (padrão: mobile/apk). O APK sai em <saida>/synq-os.apk.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { parseArgs } from "node:util";
import { ErroDeOpcoes, montarArgumentosDoDocker } from "./apk-comando";

const RAIZ = path.resolve(__dirname, "..", "..");

function absoluto(caminho: string | undefined): string | undefined {
  return caminho ? path.resolve(process.cwd(), caminho) : undefined;
}

function principal(): number {
  const { values } = parseArgs({
    options: {
      api: { type: "string" },
      web: { type: "string" },
      http: { type: "boolean" },
      versao: { type: "string" },
      arquiteturas: { type: "string" },
      chave: { type: "string" },
      senha: { type: "string" },
      saida: { type: "string" },
      simular: { type: "boolean" },
    },
  });

  const versao = values.versao ?? process.env.APP_VERSION_CODE;
  try {
    const args = montarArgumentosDoDocker({
      api: values.api ?? process.env.EXPO_PUBLIC_API_URL ?? "",
      web: values.web ?? (process.env.EXPO_PUBLIC_WEB_URL || undefined),
      permitirHttp: values.http ?? process.env.APP_PERMITIR_HTTP === "true",
      versionCode: versao ? Number(versao) : undefined,
      arquiteturas: values.arquiteturas,
      chave: absoluto(values.chave),
      senha: absoluto(values.senha),
      saida: absoluto(values.saida) ?? path.join(RAIZ, "mobile", "apk"),
    });

    console.log(`docker ${args.join(" ")}\n(cwd: ${RAIZ})\n`);
    if (values.simular) return 0;

    const r = spawnSync("docker", args, { cwd: RAIZ, stdio: "inherit", env: { ...process.env, DOCKER_BUILDKIT: "1" } });
    if (r.error) {
      console.error(`Não foi possível rodar o docker: ${r.error.message}`);
      return 1;
    }
    return r.status ?? 1;
  } catch (e) {
    if (e instanceof ErroDeOpcoes) {
      console.error(e.message);
      return 2;
    }
    throw e;
  }
}

process.exitCode = principal();
