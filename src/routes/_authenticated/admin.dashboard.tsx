import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Building2, Users, Heart, TrendingUp, Calendar, Megaphone, DollarSign, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  component: AdminDashboard,
  head: () => ({ meta: [{ title: "ERP — Dashboard" }] }),
});

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function AdminDashboard() {
  const { data } = useQuery({
    queryKey: ["platform-kpis"],
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - 30);
      const sinceIso = since.toISOString();
      const [tenants, activeT, donations, monthly, txCount, events, members, subs] = await Promise.all([
        supabase.from("tenants").select("id", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("tenants").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("active", true),
        supabase.from("donations").select("amount").is("deleted_at", null),
        supabase.from("donations").select("amount").gte("created_at", sinceIso).is("deleted_at", null),
        supabase.from("payments").select("id", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("tenant_subscriptions").select("plan_id, subscription_plans(monthly_price)").eq("status", "active").is("deleted_at", null),
      ]);
      const total = (donations.data ?? []).reduce((s, d: { amount: number }) => s + Number(d.amount), 0);
      const month = (monthly.data ?? []).reduce((s, d: { amount: number }) => s + Number(d.amount), 0);
      const txN = txCount.count ?? 0;
      const mrr = (subs.data ?? []).reduce((s, x: { subscription_plans?: { monthly_price?: number } | null }) => s + Number(x.subscription_plans?.monthly_price ?? 0), 0);
      return {
        tenants: tenants.count ?? 0,
        activeT: activeT.count ?? 0,
        total, month, txN,
        ticket: txN ? total / txN : 0,
        events: events.count ?? 0,
        members: members.count ?? 0,
        mrr,
      };
    },
  });

  const kpis = [
    { label: "Igrejas",            value: data?.tenants ?? "—",                     icon: Building2 },
    { label: "Igrejas ativas",     value: data?.activeT ?? "—",                     icon: Building2 },
    { label: "Doadores únicos",    value: data?.members ?? "—",                     icon: Users },
    { label: "Eventos ativos",     value: data?.events ?? "—",                      icon: Calendar },
    { label: "Total arrecadado",   value: data ? fmtBRL(data.total) : "—",          icon: Heart },
    { label: "Últimos 30 dias",    value: data ? fmtBRL(data.month) : "—",          icon: TrendingUp },
    { label: "Transações",         value: data?.txN ?? "—",                         icon: Wallet },
    { label: "Ticket médio",       value: data ? fmtBRL(data.ticket) : "—",         icon: DollarSign },
    { label: "MRR",                value: data ? fmtBRL(data.mrr) : "—",            icon: Megaphone },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Visão Global da Plataforma</h1>
        <p className="text-sm text-muted-foreground">KPIs consolidados de todas as igrejas.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{k.label}</span>
              <k.icon className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-3 font-display text-2xl">{k.value}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
