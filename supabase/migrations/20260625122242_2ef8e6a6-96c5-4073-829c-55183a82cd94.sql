
-- Fix function search_path
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_roles pr
    WHERE pr.user_id = auth.uid() AND pr.role = 'super_admin'
  );
$$;

-- Revoke sensitive columns from client roles
REVOKE SELECT (split_platform_percent, split_seller_percent) ON public.cost_centers FROM anon, authenticated;

REVOKE SELECT (acquirer_fee_percent, tk2_op_fixed, tk2_op_percent, adm_fee_percent) ON public.fee_rules FROM anon, authenticated;

REVOKE SELECT (gateway_request, gateway_response, platform_recipient_id, seller_recipient_id, split_platform_amount, split_seller_amount, tk2_op_fee, pagarme_fee) ON public.payments FROM anon, authenticated;

REVOKE SELECT (branch, branch_digit, account, account_digit, holder_name, holder_document) ON public.tenant_bank_account FROM anon, authenticated;

REVOKE SELECT (pagarme_recipient_id, pagarme_recipient_status, split_platform_percent, auto_anticipation, anticipation_model, anticipation_days) ON public.tenant_financial_config FROM anon, authenticated;

REVOKE SELECT (recipient_id, recipient_status, recipient_error, document, legal_name) ON public.tenants FROM anon, authenticated;

REVOKE SELECT (donor_document) ON public.donations FROM anon, authenticated;

-- Tighten event-banners storage policies to tenant-scoped folders
DROP POLICY IF EXISTS event_banners_authenticated_upload ON storage.objects;
DROP POLICY IF EXISTS event_banners_authenticated_update ON storage.objects;
DROP POLICY IF EXISTS event_banners_authenticated_delete ON storage.objects;

CREATE POLICY event_banners_tenant_upload ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'event-banners'
  AND public.is_tenant_staff(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY event_banners_tenant_update ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'event-banners'
  AND public.is_tenant_staff(auth.uid(), ((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'event-banners'
  AND public.is_tenant_staff(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY event_banners_tenant_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'event-banners'
  AND public.is_tenant_staff(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
