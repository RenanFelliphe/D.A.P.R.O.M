/**
 * Monta o comando `docker build` que gera o APK (Dockerfile do `mobile`). Fica separado de `gerar-apk.ts` para ser testado sem Docker.
 * O contexto do build é a raiz do repositório e o Dockerfile é `mobile/Dockerfile`.
 */

export interface OpcoesDoApk {
  /** Endereço da `api` gravado no APK (obrigatório). */
  api: string;
  /** Endereço da web, para o "Me leve lá" da Vitória (opcional). */
  web?: string;
  /** Libera `http://` no APK: só para teste com a `api` local. */
  permitirHttp?: boolean;
  /** Número inteiro que cresce a cada APK distribuído (o Android só aceita instalar por cima um número maior). */
  versionCode?: number;
  /** Lista separada por vírgulas, por exemplo `arm64-v8a` (build mais rápido). */
  arquiteturas?: string;
  /** Arquivo .keystore da empresa e o arquivo com a senha dele; os dois ou nenhum (sem eles, o build usa uma chave de demonstração). */
  chave?: string;
  senha?: string;
  /** Pasta onde o `synq-os.apk` é gravado. */
  saida: string;
}

export class ErroDeOpcoes extends Error {}

/** Confere as opções e devolve os argumentos do `docker build` (sem o `docker`). Os caminhos devem vir absolutos. */
export function montarArgumentosDoDocker(o: OpcoesDoApk): string[] {
  const api = o.api.trim().replace(/\/$/, "");
  if (!api) throw new ErroDeOpcoes("Informe o endereço da api: --api https://... (ou a variável EXPO_PUBLIC_API_URL).");
  if (!/^https?:\/\//.test(api)) throw new ErroDeOpcoes(`O endereço da api deve começar com https://: ${api}`);
  if (api.startsWith("http://") && !o.permitirHttp) {
    throw new ErroDeOpcoes(`O APK recusa http:// (${api}). Use https:// ou, só para teste com a api local, --http.`);
  }
  if (Boolean(o.chave) !== Boolean(o.senha)) {
    throw new ErroDeOpcoes("Informe a chave e a senha juntas (--chave e --senha), ou nenhuma das duas para usar a chave de demonstração.");
  }
  if (o.versionCode !== undefined && (!Number.isInteger(o.versionCode) || o.versionCode < 1)) {
    throw new ErroDeOpcoes(`A versão (versionCode) deve ser um inteiro a partir de 1: ${o.versionCode}`);
  }
  if (o.arquiteturas !== undefined && !/^(arm64-v8a|armeabi-v7a|x86_64|x86)(,(arm64-v8a|armeabi-v7a|x86_64|x86))*$/.test(o.arquiteturas)) {
    throw new ErroDeOpcoes(`Arquiteturas inválidas: ${o.arquiteturas} (use arm64-v8a, armeabi-v7a, x86_64 e x86, separadas por vírgula).`);
  }

  const args = ["build", "-f", "mobile/Dockerfile", "--target", "saida", "--output", `type=local,dest=${o.saida}`];
  args.push("--build-arg", `EXPO_PUBLIC_API_URL=${api}`);
  if (o.web) args.push("--build-arg", `EXPO_PUBLIC_WEB_URL=${o.web.trim().replace(/\/$/, "")}`);
  if (o.permitirHttp) args.push("--build-arg", "APP_PERMITIR_HTTP=true");
  if (o.versionCode !== undefined) args.push("--build-arg", `APP_VERSION_CODE=${o.versionCode}`);
  if (o.arquiteturas) args.push("--build-arg", `ARQUITETURAS=${o.arquiteturas}`);
  if (o.chave && o.senha) args.push("--secret", `id=chave,src=${o.chave}`, "--secret", `id=chave_senha,src=${o.senha}`);
  args.push(".");
  return args;
}
