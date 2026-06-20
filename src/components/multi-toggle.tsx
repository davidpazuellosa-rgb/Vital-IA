"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MultiToggleOption {
  value: string;
  label: string;
}

interface MultiToggleProps {
  options: MultiToggleOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function MultiToggle({ options, selected, onChange }: MultiToggleProps) {
  function toggle(value: string) {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const ativo = selected.includes(option.value);
        return (
          <Badge
            key={option.value}
            variant={ativo ? "default" : "outline"}
            className={cn("cursor-pointer select-none", !ativo && "text-muted-foreground")}
            onClick={() => toggle(option.value)}
          >
            {option.label}
          </Badge>
        );
      })}
    </div>
  );
}
