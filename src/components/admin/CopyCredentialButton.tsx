import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  value?: string;
  label: string;
  className?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

export function CopyCredentialButton({ value, label, className, variant = "outline", size = "sm" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copiado al portapapeles`);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("No se pudo copiar al portapapeles");
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleCopy}
      disabled={!value}
      className={cn("gap-1.5", className)}
      aria-label={`Copiar ${label}`}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      {size !== "icon" && (copied ? "Copiado" : `Copiar ${label}`)}
    </Button>
  );
}
