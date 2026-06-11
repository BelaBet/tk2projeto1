-- Hide sensitive payment columns from authenticated/anon clients (service_role keeps access)
REVOKE SELECT (
  gateway_request,
  gateway_response,
  error_message,
  platform_recipient_id,
  seller_recipient_id,
  ticketto_fee,
  pagarme_fee,
  tk2_op_fee,
  transacao_fee,
  transacao_fee,
  split_platform_amount,
  split_seller_amount
) ON public.payments FROM anon, authenticated;

-- Hide tenant legal document from authenticated/anon clients
REVOKE SELECT (document, document_type) ON public.tenants FROM anon, authenticated;