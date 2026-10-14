"use client";

import { AdicionarFoto } from "@/components/ui/AdicionarFoto";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { MaterialConferido } from "@/lib/apr";
import { porCategoria, quantidadeDoItem, tituloDaCategoria, type MaterialDoServico } from "@/lib/catalogo";

interface ConferenciaDeMateriaisProps {
  /** A lista de materiais do serviço da OS (a atividade dela no catálogo). */
  materiais: MaterialDoServico[];
  /** O que o técnico já respondeu, por `material_id`. */
  conferencia: Record<string, MaterialConferido>;
  aoConferir: (materialId: string, levou: boolean) => void;
  aoFotoEnviada: (materialId: string, foto: { arquivoId: string; previa: string }) => void;
  aoRemoverFoto: (materialId: string) => void;
  aoLevarOsOpcionais: () => void;
  /** Falha ao enviar uma foto. */
  aoErro: (mensagem: string) => void;
}

/**
 * A conferência dos materiais do serviço, no fim do checklist: o técnico diz se levou cada item da lista do catálogo. O item
 * obrigatório pede a foto dele em mãos; sem a foto, ou sem o item, a APR fica bloqueada (a `api` decide ao validar, e o
 * supervisor é avisado). Não há controle de estoque: só a prova de que o técnico está com o que o serviço pede.
 */
export function ConferenciaDeMateriais({ materiais, conferencia, aoConferir, aoFotoEnviada, aoRemoverFoto, aoLevarOsOpcionais, aoErro }: ConferenciaDeMateriaisProps) {
  const temObrigatorio = materiais.some((m) => m.obrigatorio);
  const opcionaisSemResposta = materiais.filter((m) => !m.obrigatorio && !conferencia[m.material_id]).length;

  return (
    <section className="card stack g12" aria-label="Materiais do serviço" data-treino="ck-materiais">
      <div className="stack g4">
        <h2 style={{ fontSize: 17, fontWeight: 600 }}>Materiais do serviço</h2>
        <p className="muted">
          Confirme o que você levou para o campo.
          {temObrigatorio && " Nos itens obrigatórios, envie uma foto do item: sem a foto, ou sem o item, a APR fica bloqueada e o supervisor é avisado."}
        </p>
      </div>

      {opcionaisSemResposta > 1 && (
        <div>
          <Button variant="line" sm onClick={aoLevarOsOpcionais}>
            Levei os itens opcionais
          </Button>
        </div>
      )}

      {porCategoria(materiais).map((grupo) => (
        <div key={grupo.categoria} className="stack g4">
          <span className="small" style={{ fontWeight: 600, color: "var(--ink3)" }}>
            {tituloDaCategoria[grupo.categoria]}
          </span>
          <div>
            {grupo.itens.map((m) => {
              const c = conferencia[m.material_id];
              return (
                <div key={m.material_id} className="mat-linha" data-treino-material={m.material_id}>
                  <div className="mat-nome">
                    <span>
                      {m.descricao}
                      {m.codigo && <span className="small mono"> · {m.codigo}</span>}
                    </span>
                    <span className="small" style={{ color: "var(--ink4)" }}>
                      {quantidadeDoItem(m)}
                      {m.observacao ? ` · ${m.observacao}` : ""}
                    </span>
                    {m.obrigatorio && (
                      <span>
                        <Badge tone="brand" style={{ padding: "0 7px", fontSize: 11 }}>
                          Obrigatório · foto
                        </Badge>
                      </span>
                    )}
                  </div>
                  <div className="mat-resp" role="group" aria-label={`Você levou ${m.descricao}?`}>
                    <button type="button" aria-pressed={c?.levou === true} onClick={() => aoConferir(m.material_id, true)}>
                      Levei
                    </button>
                    <button type="button" className="nao" aria-pressed={c?.levou === false} onClick={() => aoConferir(m.material_id, false)}>
                      Não levei
                    </button>
                  </div>
                  {m.obrigatorio && c?.levou === true && (
                    <div className="mat-extra">
                      {c.foto ? (
                        <div className="row g8" style={{ alignItems: "center" }}>
                          <div className="photo sq" style={{ position: "relative", overflow: "hidden", padding: 0, width: 88, flex: "none" }}>
                            {c.foto.miniatura ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={c.foto.miniatura} alt={`Foto de ${m.descricao}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              <span style={{ padding: 8 }}>Foto enviada</span>
                            )}
                          </div>
                          <span className="stack g4">
                            <span className="small" style={{ color: "var(--enc)", fontWeight: 600 }}>
                              <Icon name="check" size={13} /> Foto do item enviada
                            </span>
                            <button type="button" className="btn btn-line btn-sm" onClick={() => aoRemoverFoto(m.material_id)}>
                              Trocar a foto
                            </button>
                          </span>
                        </div>
                      ) : (
                        <div className="photo-grid">
                          <AdicionarFoto onEnviada={(foto) => aoFotoEnviada(m.material_id, foto)} onErro={aoErro} rotulo="Foto do item" />
                        </div>
                      )}
                      {!c.foto && (
                        <span className="small" style={{ color: "var(--blq)" }}>
                          Envie a foto do item para continuar.
                        </span>
                      )}
                    </div>
                  )}
                  {m.obrigatorio && c?.levou === false && (
                    <span className="mat-extra small" style={{ color: "var(--blq)" }}>
                      Sem este item a APR será bloqueada.
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
