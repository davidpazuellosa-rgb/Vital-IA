# Notificação de feedback (toast) — especificação completa

> Documento de referência do sistema de notificações do Vital.IA.
> Todos os valores abaixo foram extraídos **diretamente da fonte da verdade**:
> `node_modules/sonner/dist/styles.css` (CSS) e `node_modules/sonner/dist/index.mjs`
> (defaults em JS). Nada foi estimado.

---

## 1. Visão geral

- **Biblioteca:** [`sonner`](https://sonner.emilkowal.ski/) versão **`^2.0.7`**.
- **Onde é montado:** um único componente `<Toaster>` global, no layout da área logada
  ([`src/app/(app)/layout.tsx`](../src/app/(app)/layout.tsx), linha 23):

  ```tsx
  import { Toaster } from "sonner";
  // ...
  <Toaster position="top-right" richColors closeButton />
  ```

- **Props ativas** (só estas 3 — o resto é default do sonner):
  | Prop | Valor | Efeito |
  |---|---|---|
  | `position` | `"top-right"` | Balões aparecem no **canto superior direito**. |
  | `richColors` | `true` | Liga as **cores fortes preenchidas** por tipo (verde/vermelho/etc.). |
  | `closeButton` | `true` | Mostra o **botão "X"** de fechar em cada balão. |
  | `theme` | *(não definido)* | Usa o default **`light`** → aplica a paleta do tema claro. |

- **Uso no projeto:** 108 chamadas `toast.*` — ≈36 `success`, ≈44 `error`, ≈27 `loading`, 1 `warning`.

---

## 2. Posição na tela

| Propriedade | Valor exato | Origem |
|---|---|---|
| Posicionamento | `position: fixed` | CSS `[data-sonner-toaster]` |
| Canto | Superior direito | prop `position="top-right"` |
| Distância da borda **direita** | **24px** (`--offset-right`) | default JS `VIEWPORT_OFFSET = '24px'` |
| Distância da borda **superior** | **24px** (`--offset-top`) | idem |
| Distância das bordas no **mobile** (≤600px) | **16px** (`--mobile-offset`) | default JS `MOBILE_VIEWPORT_OFFSET = '16px'` |
| `z-index` do container | **999999999** | CSS `[data-sonner-toaster]` |
| Largura do container | `var(--width)` = **356px** | default JS `WIDTH = 356` |

**No mobile (largura ≤ 600px):** o container passa a ocupar `width: 100%` e cada balão
fica com `width: calc(100% - 16px * 2)` — ou seja, quase toda a largura, com 16px de margem
de cada lado.

---

## 3. Tamanhos exatos do balão (toast)

Todos de `[data-sonner-toast][data-styled='true']` no CSS:

| Elemento | Propriedade | Valor exato |
|---|---|---|
| Balão | largura | **356px** (`--width`) |
| Balão | padding interno | **16px** (todos os lados) |
| Balão | border-radius | **8px** (`--border-radius`) |
| Balão | borda | **1px solid** (cor conforme o tipo) |
| Balão | sombra | `0px 4px 12px rgba(0, 0, 0, 0.1)` |
| Balão | `font-size` base | **13px** |
| Balão | layout | `display: flex; align-items: center; gap: 6px` |
| **Título** (`[data-title]`) | `font-weight` | **500** |
| **Título** | `line-height` | **1.5** |
| **Descrição** (`[data-description]`) | `font-weight` | **400** |
| **Descrição** | `line-height` | **1.4** |
| Bloco de texto (`[data-content]`) | `gap` entre título e descrição | **2px** |
| **Ícone** (`[data-icon]`) | tamanho | **16px × 16px** (`flex-shrink: 0`) |
| Ícone | margem | `margin-left: -3px; margin-right: 4px` |
| **Espaço entre balões empilhados** | `--gap` | **14px** |
| **Nº máximo de balões visíveis** | — | **3** (`VISIBLE_TOASTS_AMOUNT`) — os demais ficam “atrás”, empilhados |

### Botão de fechar (`[data-close-button]`, `closeButton` ligado)
| Propriedade | Valor exato |
|---|---|
| Tamanho | **20px × 20px** |
| Formato | `border-radius: 50%` (círculo) |
| Posição | canto superior **esquerdo** do balão, deslocado por `translate(-35%, -35%)` (fica “mordendo” a borda) |
| Borda | `1px solid` cinza (`--gray4` = `#EDEDED`) |
| Cor do X | `--gray12` = `#171717` |
| Hover | fundo `--gray2` (`#F8F8F8`), borda `--gray5` (`#E8E8E8`) |

### Botão de ação (`[data-button]`, quando usado)
| Propriedade | Valor exato |
|---|---|
| Altura | **24px** |
| Padding horizontal | **8px** |
| `border-radius` | **4px** |
| `font-size` | **12px** / `font-weight` **500** |

### Fonte
O sonner **não herda** a fonte do app; usa a própria stack:
```
ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
"Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji",
"Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"
```

---

## 4. Cores exatas (tema **light**, que é o ativo)

Com `richColors`, cada tipo de toast tem fundo + borda + texto próprios.
HSL é o valor literal do CSS; HEX é a conversão exata.

| Tipo | Papel | HSL (CSS) | HEX |
|---|---|---|---|
| **Sucesso** | fundo | `hsl(143, 85%, 96%)` | `#ECFDF3` |
| | borda | `hsl(145, 92%, 87%)` | `#BFFCD9` |
| | texto/ícone | `hsl(140, 100%, 27%)` | `#008A2E` |
| **Erro** | fundo | `hsl(359, 100%, 97%)` | `#FFF0F0` |
| | borda | `hsl(359, 100%, 94%)` | `#FFE0E1` |
| | texto/ícone | `hsl(360, 100%, 45%)` | `#E60000` |
| **Aviso** (`warning`) | fundo | `hsl(49, 100%, 97%)` | `#FFFCF0` |
| | borda | `hsl(49, 91%, 84%)` | `#FBEEB1` |
| | texto/ícone | `hsl(31, 92%, 45%)` | `#DC7609` |
| **Info** | fundo | `hsl(208, 100%, 97%)` | `#F0F8FF` |
| | borda | `hsl(221, 91%, 93%)` | `#DDE7FD` |
| | texto/ícone | `hsl(210, 92%, 45%)` | `#0973DC` |
| **Neutro / loading** | fundo | `#fff` | `#FFFFFF` |
| | borda | `hsl(0, 0%, 93%)` (`--gray4`) | `#EDEDED` |
| | texto | `hsl(0, 0%, 9%)` (`--gray12`) | `#171717` |

- Com `richColors`, o **botão de fechar** herda as mesmas cores do tipo (fundo/borda/texto).
- Sem `richColors`, a **descrição** seria `#3F3F3F`; com `richColors` ela usa `color: inherit`
  (a cor do tipo).
- **Spinner de loading:** barras na cor `--gray11` = `hsl(0, 0%, 43.5%)` = `#6F6F6F`.

<details>
<summary>Cores do tema <strong>dark</strong> (não usado hoje — só para referência)</summary>

| Tipo | fundo | borda | texto |
|---|---|---|---|
| Sucesso | `hsl(150,100%,6%)` | `hsl(147,100%,12%)` | `hsl(150,86%,65%)` |
| Erro | `hsl(358,76%,10%)` | `hsl(357,89%,16%)` | `hsl(358,100%,81%)` |
| Aviso | `hsl(64,100%,6%)` | `hsl(60,100%,9%)` | `hsl(46,87%,65%)` |
| Info | `hsl(215,100%,6%)` | `hsl(223,43%,17%)` | `hsl(216,87%,65%)` |
| Neutro | `#000` | `hsl(0,0%,20%)` | `--gray1` `#FCFCFC` |

</details>

---

## 5. Animação e tempos

### Entrada / saída / empilhamento
| Comportamento | Valor exato |
|---|---|
| Transição principal do balão | `transform 400ms, opacity 400ms, height 400ms, box-shadow 200ms` |
| Entrada (top) | vem de `translateY(-100%)` + `opacity: 0` → `translateY(0)` + `opacity: 1` (desliza de cima + fade) |
| Movimento do container ao reorganizar | `transform 400ms ease` |
| Sombra (transição no hover/focus) | `200ms` |
| Empilhamento (colapsado) | balões de trás ficam com `scale` reduzido (`--toasts-before * 0.05 + 1`) e “escondidos” (`opacity: 0` no conteúdo) |
| Expandir no **hover** | os balões se abrem e revelam o conteúdo (transição de `opacity 400ms`) |

### Duração até sumir sozinho
| Item | Valor exato |
|---|---|
| Tempo de vida padrão (`success`/`error`/`warning`/`info`) | **4000ms** (`TOAST_LIFETIME`) |
| `loading` | **não expira sozinho** — fica até virar success/error ou ser dispensado |
| Tempo entre marcar como removido e desmontar | **200ms** (`TIME_BEFORE_UNMOUNT`) |

### Swipe (arrastar para dispensar)
| Item | Valor exato |
|---|---|
| Limiar para dispensar | **45px** (`SWIPE_THRESHOLD`) |
| Animação de saída ao arrastar | `200ms ease-out` (`swipe-out-left/right/up/down`) |

### Acessibilidade
Com `@media (prefers-reduced-motion)`, **todas** as transições e animações (inclusive o spinner)
são desligadas (`transition: none !important; animation: none !important`).

---

## 6. Estado de carregamento (loading)

O spinner do `toast.loading()` é desenhado em CSS puro (`.sonner-spinner`), **não** é um SVG:

| Item | Valor exato |
|---|---|
| Tamanho do spinner | **16px × 16px** (`--size`) |
| Composição | **12 barrinhas** (`.sonner-loading-bar`), giradas de 30° em 30° |
| Formato de cada barra | `width: 24%`, `height: 8%`, `border-radius: 6px` |
| Cor das barras | `--gray11` = **#6F6F6F** |
| Animação | `sonner-spin 1.2s linear infinite` (cada barra com `animation-delay` escalonado de -0.1s, criando o efeito de “rastro” girando) |
| Efeito do giro | a barra vai de `opacity: 1` → `opacity: 0.15` ao longo do ciclo |
| Aparição do ícone (promise) | `sonner-fade-in 300ms ease` (fade + `scale(0.8)`→`scale(1)`) |
| Sumiço do loader | `sonner-fade-out 0.2s ease` (fade + shrink) |

---

## 7. Quando aparece e o que aparece (padrões de uso no código)

O feedback é disparado em **toda ação** que muda estado ou chama o servidor
(salvar, criar, editar, remover, enviar, baixar, mudar etapa/status, anexar…).

### 7.1 Sucesso simples
```tsx
toast.success("Rascunho criado", {
  description: "Revise e clique em Emitir para enviar à SEFAZ.",
});
```
- **Título:** curto, no passado/afirmativo.
- **Descrição:** opcional, com o próximo passo.

### 7.2 Erro
```tsx
toast.error("Não foi possível salvar", {
  description: err instanceof Error ? err.message : undefined,
});
```
- **Descrição:** a mensagem técnica real do erro, quando existir.

### 7.3 Carregamento → sucesso/erro **no mesmo balão** (padrão mais importante)
Guarda-se o `id` do `toast.loading` e, ao terminar, atualiza-se o **mesmo** balão
passando `{ id }`. O balão “carregando” (com spinner) **se transforma** em sucesso/erro
no lugar — sem piscar nem empilhar um novo:

```tsx
const t = toast.loading("Enviando à SEFAZ…");
try {
  const res = await emitirNotaFiscal(id);
  if (res.ok) toast.success("Nota enviada", { id: t });
  else toast.error("Não foi possível emitir", { id: t, description: res.mensagem });
} catch (e) {
  toast.error("Falha ao emitir", { id: t, description: e instanceof Error ? e.message : undefined });
}
```

Encapsulado num helper reutilizável (padrão real do projeto,
[`nota-fiscal-client.tsx`](../src/components/nota-fiscal-client.tsx)):

```tsx
function executar(acao: () => Promise<void>, carregando: string, sucesso: string) {
  const t = toast.loading(carregando);
  startTransition(async () => {
    try {
      await acao();
      toast.success(sucesso, { id: t });
      router.refresh();
    } catch (e) {
      toast.error("Falha", { id: t, description: e instanceof Error ? e.message : undefined });
    }
  });
}
```

### 7.4 Regras de conteúdo
- **Idioma:** português (pt-BR).
- **Título:** curto e afirmativo (“Rascunho criado”, “Nota removida”, “Movida para ‘X’”).
- **Descrição:** contexto/próximo passo no sucesso; mensagem de erro real no erro.

---

## 8. Reproduzir em outro projeto (resumo executável)

```bash
npm i sonner
```

```tsx
// Layout raiz — montar UMA vez:
import { Toaster } from "sonner";
<Toaster position="top-right" richColors closeButton />
```

Depois, disparar com `toast.success | toast.error | toast.warning | toast.loading`,
usando o padrão `loading → { id }` para ações assíncronas. Todos os valores visuais
(cores, 356px de largura, 16px de padding, 8px de raio, 24px de offset, 4000ms de
duração, gap de 14px, máximo de 3 visíveis) vêm dos **defaults do sonner** documentados
acima — não é preciso configurar nada além das 3 props.
