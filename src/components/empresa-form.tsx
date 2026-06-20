"use client";

import { useTransition, useState } from "react";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { salvarEmpresa, type EmpresaDados } from "@/lib/empresa/actions";

type Campo = { name: keyof EmpresaDados; label: string; type?: string; full?: boolean; placeholder?: string };

const SECOES: { titulo: string; campos: Campo[] }[] = [
  {
    titulo: "Identificação",
    campos: [
      { name: "razao_social", label: "Razão social", full: true },
      { name: "nome_fantasia", label: "Nome fantasia" },
      { name: "cnpj", label: "CNPJ" },
      { name: "porte", label: "Porte", placeholder: "ME, EPP, Demais" },
      { name: "natureza_juridica", label: "Natureza jurídica" },
      { name: "data_abertura", label: "Data de abertura", type: "date" },
      { name: "cnae_principal", label: "CNAE principal", full: true },
    ],
  },
  {
    titulo: "Inscrições",
    campos: [
      { name: "inscricao_estadual", label: "Inscrição estadual" },
      { name: "inscricao_municipal", label: "Inscrição municipal" },
    ],
  },
  {
    titulo: "Endereço",
    campos: [
      { name: "cep", label: "CEP" },
      { name: "logradouro", label: "Logradouro" },
      { name: "numero", label: "Número" },
      { name: "complemento", label: "Complemento" },
      { name: "bairro", label: "Bairro" },
      { name: "municipio", label: "Município" },
      { name: "uf", label: "UF" },
    ],
  },
  {
    titulo: "Contato",
    campos: [
      { name: "email", label: "E-mail", type: "email" },
      { name: "telefone", label: "Telefone" },
    ],
  },
  {
    titulo: "Dados bancários",
    campos: [{ name: "dados_bancarios", label: "Banco, agência e conta", full: true, placeholder: "Banco / Agência / Conta" }],
  },
];

export function EmpresaForm({ dados }: { dados: EmpresaDados }) {
  const [pendente, startTransition] = useTransition();
  const [salvo, setSalvo] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSalvo(false);
    startTransition(async () => {
      await salvarEmpresa(fd);
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2500);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {SECOES.map((secao) => (
        <Card key={secao.titulo} className="shadow-sm">
          <CardContent className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{secao.titulo}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {secao.campos.map((c) => (
                <div key={c.name} className={`flex flex-col gap-1.5 ${c.full ? "sm:col-span-2 lg:col-span-3" : ""}`}>
                  <Label htmlFor={c.name}>{c.label}</Label>
                  <Input
                    id={c.name}
                    name={c.name}
                    type={c.type ?? "text"}
                    defaultValue={dados[c.name] ?? ""}
                    placeholder={c.placeholder}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="sticky bottom-4 flex items-center justify-end gap-3">
        {salvo && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
            <Check className="size-4" /> Salvo
          </span>
        )}
        <Button type="submit" disabled={pendente} className="shadow-lg">
          {pendente && <Loader2 className="animate-spin" />}
          Salvar dados
        </Button>
      </div>
    </form>
  );
}
