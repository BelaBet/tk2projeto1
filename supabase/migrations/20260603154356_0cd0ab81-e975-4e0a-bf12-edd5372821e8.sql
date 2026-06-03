
DROP POLICY IF EXISTS tenants_select_all ON public.tenants;

CREATE POLICY tenants_member_or_admin_select ON public.tenants
FOR SELECT USING (
  id = public.current_tenant_id()
  OR public.is_tenant_staff(auth.uid(), id)
  OR public.is_platform_admin(auth.uid())
);

CREATE OR REPLACE VIEW public.tenants_public AS
SELECT id, name, slug, logo_url, primary_color, secondary_color, accent_color,
       custom_domain, tagline, cover_photo_url, active
FROM public.tenants
WHERE deleted_at IS NULL AND active = true;

GRANT SELECT ON public.tenants_public TO anon, authenticated;

DROP POLICY IF EXISTS messages_member_select_inapp ON public.messages;
CREATE POLICY messages_member_select_inapp ON public.messages
FOR SELECT USING (
  channel = 'in_app'::message_channel
  AND tenant_id = public.current_tenant_id()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.tenant_id = messages.tenant_id
      AND p.status = 'approved'
  )
  AND (
    target_type = 'broadcast'::message_target_type
    OR (target_type = 'individual'::message_target_type AND target_id = auth.uid())
    OR (target_type = 'group'::message_target_type AND EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = messages.target_id AND gm.profile_id = auth.uid()
    ))
  )
);

DROP POLICY IF EXISTS events_tenant_select ON public.events;
CREATE POLICY events_tenant_select ON public.events
FOR SELECT USING (
  tenant_id = public.current_tenant_id()
  AND status <> 'draft'::event_status
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.tenant_id = events.tenant_id
      AND p.status = 'approved'
  )
);
