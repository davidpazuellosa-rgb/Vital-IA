import { Bell, Search, MapPin, Wallet, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { formatarData, formatarMoeda } from "@/lib/format";
import { AlertaDialog, AlertaToggle, AlertaRemover, CanaisNotificacao } from "@/components/alertas-client";
import type { Alerta } from "@/lib/alertas/actions";

function erroColunaTelegramToken(error: { code?: string; message: string } | null): boolean {
  return Boolean(
    error?.message.includes("telegram_bot_token") &&
      (error.code === "PGRST204" || error.message.includes("does not exist")),
  );
}

export default async function AlertasPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("alertas").select("*").order("created_at", { ascending: false });
  let { data: config, error: configError }: {
    data: { telegram_chat_id?: string | null; telegram_bot_token?: string | null } | null;
    error: { code?: string; message: string } | null;
  } = await supabase
    .from("notificacoes_config")
    .select("telegram_chat_id, telegram_bot_token")
    .maybeSingle();
  if (erroColunaTelegramToken(configError)) {
    const fallback = await supabase.from("notificacoes_config").select("telegram_chat_id").maybeSingle();
    config = fallback.data;
    configError = fallback.error;
  }
  const alertas = (data ?? []) as Alerta[];
  const chatId = (config?.telegram_chat_id as string) ?? "";
  const botTokenConfigurado = Boolean((config?.telegram_bot_token as string)?.trim());

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Alertas</h1>
        </div>
        <AlertaDialog />
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Buscas e filtros dos alertas</h2>
          <p className="text-sm text-muted-foreground">
            Cada alerta abaixo representa uma busca automática que será rastreada periodicamente.
          </p>
        </div>

      {alertas.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bell className="size-6" />
            </div>
            <p className="font-medium">Nenhum alerta ainda</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Crie um alerta com seus filtros (palavra-chave, UF, valor) para receber novas licitações automaticamente.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {alertas.map((a) => (
            <Card key={a.id} className="shadow-sm">
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold">{a.nome}</h2>
                    <Badge variant="outline" className={a.ativo ? "border-transparent bg-primary/12 text-primary" : "text-muted-foreground"}>
                      {a.ativo ? "Ativo" : "Pausado"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <AlertaToggle id={a.id} ativo={a.ativo} />
                    <AlertaDialog alerta={a} />
                    <AlertaRemover id={a.id} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  <Campo icon={Search} valor={a.keyword || "qualquer objeto"} />
                  <Campo icon={MapPin} valor={a.ufs.length ? a.ufs.join(", ") : "todas as UFs"} />
                  <Campo
                    icon={Wallet}
                    valor={
                      a.valor_min == null && a.valor_max == null
                        ? "qualquer valor"
                        : `${a.valor_min != null ? formatarMoeda(a.valor_min) : "R$ 0"} – ${a.valor_max != null ? formatarMoeda(a.valor_max) : "sem limite"}`
                    }
                  />
                  {a.apenas_aberto && <Badge variant="secondary" className="font-normal">Em aberto</Badge>}
                </div>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3.5" />
                    {a.ultima_execucao ? `Última verificação: ${formatarData(a.ultima_execucao)}` : "Executado"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Canais de notificação</h2>
          <p className="text-sm text-muted-foreground">
            Configure onde o Vital.IA deve avisar quando uma nova licitação bater com seus filtros.
          </p>
        </div>
        <CanaisNotificacao chatId={chatId} botTokenConfigurado={botTokenConfigurado} />
      </section>
    </div>
  );
}

function Campo({ icon: Icon, valor }: { icon: typeof Search; valor: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <Icon className="size-3.5 shrink-0" />
      <span className="text-foreground">{valor}</span>
    </span>
  );
}
