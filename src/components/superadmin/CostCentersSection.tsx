import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, QrCode, Pencil, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { translateError } from "@/lib/translate-error";
import {
  listCostCenters,
  toggleCostCenterActive,
  regenerateCostCenterQr,
  type CostCenterRow,
} from "@/lib/cost-centers.functions";
import { CostCenterFormModal } from "./CostCenterFormModal";

export function CostCentersSection() {
  const qc = useQueryClient();
  const list = useServerFn(listCostCenters);
  const toggleFn = useServerFn(toggleCostCenterActive);
  const regenFn = useServerFn(regenerateCostCenterQr);

  const [tenantId, setTenantId] = useState<string>("");
  const [modal, setModal] = useState<{ open: boolean; row: CostCenterRow | null }>({ open: false, row: null });

  const { data: tenants } = useQuery({
    queryKey: ["super-admin", "tenants-min"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tenants")
        .select("id,name,slug")
        .order("name");
      return (data ?? []) as { id: string; name: string; slug: string }[];
    },
  });

  useEffect(() => {
    if (!tenantId && tenants?.length) setTenantId(tenants[0].id);
  }, [tenants, tenantId]);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["cost-centers", tenantId],
    enabled: !!tenantId,
    queryFn: () => list({ data: { tenantId } }),
  });

  const toggleMut = useMutation({
    mutationFn: (v: { id: string; isActive: boolean }) => toggleFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cost-centers", tenantId] }),
    onError: (e) => toast.error(translateError(e)),
  });

  const regenMut = useMutation({
    mutationFn: (id: string) => regenFn({ data: { id } }),
    onSuccess: () => {
      toast.success("QR Code regenerado");
      qc.invalidateQueries({ queryKey: ["cost-centers", tenantId] });
    },
    onError: (e) => toast.error(translateError(e)),
  });

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">Centros de Custo</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={tenantId} onValueChange={setTenantId}>
              <SelectTrigger className="h-9 w-[220px]"><SelectValue placeholder="Selecione a igreja" /></SelectTrigger>
              <SelectContent>
                {tenants?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={!tenantId}
              onClick={() => setModal({ open: true, row: null })}
            >
              <Plus className="mr-1 h-4 w-4" /> Novo centro
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Split (TicketConnect / Igreja)</TableHead>
                  <TableHead className="text-center">Parcelas</TableHead>
                  <TableHead className="text-center">Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">Carregando…</TableCell></TableRow>
                ) : !rows?.length ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">Nenhum centro de custo.</TableCell></TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-muted-foreground">/{r.slug}</div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{r.type}</Badge></TableCell>
                      <TableCell className="text-right text-xs">
                        {(r.split_platform_percent * 100).toFixed(2)}% / {(r.split_seller_percent * 100).toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {r.allows_installments ? `até ${r.max_installments}x` : "à vista"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={r.is_active}
                          disabled={toggleMut.isPending}
                          onCheckedChange={(v) => toggleMut.mutate({ id: r.id, isActive: v })}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {r.qr_code_url && (
                            <Button size="icon" variant="ghost" asChild aria-label="Baixar QR">
                              <a href={r.qr_code_url} download={`qr-${r.slug}.png`} target="_blank" rel="noreferrer">
                                <QrCode className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" onClick={() => regenMut.mutate(r.id)} aria-label="Regenerar QR" disabled={regenMut.isPending}>
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setModal({ open: true, row: r })} aria-label="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {modal.open && tenantId && (
        <CostCenterFormModal
          open={modal.open}
          onOpenChange={(o) => setModal({ open: o, row: o ? modal.row : null })}
          tenantId={tenantId}
          row={modal.row}
          onSaved={() => qc.invalidateQueries({ queryKey: ["cost-centers", tenantId] })}
        />
      )}
    </>
  );
}
