"use client";

import { useMemo, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { montarCena, ALTURA, LARGURA, type Dica, type Item } from "@/lib/vita/graficos/layout";
import type { GraficoSpec } from "@/lib/vita/graficos/tipos";

/** Gráfico interativo no chat: passe o mouse para ver os valores e clique na legenda para esconder/mostrar. */

function caminhoFatia(f: Extract<Item, { t: "fatia" }>, desloca: [number, number]): string {
  const [dx, dy] = desloca;
  const p = (r: number, a: number) => `${f.cx + dx + Math.cos(a) * r} ${f.cy + dy + Math.sin(a) * r}`;
  const cheio = f.a1 - f.a0 >= Math.PI * 2 - 0.001;
  const a1 = cheio ? f.a1 - 0.001 : f.a1;
  const grande = a1 - f.a0 > Math.PI ? 1 : 0;
  if (f.r0 > 0) return `M ${p(f.r, f.a0)} A ${f.r} ${f.r} 0 ${grande} 1 ${p(f.r, a1)} L ${p(f.r0, a1)} A ${f.r0} ${f.r0} 0 ${grande} 0 ${p(f.r0, f.a0)} Z`;
  return `M ${f.cx + dx} ${f.cy + dy} L ${p(f.r, f.a0)} A ${f.r} ${f.r} 0 ${grande} 1 ${p(f.r, a1)} Z`;
}

export function GraficoInterativo({ spec }: { spec: GraficoSpec }) {
  const [ocultas, setOcultas] = useState<Set<number>>(new Set());
  const [ativa, setAtiva] = useState<{ dica: Dica; x: number; y: number; larg: number; guia?: { x: number; y1: number; y2: number }; zona?: number; fatia?: number } | null>(null);
  const [baixando, setBaixando] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const cena = useMemo(() => montarCena(spec, ocultas), [spec, ocultas]);

  const alternar = (idx: number) => setOcultas((s) => {
    const novo = new Set(s);
    if (novo.has(idx)) novo.delete(idx);
    else if (novo.size < (spec.tipo === "pizza" || spec.tipo === "rosca" ? spec.categorias.length : spec.series.length) - 1) novo.add(idx); // nunca esconde tudo
    return novo;
  });

  const aoMover = (e: React.MouseEvent, dica: Dica, extra: { guia?: { x: number; y1: number; y2: number }; zona?: number; fatia?: number } = {}) => {
    const r = caixa.current?.getBoundingClientRect();
    if (!r) return;
    setAtiva({ dica, x: e.clientX - r.left, y: e.clientY - r.top, larg: r.width, ...extra });
  };

  async function baixar() {
    setBaixando(true);
    try {
      const r = await fetch("/api/vita/grafico", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(spec) });
      if (!r.ok) throw new Error(await r.text());
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url; a.download = `${spec.titulo || "grafico"}.png`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2_000);
    } catch (e) {
      toast.error("Não foi possível baixar a imagem", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBaixando(false);
    }
  }

  return (
    <div className="rounded-lg border bg-white p-2 text-gray-800 shadow-sm">
      <div ref={caixa} className="relative" onMouseLeave={() => setAtiva(null)}>
        <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} className="block h-auto w-full select-none" role="img" aria-label={spec.titulo || "Gráfico"} fontFamily="inherit">
          {cena.itens.map((it, i) => {
            switch (it.t) {
              case "linha": return <line key={i} x1={it.x1} y1={it.y1} x2={it.x2} y2={it.y2} stroke={it.cor} strokeWidth={it.larg} strokeDasharray={it.tracejada ? "4 3" : undefined} />;
              case "ret": return <rect key={i} x={it.x} y={it.y} width={it.w} height={it.h} rx={it.raio} fill={it.cor} opacity={it.opacidade} />;
              case "fatia": {
                const m = (it.a0 + it.a1) / 2, ligada = ativa?.fatia === it.idx;
                return <path key={i} d={caminhoFatia(it, ligada ? [Math.cos(m) * 5, Math.sin(m) * 5] : [0, 0])} fill={it.cor} stroke="#fff" strokeWidth={1.5} className="cursor-pointer transition-transform" onMouseMove={(e) => aoMover(e, it.dica, { fatia: it.idx })} />;
              }
              case "caminho": {
                const d = it.pontos.map(([x, y], k) => `${k ? "L" : "M"} ${x} ${y}`).join(" ");
                const ult = it.pontos[it.pontos.length - 1], pri = it.pontos[0];
                return (
                  <g key={i}>
                    {it.preencher && <path d={`${d} L ${ult[0]} ${it.preencher.baseY} L ${pri[0]} ${it.preencher.baseY} Z`} fill={it.cor} opacity={it.preencher.opacidade} />}
                    <path d={d} fill="none" stroke={it.cor} strokeWidth={it.larg} strokeLinejoin="round" strokeLinecap="round" />
                  </g>
                );
              }
              case "ponto": return <circle key={i} cx={it.x} cy={it.y} r={it.r} fill={it.cheio ? it.cor : "#fff"} fillOpacity={it.cheio ? 0.85 : 1} stroke={it.cheio ? "#fff" : it.cor} strokeWidth={it.cheio ? 1.2 : 2} pointerEvents="none" />;
              case "texto": return (
                <text key={i} x={it.x} y={it.y} fontSize={it.tam} fill={it.cor} textAnchor={it.ancora} fontWeight={it.negrito ? 700 : 400} transform={it.rotacao ? `rotate(${it.rotacao} ${it.x} ${it.y})` : undefined}>{it.texto}</text>
              );
              case "legenda": return (
                <g key={i} className="cursor-pointer" opacity={it.oculto ? 0.35 : 1} onClick={() => alternar(it.idx)}>
                  <rect x={it.x - 2} y={it.y} width={it.w} height={it.h + 2} fill="transparent" />
                  <rect x={it.x} y={it.y + 3} width={10} height={10} rx={2} fill={it.cor} />
                  <text x={it.x + 14} y={it.y + 12} fontSize={10.5} fill="#374151" textDecoration={it.oculto ? "line-through" : undefined}>{it.texto}</text>
                </g>
              );
              case "zona": return (
                <rect key={i} x={it.x} y={it.y} width={it.w} height={it.h} fill={ativa?.zona === i ? "rgba(47,111,79,0.08)" : "transparent"} onMouseMove={(e) => aoMover(e, it.dica, { guia: it.guia, zona: i })} />
              );
            }
          })}
          {ativa?.guia && <line x1={ativa.guia.x} y1={ativa.guia.y1} x2={ativa.guia.x} y2={ativa.guia.y2} stroke="#9ca3af" strokeDasharray="3 3" pointerEvents="none" />}
        </svg>
        {ativa && (
          <div
            className="pointer-events-none absolute z-10 min-w-32 max-w-60 rounded-md border bg-white px-2.5 py-1.5 text-xs shadow-lg"
            style={{ left: ativa.x + 190 > ativa.larg ? Math.max(4, ativa.x - 196) : ativa.x + 12, top: Math.max(4, ativa.y - 8) }}
          >
            <p className="mb-1 font-semibold">{ativa.dica.titulo}</p>
            {ativa.dica.linhas.map((l, k) => (
              <p key={k} className="flex items-center gap-1.5">
                <span className="size-2 shrink-0 rounded-sm" style={{ background: l.cor }} />
                <span className="min-w-0 flex-1 truncate text-gray-500">{l.nome}</span>
                <span className="font-medium tabular-nums">{l.valor}</span>
              </p>
            ))}
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={baixar} disabled={baixando} className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-60" title="Baixar o gráfico como imagem (PNG)">
          {baixando ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />} Baixar imagem
        </button>
      </div>
    </div>
  );
}
