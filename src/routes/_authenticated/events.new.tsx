import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/events/new")({
  component: NewEvent,
  head: () => ({ meta: [{ title: "Novo evento" }] }),
});

function NewEvent() {
  const { profile, roles } = useAuth();
  const navigate = useNavigate();
  const isStaff = roles.includes("manager") || roles.includes("admin");

  const [form, setForm] = useState({
    title: "",
    description: "",
    date: "",
    location: "",
    capacity: "",
    ticket_price: "0",
    type: "event" as "event" | "campaign" | "donation",
    status: "active" as "draft" | "active" | "closed",
  });
  const [saving, setSaving] = useState(false);

  if (!isStaff) {
    return <p className="text-sm text-muted-foreground">Apenas gestores podem criar eventos.</p>;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("events")
      .insert({
        tenant_id: profile.tenant_id,
        title: form.title,
        description: form.description || null,
        date: form.date ? new Date(form.date).toISOString() : null,
        location: form.location || null,
        capacity: form.capacity ? parseInt(form.capacity) : null,
        ticket_price: parseFloat(form.ticket_price) || 0,
        type: form.type,
        status: form.status,
      })
      .select()
      .single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Evento criado!");
    navigate({ to: "/events/$eventId", params: { eventId: data.id } });
  };

  return (
    <div className="max-w-2xl">
      <Link to="/events" className="text-sm text-muted-foreground hover:underline">← Eventos</Link>
      <h1 className="mt-4 font-display text-3xl">Novo evento</h1>
      <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border bg-card p-6">
        <div>
          <Label htmlFor="title">Título</Label>
          <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </div>
        <div>
          <Label htmlFor="desc">Descrição</Label>
          <Textarea id="desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="date">Data e hora</Label>
            <Input id="date" type="datetime-local" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="loc">Local</Label>
            <Input id="loc" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="cap">Capacidade</Label>
            <Input id="cap" type="number" min="0" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="price">Preço (R$)</Label>
            <Input id="price" type="number" step="0.01" min="0" value={form.ticket_price} onChange={(e) => setForm({ ...form, ticket_price: e.target.value })} />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as typeof form.type })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="event">Evento</SelectItem>
                <SelectItem value="campaign">Campanha</SelectItem>
                <SelectItem value="donation">Doação</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as typeof form.status })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="closed">Encerrado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Criar evento"}</Button>
      </form>
    </div>
  );
}
