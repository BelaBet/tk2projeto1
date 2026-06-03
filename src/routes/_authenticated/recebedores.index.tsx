import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/recebedores/")({
  component: RecebedoresList,
});

function RecebedoresList() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl">Recebedores</h1>
          <p className="text-sm text-muted-foreground">Gerencie os recebedores cadastrados no gateway de pagamentos.</p>
        </div>
        <Button asChild>
          <Link to="/recebedores/onboarding">
            <Plus className="h-4 w-4" /> Novo recebedor
          </Link>
        </Button>
      </div>

      <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Users className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="font-medium">Nenhum recebedor cadastrado</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Cadastre o primeiro recebedor para habilitar o split de pagamentos via Pagar.me.
        </p>
        <Button asChild className="mt-2">
          <Link to="/recebedores/onboarding">Iniciar cadastro</Link>
        </Button>
      </Card>
    </div>
  );
}
