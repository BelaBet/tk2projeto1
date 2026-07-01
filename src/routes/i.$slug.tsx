import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChurchThemeProvider } from "@/lib/theme";
import { ChurchPageView } from "@/components/church-page";
import type { Tenant } from "@/lib/tenant-context";

export const Route = createFileRoute("/i/$slug")({
  component: TenantSitePage,
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — Comunidade` },
      { name: "description", content: "Página oficial da comunidade." },
    ],
  }),
});

function TenantSitePage() {
  const { slug } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["tenant-public-by-slug", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants_public")
        .select("id,name,slug,logo_url,primary_color,secondary_color,custom_domain,tagline")
        .eq("slug", slug)
        .eq("active", true)
        .maybeSingle();
      if (error) throw error;
      return data as Tenant | null;
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Carregando…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <div>
          <h1 className="font-display text-3xl">Comunidade não encontrada</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Verifique o endereço ou entre em contato com o gestor.
          </p>
        </div>
      </div>
    );
  }

  // Re-injeta o tema baseado na logo deste tenant específico, sobrescrevendo o
  // tema global (TenantThemeBridge) só enquanto esta página estiver montada.
  return (
    <ChurchThemeProvider
      source={{
        tenantId: data.id,
        logoUrl: data.logo_url ?? null,
        fallbackPrimary: data.primary_color ?? "#1a3a5c",
        fallbackAccent: data.secondary_color ?? "#C9993A",
      }}
    >
      <ChurchPageView tenantOverride={data} />
    </ChurchThemeProvider>
  );
}
