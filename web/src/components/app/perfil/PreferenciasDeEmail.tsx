"use client";

import { useState } from "react";
import { categoriasDoPerfil, DESCRICAO_DA_CATEGORIA, ehCategoriaObrigatoria, ROTULO_DA_CATEGORIA, type CategoriaDeEmail } from "../../../../../shared/notificacoes/avisos";
import { mensagemDoErro } from "@/components/app/execucao/useAcao";
import { Notice } from "@/components/ui/Notice";
import { chamar } from "@/lib/cliente-api";
import type { Perfil } from "@/lib/tipos";

/** O que `GET /me` traz dos e-mails: as categorias desligadas e se o servidor de e-mail está configurado. */
export interface EmailsDoPerfil {
  desligados: string[];
  servidor_configurado: boolean;
}

/**
 * "E-mails" do perfil: uma chave por categoria de e-mail (`shared/notificacoes/avisos.ts`). Desligar só tira o e-mail: o aviso continua
 * no sino. As obrigatórias (segurança do campo e a própria conta) aparecem marcadas e travadas. Cada mudança é gravada na hora
 * (`PUT /me/emails`); se falhar, a chave volta como estava.
 */
export function PreferenciasDeEmail({ perfil, inicial }: { perfil: Perfil; inicial: EmailsDoPerfil }) {
  const [desligados, setDesligados] = useState<string[]>(inicial.desligados);
  const [salvando, setSalvando] = useState<CategoriaDeEmail | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function alternar(categoria: CategoriaDeEmail, ligar: boolean) {
    const antes = desligados;
    const depois = ligar ? antes.filter((c) => c !== categoria) : [...antes, categoria];
    setDesligados(depois);
    setSalvando(categoria);
    setErro(null);
    try {
      const r = await chamar<{ desligados: string[] }>("PUT", "/me/emails", { desligados: depois });
      setDesligados(r.desligados);
    } catch (e) {
      setDesligados(antes);
      setErro(mensagemDoErro(e));
    } finally {
      setSalvando(null);
    }
  }

  return (
    <section className="stack g8" id="emails" aria-labelledby="titulo-emails">
      <h2 id="titulo-emails" style={{ fontSize: 16, fontWeight: 600 }}>
        E-mails
      </h2>
      <div className="card stack g12">
        <span className="small muted">Os avisos chegam sempre no sino. Aqui você escolhe quais também vão para o seu e-mail institucional.</span>
        {!inicial.servidor_configurado && (
          <Notice tone="al" icon="info" style={{ fontSize: 13.5 }}>
            O envio de e-mails ainda não foi configurado no servidor: por enquanto os avisos ficam só no sino. As suas escolhas já valem quando ele for ligado.
          </Notice>
        )}
        <ul className="stack g8" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {categoriasDoPerfil(perfil).map((c) => {
            const obrigatoria = ehCategoriaObrigatoria(c);
            const ligada = obrigatoria || !desligados.includes(c);
            return (
              <li key={c}>
                <label className="row g8" style={{ alignItems: "flex-start", cursor: obrigatoria ? "default" : "pointer" }}>
                  <input type="checkbox" checked={ligada} disabled={obrigatoria || salvando !== null} onChange={(e) => alternar(c, e.target.checked)} style={{ marginTop: 3 }} />
                  <span className="stack" style={{ gap: 2 }}>
                    <strong style={{ fontSize: 14 }}>
                      {ROTULO_DA_CATEGORIA[c]}
                      {obrigatoria && <span className="muted small"> · sempre enviado</span>}
                    </strong>
                    <span className="small muted">{DESCRICAO_DA_CATEGORIA[c]}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        {erro && (
          <Notice tone="blq" icon="alert" style={{ fontSize: 13.5 }}>
            {erro}
          </Notice>
        )}
      </div>
    </section>
  );
}
