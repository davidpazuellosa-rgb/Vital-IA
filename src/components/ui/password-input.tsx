"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

/** Campo de senha com o olho para mostrar/ocultar. Use em TODO campo de senha ou segredo. */
function PasswordInput({
  className,
  leftIcon,
  ...props
}: Omit<React.ComponentProps<"input">, "type"> & { leftIcon?: React.ReactNode }) {
  const [visivel, setVisivel] = React.useState(false)
  return (
    <div className="relative">
      {leftIcon && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground [&>svg]:size-4">
          {leftIcon}
        </span>
      )}
      <Input
        {...props}
        type={visivel ? "text" : "password"}
        className={cn(leftIcon ? "pl-9" : "", "pr-9", className)}
      />
      <button
        type="button"
        onClick={() => setVisivel((v) => !v)}
        aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={visivel}
        title={visivel ? "Ocultar senha" : "Mostrar senha"}
        className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {visivel ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

export { PasswordInput }
