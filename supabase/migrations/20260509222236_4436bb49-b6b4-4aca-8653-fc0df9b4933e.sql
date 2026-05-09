
-- 1. PLATFORM ROLES
CREATE TYPE public.platform_role AS ENUM ('super_admin','support','finance','operator');

CREATE TABLE public.platform_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role platform_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (user_id, role)
);
ALTER TABLE public.platform_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_roles WHERE user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.has_platform_role(_user_id uuid, _role platform_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY platform_roles_self_select ON public.platform_roles FOR SELECT USING (user_id = auth.uid() OR is_platform_admin(auth.uid()));
CREATE POLICY platform_roles_super_all  ON public.platform_roles FOR ALL USING (has_platform_role(auth.uid(),'super_admin')) WITH CHECK (has_platform_role(auth.uid(),'super_admin'));

-- 2. SOFT DELETE
ALTER TABLE public.tenants    ADD COLUMN deleted_at timestamptz, ADD COLUMN deleted_by uuid;
ALTER TABLE public.payments   ADD COLUMN deleted_at timestamptz, ADD COLUMN deleted_by uuid;
ALTER TABLE public.donations  ADD COLUMN deleted_at timestamptz, ADD COLUMN deleted_by uuid;

-- 3. SAAS BILLING
CREATE TYPE public.subscription_status AS ENUM ('trialing','active','past_due','canceled','suspended');
CREATE TYPE public.invoice_status      AS ENUM ('draft','pending','paid','overdue','void','refunded');

CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  monthly_price numeric(10,2) NOT NULL DEFAULT 0,
  transaction_fee_percent numeric(5,2) NOT NULL DEFAULT 0,
  max_members integer, max_events_per_month integer, max_campaigns integer,
  max_admins integer, max_storage_mb integer, max_sms_per_month integer, max_whatsapp_per_month integer,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tenant_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id),
  status subscription_status NOT NULL DEFAULT 'trialing',
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL DEFAULT now() + interval '30 days',
  trial_ends_at timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  gateway_subscription_id text,
  deleted_at timestamptz, deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tenant_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  subscription_id uuid REFERENCES public.tenant_subscriptions(id),
  amount numeric(10,2) NOT NULL,
  status invoice_status NOT NULL DEFAULT 'pending',
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  due_date timestamptz, paid_at timestamptz,
  gateway_invoice_id text,
  deleted_at timestamptz, deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_invoices      ENABLE ROW LEVEL SECURITY;

CREATE POLICY plans_select_all    ON public.subscription_plans FOR SELECT USING (active OR is_platform_admin(auth.uid()));
CREATE POLICY plans_super_all     ON public.subscription_plans FOR ALL USING (has_platform_role(auth.uid(),'super_admin')) WITH CHECK (has_platform_role(auth.uid(),'super_admin'));

CREATE POLICY subs_tenant_select  ON public.tenant_subscriptions FOR SELECT
  USING (deleted_at IS NULL AND (is_tenant_staff(auth.uid(), tenant_id) OR is_platform_admin(auth.uid())));
CREATE POLICY subs_platform_all   ON public.tenant_subscriptions FOR ALL
  USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY invoices_tenant_select ON public.tenant_invoices FOR SELECT
  USING (deleted_at IS NULL AND (is_tenant_staff(auth.uid(), tenant_id) OR is_platform_admin(auth.uid())));
CREATE POLICY invoices_platform_all  ON public.tenant_invoices FOR ALL
  USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));

-- 4. IMPERSONATION
CREATE TABLE public.impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  impersonator_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  reason text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  ip_address text, user_agent text
);
ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY imp_self_select ON public.impersonation_sessions FOR SELECT
  USING (impersonator_id = auth.uid() OR is_platform_admin(auth.uid()));
CREATE POLICY imp_self_insert ON public.impersonation_sessions FOR INSERT
  WITH CHECK (impersonator_id = auth.uid() AND is_platform_admin(auth.uid()));
CREATE POLICY imp_self_update ON public.impersonation_sessions FOR UPDATE
  USING (impersonator_id = auth.uid());

-- 5. PLATFORM SETTINGS
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  default_primary_color text DEFAULT '#1a3a5c',
  default_accent_color text DEFAULT '#C9993A',
  default_logo_url text,
  default_features jsonb NOT NULL DEFAULT '{}'::jsonb,
  signup_open boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY settings_select_all ON public.platform_settings FOR SELECT USING (true);
