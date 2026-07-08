import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const InputSchema = z.object({
  base64: z.string().min(1).max(8_000_000), // ~6MB
  contentType: z.string().regex(/^image\/(png|jpe?g|webp)$/, "Tipo de imagem inválido"),
  filename: z.string().min(1).max(120),
});

/** Upload do banner de um evento para o bucket público event-banners. */
export const uploadEventBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const userId = context.userId;

    const { data: prof, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id")
      .eq("id", userId)
      .maybeSingle();
    if (pErr || !prof?.tenant_id) {
      throw new Error("Perfil ou igreja não encontrados para este usuário.");
    }
    const tenantId = prof.tenant_id as string;

    const ext = (data.filename.split(".").pop() || "png").toLowerCase().replace("jpeg", "jpg");
    const path = `${tenantId}/banner-${Date.now()}.${ext}`;
    const buffer = Buffer.from(data.base64, "base64");
    const { error: uErr } = await supabaseAdmin.storage
      .from("event-banners")
      .upload(path, buffer, { contentType: data.contentType, upsert: true });
    if (uErr) throw new Error(`Falha ao enviar o banner: ${uErr.message}`);

    const { data: pub } = supabaseAdmin.storage.from("event-banners").getPublicUrl(path);
    return { url: pub.publicUrl };
  });

/** Lista todos os eventos de todas as igrejas (apenas plataforma). */
export const getAllEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await supabaseAdmin
      .from("platform_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!roles?.length) {
      throw new Error("Acesso restrito a administradores da plataforma.");
    }

    const { data, error } = await supabaseAdmin
      .from("events")
      .select(
        "id,title,date,location,description,banner_url,external_url,status,created_at,tenant_id,tenants(name,slug)"
      )
      .order("date", { ascending: false, nullsFirst: false });
    if (error) throw error;
    return data ?? [];
  });
