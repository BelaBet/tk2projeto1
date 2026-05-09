import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Users, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { createStubPayment } from "@/lib/payments-stub";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/events/$eventId")({
  component: EventDetail,
});

function EventDetail() {
  const { eventId } = Route.useParams();
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [method, setMethod] = useState<"pix" | "credit_card" | "debit_card">("pix");
  const [donationAmount, setDonationAmount] = useState("50");
  const [processing, setProcessing] = useState(false);
  const [open, setOpen] = useState(false);

  const { data: event, refetch } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: myTicket } = useQuery({
    queryKey: ["my-ticket", eventId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("tickets").select("*").eq("event_id", eventId).eq("profile_id", user!.id).maybeSingle();
      return data;
    },
  });

  if (!event) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  const isDonation = event.type === "donation" || event.type === "campaign";
  const price = Number(event.ticket_price ?? 0);

  const handleConfirm = async () => {
    if (!profile || !user) return;
    setProcessing(true);
    try {
      if (isDonation) {
        const amount = parseFloat(donationAmount);
        if (!amount || amount <= 0) { toast.error("Informe um valor válido."); setProcessing(false); return; }
        const payment = await createStubPayment({
          tenantId: profile.tenant_id, profileId: user.id,
          amount, method, referenceType: "donation",
        });
        const { error } = await supabase.from("donations").insert({
          tenant_id: profile.tenant_id, profile_id: user.id,
          amount, campaign_id: event.id, payment_id: payment.id,
        });
        if (error) throw error;
        toast.success("Doação registrada. Obrigado!");
        setOpen(false);
        navigate({ to: "/dashboard" });
      } else {
        let paymentId: string | null = null;
        if (price > 0) {
          const payment = await createStubPayment({
            tenantId: profile.tenant_id, profileId: user.id,
            amount: price, method, referenceType: "ticket",
          });
          paymentId = payment.id;
        }
        const qr = `TKT-${event.id.slice(0, 8)}-${user.id.slice(0, 8)}-${Date.now()}`;
        const { error } = await supabase.from("tickets").insert({
          event_id: event.id, profile_id: user.id, tenant_id: profile.tenant_id,
          qr_code_data: qr, payment_id: paymentId,
        });
        if (error) throw error;
        toast.success("Ingresso garantido!");
        setOpen(false);
        await refetch();
        navigate({ to: "/tickets" });
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <Link to="/events" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="h-4 w-4" /> Eventos
      </Link>

      <div className="mt-4 rounded-3xl border bg-card p-8 shadow-[var(--shadow-card)]">
        <span className="rounded-full bg-secondary/40 px-2 py-0.5 text-xs">{event.type}</span>
        <h1 className="mt-3 font-display text-3xl md:text-4xl">{event.title}</h1>
        {event.description && <p className="mt-3 text-muted-foreground">{event.description}</p>}

        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          {event.date && <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> {new Date(event.date).toLocaleString("pt-BR")}</div>}
          {event.location && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> {event.location}</div>}
          {event.capacity && <div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> {event.capacity} vagas</div>}
        </dl>

        <div className="mt-8 flex items-center justify-between gap-4 border-t pt-6">
          <div>
            {!isDonation && (
              <div className="font-display text-2xl">
                {price > 0 ? `R$ ${price.toFixed(2)}` : "Gratuito"}
              </div>
            )}
            {isDonation && <div className="font-display text-2xl">Contribuir</div>}
          </div>
          {myTicket ? (
            <Button asChild variant="outline"><Link to="/tickets">Ver meu ingresso</Link></Button>
          ) : (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="lg">{isDonation ? "Doar" : (price > 0 ? "Comprar ingresso" : "Garantir vaga")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{isDonation ? "Fazer doação" : "Confirmar inscrição"}</DialogTitle>
                </DialogHeader>
                {isDonation && (
                  <div>
                    <Label htmlFor="amt">Valor (R$)</Label>
                    <Input id="amt" type="number" min="1" step="0.01" value={donationAmount} onChange={(e) => setDonationAmount(e.target.value)} />
                  </div>
                )}
                {(isDonation || price > 0) && (
                  <div>
                    <Label className="mb-2 block">Forma de pagamento</Label>
                    <RadioGroup value={method} onValueChange={(v) => setMethod(v as typeof method)} className="grid grid-cols-3 gap-2">
                      {([["pix","PIX"],["credit_card","Crédito"],["debit_card","Débito"]] as const).map(([v,l]) => (
                        <label key={v} className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                          <RadioGroupItem value={v} className="sr-only" />{l}
                        </label>
                      ))}
                    </RadioGroup>
                    <p className="mt-3 text-xs text-muted-foreground">⚠ Pagamento em modo simulado (stub).</p>
                  </div>
                )}
                <DialogFooter>
                  <Button onClick={handleConfirm} disabled={processing}>
                    {processing ? "Processando..." : "Confirmar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </div>
  );
}
