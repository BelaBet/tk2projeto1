
-- 1) cost_centers: anon only sees safe display columns
REVOKE SELECT ON public.cost_centers FROM anon;
GRANT SELECT (id, tenant_id, name, slug, description, is_active, display_order, type, allows_installments, max_installments, qr_code_url, created_at, updated_at) ON public.cost_centers TO anon;

-- 2) fee_rules: hide server-only fee math columns
REVOKE SELECT ON public.fee_rules FROM authenticated;
GRANT SELECT (id, tenant_id, payment_method, who_pays, is_active, anticipation_percent, transaction_fixed, created_at) ON public.fee_rules TO authenticated;

-- 3) payments: hide gateway/split server-only columns
REVOKE SELECT ON public.payments FROM authenticated;
GRANT SELECT (
  id, tenant_id, profile_id, amount, method, status,
  reference_type, reference_id, gateway_id, created_at, deleted_at, deleted_by,
  donation_amount, ticketto_fee, error_message, card_brand, cost_center_id
) ON public.payments TO authenticated;

-- 4) tenant_bank_account: hide bank details from tenant staff
REVOKE SELECT ON public.tenant_bank_account FROM authenticated;
GRANT SELECT (id, tenant_id, bank_code, account_type, created_at, updated_at) ON public.tenant_bank_account TO authenticated;

-- 5) tenant_financial_config: hide pagarme/anticipation/split fields
REVOKE SELECT ON public.tenant_financial_config FROM authenticated;
GRANT SELECT (id, tenant_id, receiver_type, use_pagarme, auto_transfer, transfer_frequency, created_at, updated_at) ON public.tenant_financial_config TO authenticated;

-- 6) tenants: hide recipient_* and legal document/name from authenticated
REVOKE SELECT ON public.tenants FROM authenticated;
GRANT SELECT (
  id, name, slug, logo_url, primary_color, secondary_color, custom_domain, active,
  created_at, tagline, cover_photo_url, accent_color, deleted_at, deleted_by,
  document_type, trade_name, institutional_email, main_phone, website, description,
  compliance_status, financial_active, updated_at
) ON public.tenants TO authenticated;
