import fs from "node:fs";
import path from "node:path";
import { createCanvas, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";
import { montarCena, ALTURA, LARGURA, type Cena } from "./layout";
import type { GraficoSpec } from "./tipos";

/* Desenha a cena do gráfico num PNG (imagem FIXA para PDF, Word, Excel e para baixar). Usa a fonte Geist embarcada
 * em public/fonts (Geist, licença OFL, com acentos e negrito): o servidor não tem fontes do sistema. */

const FAMILIA = "GraficoVita";
let fonteRegistrada = false;

function garantirFonte() {
  if (fonteRegistrada) return;
  try {
    GlobalFonts.register(fs.readFileSync(path.join(process.cwd(), "public", "fonts", "Geist-Latin.woff2")), FAMILIA);
  } catch {
    /* sem a fonte, o canvas usa a padrão (pode faltar texto): segue mesmo assim */
  }
  fonteRegistrada = true;
}

function desenhar(ctx: SKRSContext2D, cena: Cena) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cena.largura, cena.altura);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const it of cena.itens) {
    switch (it.t) {
      case "linha":
        ctx.strokeStyle = it.cor; ctx.lineWidth = it.larg; ctx.beginPath(); ctx.moveTo(it.x1, it.y1); ctx.lineTo(it.x2, it.y2); ctx.stroke();
        break;
      case "ret": {
        ctx.globalAlpha = it.opacidade ?? 1; ctx.fillStyle = it.cor;
        if (it.raio) { ctx.beginPath(); ctx.roundRect(it.x, it.y, it.w, it.h, it.raio); ctx.fill(); } else ctx.fillRect(it.x, it.y, it.w, it.h);
        ctx.globalAlpha = 1;
        break;
      }
      case "fatia": {
        ctx.fillStyle = it.cor; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (it.r0 > 0) { ctx.arc(it.cx, it.cy, it.r, it.a0, it.a1); ctx.arc(it.cx, it.cy, it.r0, it.a1, it.a0, true); }
        else { ctx.moveTo(it.cx, it.cy); ctx.arc(it.cx, it.cy, it.r, it.a0, it.a1); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      }
      case "caminho": {
        if (it.preencher) {
          ctx.globalAlpha = it.preencher.opacidade; ctx.fillStyle = it.cor; ctx.beginPath();
          ctx.moveTo(it.pontos[0][0], it.preencher.baseY);
          for (const [x, y] of it.pontos) ctx.lineTo(x, y);
          ctx.lineTo(it.pontos[it.pontos.length - 1][0], it.preencher.baseY); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = it.cor; ctx.lineWidth = it.larg; ctx.beginPath();
        it.pontos.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
        break;
      }
      case "ponto":
        ctx.fillStyle = it.cheio ? it.cor : "#ffffff"; ctx.strokeStyle = it.cheio ? "#ffffff" : it.cor; ctx.lineWidth = it.cheio ? 1.2 : 2; ctx.globalAlpha = it.cheio ? 0.85 : 1; ctx.beginPath(); ctx.arc(it.x, it.y, it.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1;
        break;
      case "texto": {
        ctx.fillStyle = it.cor; ctx.textAlign = it.ancora === "middle" ? "center" : it.ancora; ctx.font = `${it.negrito ? "bold " : ""}${it.tam}px ${FAMILIA}, sans-serif`;
        if (it.rotacao) { ctx.save(); ctx.translate(it.x, it.y); ctx.rotate((it.rotacao * Math.PI) / 180); ctx.fillText(it.texto, 0, 0); ctx.restore(); }
        else ctx.fillText(it.texto, it.x, it.y);
        break;
      }
      case "legenda": {
        ctx.globalAlpha = it.oculto ? 0.35 : 1; ctx.fillStyle = it.cor; ctx.beginPath(); ctx.roundRect(it.x, it.y + 3, 10, 10, 2); ctx.fill();
        ctx.fillStyle = "#374151"; ctx.textAlign = "start"; ctx.font = `10.5px ${FAMILIA}, sans-serif`; ctx.fillText(it.texto, it.x + 14, it.y + 12); ctx.globalAlpha = 1;
        break;
      }
      case "zona":
        break; // só existe no gráfico interativo
    }
  }
}

/** Gráfico em PNG. `largura` em pixels (a altura segue a proporção); 1400 é nítido para impressão. */
export function renderizarPng(spec: GraficoSpec, largura = 1400): { png: Uint8Array; largura: number; altura: number } {
  garantirFonte();
  const k = largura / LARGURA;
  const canvas = createCanvas(Math.round(LARGURA * k), Math.round(ALTURA * k));
  const ctx = canvas.getContext("2d");
  ctx.scale(k, k);
  desenhar(ctx, montarCena(spec));
  return { png: new Uint8Array(canvas.toBuffer("image/png")), largura: canvas.width, altura: canvas.height };
}
