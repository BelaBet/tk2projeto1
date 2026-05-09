import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Plus, ScanLine, Ticket } from "lucide-react";

export const Route = createFileRoute("/_authenticated/events")({
  component: EventsPage,
  head: () => ({ meta: [{ title: "Eventos" }] }),
});

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  date: string | null;
  location: string | null;
  ticket_price: number | null;
  type: string;
  status: string;
};

function EventsPage() {
  const { roles } = useAuth();
  const isStaff = roles.includes("manager") || roles.includes("admin");

  const { data, isLoading } = useQuery({
    queryKey: ["events", isStaff],
    queryFn: async () => {
      let q = supabase.from("events").select("*").order("date", { ascending: true });
      if (!isStaff) q = q.eq("status", "active");
      const { data, error } = await q;
      if (error) throw error;
      return data as EventRow[];
    },
  });

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl md:text-4xl">Eventos</h1>
          <p className="mt-1 text-muted-foreground">Cultos, encontros e campanhas da comunidade.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm"><Link to="/tickets"><Ticket className="h-4 w-4" /> Meus ingressos</Link></Button>
          {isStaff && (
            <>
              <Button asChild variant="outline" size="sm"><Link to="/scan"><ScanLine className="h-4 w-4" /> Validar</Link></Button>
              <Button asChild size="sm"><Link to="/events/new"><Plus className="h-4 w-4" /> Novo evento</Link></Button>
            </>
          )}
        </div>
      </div>

      <div className="mt-8">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (data?.length ?? 0) === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card p-10 text-center">
            <Calendar className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Nenhum evento por aqui ainda.</p>
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {data!.map((e) => (
              <li key={e.id}>
                <Link to="/events/$eventId" params={{ eventId: e.id }}
                      className="block rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)]">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-display text-xl">{e.title}</h3>
                    <span className="rounded-full bg-secondary/40 px-2 py-0.5 text-xs">{e.status}</span>
                  </div>
                  {e.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{e.description}</p>}
                  <div className="mt-4 space-y-1 text-xs text-muted-foreground">
                    {e.date && <div className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{new Date(e.date).toLocaleString("pt-BR")}</div>}
                    {e.location && <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{e.location}</div>}
                  </div>
                  {Number(e.ticket_price) > 0 ? (
                    <div className="mt-3 font-display text-lg text-primary">R$ {Number(e.ticket_price).toFixed(2)}</div>
                  ) : (
                    <div className="mt-3 text-sm text-muted-foreground">Entrada gratuita</div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
