import Link from "next/link";
import {
  Building2,
  MapPin,
  Gavel,
  Wallet,
  CalendarPlus,
  CalendarClock,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatarData, formatarMoeda } from "@/lib/format";
import { linkPncp } from "@/lib/licitacoes/pncp-url";
import { cn } from "@/lib/utils";

interface LicitacaoCardProps {
  plataformaNome: string;
  situacao: string;
  titulo: string;
  orgao: string;
  uf: string;
  municipio: string;
  modalidade: string;
  valorEstimado: number | null;
  dataAbertura: string | null;
  dataEncerramento: string | null;
  linkOrigem: string | null;
  /** Número de controle PNCP, usado para montar o link direto no portal do PNCP. */
  numeroControlePNCP?: string | null;
  /** Quando informado, o card inteiro vira um link para esta rota. */
  href?: string;
  action?: React.ReactNode;
}

export function LicitacaoCard({
  plataformaNome,
  situacao,
  titulo,
  orgao,
  uf,
  municipio,
  modalidade,
  valorEstimado,
  dataAbertura,
  dataEncerramento,
  linkOrigem,
  numeroControlePNCP,
  href,
  action,
}: LicitacaoCardProps) {
  const linkPortalPncp = linkPncp(numeroControlePNCP);
  const linkExterno = linkPortalPncp ?? linkOrigem;
  const rotuloLink = linkPortalPncp ? "Ver no PNCP" : "Ver no sistema de origem";
  return (
    <Card className={cn("relative transition-colors", href && "hover:border-primary/50")}>
      {href && (
        <Link
          href={href}
          aria-label="Abrir licitação"
          className="absolute inset-0 z-0 rounded-[inherit]"
        />
      )}
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="font-normal">{plataformaNome}</Badge>
            {situacao && (
              <Badge variant="outline" className="font-normal">{situacao}</Badge>
            )}
          </div>
          {action && <div className="relative z-10 shrink-0">{action}</div>}
        </div>

        <div className="space-y-1">
          <h3 className="font-medium leading-snug">{titulo}</h3>
          <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <Building2 className="mt-0.5 size-3.5 shrink-0" />
            <span>{orgao}</span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-3 sm:grid-cols-3 lg:grid-cols-5">
          <Campo icon={MapPin} rotulo="Local" valor={`${municipio || "—"} / ${uf || "—"}`} />
          <Campo icon={Gavel} rotulo="Modalidade" valor={modalidade || "—"} />
          <Campo icon={Wallet} rotulo="Valor estimado" valor={formatarMoeda(valorEstimado)} />
          <Campo icon={CalendarPlus} rotulo="Abertura" valor={formatarData(dataAbertura)} />
          <Campo
            icon={CalendarClock}
            rotulo="Encerramento"
            valor={formatarData(dataEncerramento)}
            destaque
          />
        </div>

        {linkExterno && (
          <a
            href={linkExterno}
            target="_blank"
            rel="noreferrer"
            className="relative z-10 inline-flex w-fit items-center gap-1 text-sm text-primary hover:underline"
          >
            {rotuloLink}
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </CardContent>
    </Card>
  );
}

function Campo({
  icon: Icon,
  rotulo,
  valor,
  destaque,
}: {
  icon: typeof MapPin;
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Icon className="size-3 shrink-0" />
        {rotulo}
      </span>
      <span
        className={cn("truncate text-sm font-medium", destaque && "text-primary")}
        title={valor}
      >
        {valor}
      </span>
    </div>
  );
}
