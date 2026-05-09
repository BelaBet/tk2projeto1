import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useImpersonation } from "@/lib/impersonation";
import { useNavigate } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, Pause, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/tenants")({
  component: TenantsPage,
  head: () => ({ meta: [{ title: "ERP — Igrejas" }] }),
});

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function TenantsPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { start } = useImpersonation();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-tenants"],
    queryFn: async () => {
      const { data: tenants } = await supabase
        .from("tenants")
        .select("id,name,slug,custom_domain,active,created_at,deleted_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      const ids = (tenants ?? []).map((t) => t.id);
      if (!ids.length) return [];
      const [{ data: subs }, { data: dons }, { data: events }] = await Promise.all([
        supabase.from("tenant_subscriptions").select("tenant_id, status, subscription_plans(name, code, monthly_price)").in("tenant_id", ids),
        supabase.from("donations").select("tenant_id, amount, created_at").in("tenant_id", ids).is("deleted_at", null),
        supabase.from("events").select("tenant_id, id").in("tenant_id", ids).eq("status", "active"),
      ]);
      const since = new Date(); since.setDate(since.getDate() - 30);
      return (tenants ?? []).map((t) => {
        const sub = subs?.find((s: { tenant_id: string }) => s.tenant_id === t.id);
        const myDons = (dons ?? []).filter((d: { tenant_id: string }) => d.tenant_id === t.id);
        const total = myDons.reduce((s, d: { amount: number }) => s + Number(d.amount), 0);
        const monthly = myDons.filter((d: { created_at: string }) => new Date(d.created_at) >= since)
          .reduce((s, d: { amount: number }) => s + Number(d.amount), 0);
        const ev = (events ?? []).filter((e: { tenant_id: string }) => e.tenant_id === t.id).length;
        return { ...t, sub, total, monthly, eventsCount: ev };
      });
    },
  });

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from("tenants").update({ active: !current }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(current ? "Igreja suspensa" : "Igreja reativada"); qc.invalidateQueries({ queryKey: ["admin-tenants"] }); }
  };

  const softDelete = async (id: string) => {
    if (!confirm("Excluir (soft delete) esta igreja? Dados financeiros serão preservados.")) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("tenants").update({ deleted_at: new Date().toISOString(), deleted_by: u.user?.id, active: false }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Igreja excluída"); qc.invalidateQueries({ queryKey: ["admin-tenants"] }); }
  };

  const impersonate = async (id: string) => {
    const reason = prompt("Motivo da impersonação (auditado):") ?? undefined;
    try {
      await start(id, reason);
      toast.success("Impersonação iniciada");
      nav({ to: "/manage/dashboard" });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl">Gestão de Igrejas</h1>
        <p className="text-sm text-muted-foreground">Todos os tenants da plataforma.</p>
      </div>
      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Igreja</TableHead>
              <TableHead>Slug / Domínio</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead className="text-right">Mensal</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Eventos</TableHead>
              <TableHead>Criada em</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground">Carregando…</TableCell></TableRow>
            )}
            {data?.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {t.slug}{t.custom_domain ? ` · ${t.custom_domain}` : ""}
                </TableCell>
                <TableCell>
                  {t.active ? <Badge variant="secondary">Ativa</Badge> : <Badge variant="destructive">Suspensa</Badge>}
                </TableCell>
                <TableCell className="text-xs">
                  {t.sub?.subscription_plans?.name ?? "—"} <span className="text-muted-foreground">({t.sub?.status ?? "—"})</span>
                </TableCell>
                <TableCell className="text-right">{fmtBRL(t.monthly)}</TableCell>
                <TableCell className="text-right">{fmtBRL(t.total)}</TableCell>
                <TableCell className="text-right">{t.eventsCount}</TableCell>
                <TableCell className="text-xs">{new Date(t.created_at).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" title="Acessar como" onClick={() => impersonate(t.id)}><Eye className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" title={t.active ? "Suspender" : "Reativar"} onClick={() => toggleActive(t.id, t.active)}>
                      {t.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" title="Excluir" onClick={() => softDelete(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