CREATE POLICY settings_super_all  ON public.platform_settings FOR ALL
  USING (has_platform_role(auth.uid(),'super_admin')) WITH CHECK (has_platform_role(auth.uid(),'super_admin'));

-- 6. BYPASS PARA PLATFORM ADMIN
DROP POLICY IF EXISTS tenants_admin_update ON public.tenants;
CREATE POLICY tenants_update          ON public.tenants FOR UPDATE USING (has_role(auth.uid(), id, 'admin') OR is_platform_admin(auth.uid()));
CREATE POLICY tenants_platform_insert ON public.tenants FOR INSERT WITH CHECK (has_platform_role(auth.uid(),'super_admin'));
CREATE POLICY tenants_platform_delete ON public.tenants FOR DELETE USING (has_platform_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS profiles_self_select ON public.profiles;
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
DROP POLICY IF EXISTS profiles_staff_delete ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (id = auth.uid() OR is_tenant_staff(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()));
CREATE POLICY profiles_update ON public.profiles FOR UPDATE USING (id = auth.uid() OR is_tenant_staff(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()));
CREATE POLICY profiles_delete ON public.profiles FOR DELETE USING (has_role(auth.uid(), tenant_id, 'admin') OR is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS user_roles_admin_all ON public.user_roles;
CREATE POLICY user_roles_admin_all ON public.user_roles FOR ALL USING (has_role(auth.uid(), tenant_id, 'admin') OR is_platform_admin(auth.uid())) WITH CHECK (has_role(auth.uid(), tenant_id, 'admin') OR is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS api_keys_admin_all ON public.api_keys;
CREATE POLICY api_keys_admin_all ON public.api_keys FOR ALL USING (has_role(auth.uid(), tenant_id, 'admin') OR is_platform_admin(auth.uid())) WITH CHECK (has_role(auth.uid(), tenant_id, 'admin') OR is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS audit_staff_select ON public.audit_logs;
CREATE POLICY audit_select        ON public.audit_logs FOR SELECT USING (is_tenant_staff(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()));
CREATE POLICY audit_staff_insert  ON public.audit_logs FOR INSERT WITH CHECK (is_tenant_staff(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS events_staff_all ON public.events;
CREATE POLICY events_staff_all ON public.events FOR ALL USING (is_tenant_staff(auth.uid(), tenant_id) OR is_platform_admin(auth.uid())) WITH CHECK (is_tenant_staff(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS groups_staff_all ON public.groups;
CREATE POLICY groups_staff_all ON public.groups FOR ALL USING (is_tenant_staff(auth.uid(), tenant_id) OR is_platform_admin(auth.uid())) WITH CHECK (is_tenant_staff(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS donations_select ON public.donations;
CREATE POLICY donations_select ON public.donations FOR SELECT USING (deleted_at IS NULL AND (profile_id = auth.uid() OR is_tenant_staff(auth.uid(), tenant_id) OR is_platform_admin(auth.uid())));

DROP POLICY IF EXISTS payments_select ON public.payments;
DROP POLICY IF EXISTS payments_staff_update ON public.payments;
CREATE POLICY payments_select        ON public.payments FOR SELECT USING (deleted_at IS NULL AND (profile_id = auth.uid() OR is_tenant_staff(auth.uid(), tenant_id) OR is_platform_admin(auth.uid())));
CREATE POLICY payments_staff_update  ON public.payments FOR UPDATE USING (is_tenant_staff(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS tickets_select ON public.tickets;
DROP POLICY IF EXISTS tickets_staff_update ON public.tickets;
CREATE POLICY tickets_select         ON public.tickets FOR SELECT USING (profile_id = auth.uid() OR is_tenant_staff(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()));
CREATE POLICY tickets_staff_update   ON public.tickets FOR UPDATE USING (is_tenant_staff(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()));

-- 7. AUDITORIA AUTOMÁTICA (pula registros sem tenant válido)
CREATE OR REPLACE FUNCTION public.log_critical_action()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _tenant uuid;
  _entity_id uuid;
BEGIN
  _tenant := COALESCE(
    (CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD)->>'tenant_id'
                                ELSE row_to_json(NEW)->>'tenant_id' END)::uuid,
    (CASE WHEN TG_TABLE_NAME = 'tenants' THEN
      (CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END) END)
  );

  -- Sem tenant => não auditável (tabelas globais como subscription_plans)
  IF _tenant IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  _entity_id := (CASE WHEN TG_OP='DELETE' THEN row_to_json(OLD)->>'id'
                                          ELSE row_to_json(NEW)->>'id' END)::uuid;

  INSERT INTO public.audit_logs (tenant_id, user_id, action, entity, entity_id, metadata)
  VALUES (
    _tenant, auth.uid(),
    TG_OP || ':' || TG_TABLE_NAME,
    TG_TABLE_NAME, _entity_id,
    jsonb_build_object(
      'op', TG_OP,
      'old', CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
      'new', CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_tenants               AFTER INSERT OR UPDATE OR DELETE ON public.tenants               FOR EACH ROW EXECUTE FUNCTION public.log_critical_action();
CREATE TRIGGER trg_audit_user_roles            AFTER INSERT OR UPDATE OR DELETE ON public.user_roles            FOR EACH ROW EXECUTE FUNCTION public.log_critical_action();
CREATE TRIGGER trg_audit_tenant_subscriptions  AFTER INSERT OR UPDATE OR DELETE ON public.tenant_subscriptions  FOR EACH ROW EXECUTE FUNCTION public.log_critical_action();
CREATE TRIGGER trg_audit_tenant_invoices       AFTER INSERT OR UPDATE OR DELETE ON public.tenant_invoices       FOR EACH ROW EXECUTE FUNCTION public.log_critical_action();
CREATE TRIGGER trg_audit_payments              AFTER UPDATE OR DELETE           ON public.payments              FOR EACH ROW EXECUTE FUNCTION public.log_critical_action();

-- 8. SEED
INSERT INTO public.subscription_plans (code,name,description,monthly_price,transaction_fee_percent,max_members,max_events_per_month,max_campaigns,max_admins,max_storage_mb,max_sms_per_month,max_whatsapp_per_month,features,sort_order) VALUES
  ('free',      'Free',      'Para começar',                       0,    2.99,  100,   3,    1,  1,  500,    0,     0,    '{"events":true,"sms":false,"whatsapp":false,"advanced_reports":false,"custom_domain":false}'::jsonb, 1),
  ('starter',   'Starter',   'Igrejas pequenas',                  79.90, 2.49,  500,  10,    5,  3, 2000,  100,   100,    '{"events":true,"sms":true, "whatsapp":false,"advanced_reports":false,"custom_domain":false}'::jsonb, 2),
  ('pro',       'Pro',       'Igrejas em crescimento',           199.90, 1.99, 2000,  50,   20,  8, 10000, 1000, 1000,    '{"events":true,"sms":true, "whatsapp":true, "advanced_reports":true, "custom_domain":true}'::jsonb,  3),
  ('enterprise','Enterprise','Grandes redes / multi-igreja',     499.90, 0.99, NULL, NULL, NULL,NULL,NULL,NULL,  NULL,    '{"events":true,"sms":true, "whatsapp":true, "advanced_reports":true, "custom_domain":true}'::jsonb,  4);

INSERT INTO public.platform_settings (default_primary_color,default_accent_color) VALUES ('#1a3a5c','#C9993A');

INSERT INTO public.platform_roles (user_id, role)
VALUES ('2ad409d1-507c-405e-82c3-84b30e8af1f0','super_admin')
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.tenant_subscriptions (tenant_id, plan_id, status, current_period_end)
SELECT t.id, p.id, 'active', now() + interval '30 days'
FROM public.tenants t
CROSS JOIN LATERAL (SELECT id FROM public.subscription_plans WHERE code='free' LIMIT 1) p
ON CONFLICT (tenant_id) DO NOTHING;

CREATE INDEX idx_platform_roles_user ON public.platform_roles(user_id);
CREATE INDEX idx_audit_logs_tenant_created ON public.audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_tenant_invoices_tenant ON public.tenant_invoices(tenant_id, created_at DESC);
CREATE INDEX idx_impersonation_active ON public.impersonation_sessions(impersonator_id) WHERE ended_at IS NULL;
