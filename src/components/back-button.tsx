import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

/**
 * Botão "Voltar" para o dashboard do painel atual (igreja ou plataforma).
 * Usa o mesmo padrão visual do botão de voltar já existente em
 * manage.members.tsx (ghost + ArrowLeft + "Voltar").
 */
export function BackButton({ to = "/manage/dashboard" }: { to?: string }) {
  return (
    <Button variant="ghost" size="sm" className="gap-1.5" asChild>
      <Link to={to}>
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
    </Button>
  );
}
