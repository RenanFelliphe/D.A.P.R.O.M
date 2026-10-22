"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { mensagemDoErro } from "@/components/app/execucao/useAcao";
import { Badge } from "@/components/ui/Badge";
import { Field, ligarAoErro } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { ErroDeEnvio, useFormulario } from "@/components/ui/useFormulario";
import { chamar } from "@/lib/cliente-api";
import { caminhoDaConfiguracao, nomeDaCidade, type CidadeEncontrada, type CidadePadraoDoSistema } from "@/lib/configuracoes";

const esquema = z.object({ busca: z.string().trim().min(2, "Digite ao menos 2 letras do nome da cidade.") });

/**
 * A cidade padrão da previsão do tempo: é a que vale para quem está sem a posição do aparelho (sem GPS, permissão negada ou
 * computador sem localização) no quadro de OS e na pergunta de clima da APR. O admin procura a cidade pelo nome, escolhe na lista
 * e salva; "Voltar ao padrão" volta para Vitória (ES).
 */
export function CidadePadrao({ cidade }: { cidade: CidadePadraoDoSistema }) {
  const router = useRouter();
  const [resultados, setResultados] = useState<CidadeEncontrada[] | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salva, setSalva] = useState<string | null>(null);
  const { form, ref, enviar, enviando, erroEnvio, limparErroEnvio } = useFormulario(esquema, { busca: "" });
  const erroDaBusca = form.formState.errors.busca?.message;

  async function escolher(c: CidadeEncontrada) {
    setSalvando(true);
    setErro(null);
    try {
      const nome = nomeDaCidade(c);
      await chamar("PUT", caminhoDaConfiguracao("cidade_padrao"), { valor: { nome, latitude: c.latitude, longitude: c.longitude } });
      setSalva(nome);
      setResultados(null);
      form.reset({ busca: "" });
      router.refresh();
    } catch (e) {
      setErro(mensagemDoErro(e));
    } finally {
      setSalvando(false);
    }
  }

  async function restaurar() {
    setSalvando(true);
    setErro(null);
    setSalva(null);
    try {
      await chamar("DELETE", caminhoDaConfiguracao("cidade_padrao"));
      router.refresh();
    } catch (e) {
      setErro(mensagemDoErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="panel cfg-bloco" aria-labelledby="cfg-cidade" data-treino="cfg-cidade-padrao">
      <header>
        <h2 id="cfg-cidade">Previsão do tempo · cidade padrão</h2>
        <p>
          A previsão do quadro de OS e da pergunta de clima da APR usa a posição do aparelho. Para quem está sem ela (sem GPS, permissão negada, computador sem localização),
          vale esta cidade.
        </p>
      </header>

      <div className="row g8 wrap" style={{ alignItems: "center" }}>
        <Icon name="pin" size={16} />
        <strong>{cidade.nome}</strong>
        <Badge tone={cidade.personalizado ? "brand" : "neu"}>{cidade.personalizado ? "Escolhida pelo administrador" : "Padrão do sistema"}</Badge>
        {cidade.personalizado && (
          <button className="btn btn-line btn-sm" type="button" onClick={() => void restaurar()} disabled={salvando}>
            Voltar ao padrão ({cidade.padrao.nome})
          </button>
        )}
      </div>

      {salva && (
        <Notice tone="ok" icon="check" role="status">
          Cidade padrão alterada para {salva}.
        </Notice>
      )}

      <form
        ref={ref}
        noValidate
        className="stack g8"
        onSubmit={enviar(async (v) => {
          setSalva(null);
          setErro(null);
          const r = await chamar<{ cidades: CidadeEncontrada[] }>("GET", `/clima/cidades?busca=${encodeURIComponent(v.busca)}`);
          setResultados(r.cidades);
        })}
      >
        <Field label="Procurar outra cidade" htmlFor="cfg-busca-cidade" erro={erroDaBusca}>
          <div className="row g8 wrap">
            <input
              className="input"
              style={{ flex: "1 1 220px", minWidth: 0 }}
              placeholder="Nome da cidade, ex.: Linhares"
              autoComplete="off"
              {...form.register("busca", {
                onChange: () => {
                  setResultados(null);
                  limparErroEnvio();
                },
              })}
              {...ligarAoErro("cfg-busca-cidade", erroDaBusca)}
            />
            <button className="btn btn-p" type="submit" aria-busy={enviando} disabled={enviando}>
              <Icon name="search" size={16} />
              {enviando ? "Procurando…" : "Procurar"}
            </button>
          </div>
        </Field>
        <ErroDeEnvio mensagem={erroEnvio ?? erro} />
      </form>

      {resultados && resultados.length === 0 && <span className="muted">Nenhuma cidade encontrada com esse nome. Confira a grafia.</span>}
      {resultados && resultados.length > 0 && (
        <ul className="cfg-cidades" aria-label="Cidades encontradas">
          {resultados.map((c) => (
            <li key={`${c.nome}-${c.latitude}-${c.longitude}`}>
              <button type="button" onClick={() => void escolher(c)} disabled={salvando}>
                <span>
                  <strong>{c.nome}</strong>
                  {c.regiao ? <span className="muted"> · {c.regiao}</span> : null}
                </span>
                <span className="small">Usar esta cidade</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
