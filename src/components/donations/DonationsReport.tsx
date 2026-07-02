import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { jsPDF } from "jspdf";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { brl, fmtDate, translateMethod } from "@/components/financeiro/format";
import {
  getDonationsReport,
  getTenantOptions,
  type DonationReportItem,
} from "@/lib/donations.functions";
import { Download, FileText, Inbox } from "lucide-react";

function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  return { periodStart: toIso(start), periodEnd: toIso(now) };
}

function maskDocument(doc: string | null) {
  if (!doc) return "—";
  const digits = doc.replace(/\D+/g, "");
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return doc;
}

function buildPdf(items: DonationReportItem[], periodStart: string, periodEnd: string, isPlatformAdmin: boolean, tenantLabel: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 32;
  let y = 40;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Relatório de Doações", marginX, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Instituição: ${tenantLabel}`, marginX, y);
  y += 13;
  doc.text(
    `Período: ${fmtDate(`${periodStart}T00:00:00`)} a ${fmtDate(`${periodEnd}T00:00:00`)}`,
    marginX,
    y,
  );
  y += 13;
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, marginX, y);
  y += 20;

  const columns = isPlatformAdmin
    ? [
        { key: "createdAt", label: "Data", width: 55 },
        { key: "tenantName", label: "Instituição", width: 90 },
        { key: "donorName", label: "Doador", width: 100 },
        { key: "donorDocument", label: "CPF/CNPJ", width: 75 },
        { key: "donorPhone", label: "Telefone", width: 70 },
        { key: "donorEmail", label: "E-mail", width: 110 },
        { key: "paymentMethod", label: "Pagamento", width: 65 },
        { key: "donationAmountCents", label: "Valor da Doação", width: 75 },
        { key: "adminFeeCents", label: "Taxa Adm.", width: 65 },
      ]
    : [
        { key: "createdAt", label: "Data", width: 60 },
        { key: "donorName", label: "Doador", width: 130 },
        { key: "donorDocument", label: "CPF/CNPJ", width: 90 },
        { key: "donorPhone", label: "Telefone", width: 85 },
        { key: "donorEmail", label: "E-mail", width: 150 },
        { key: "paymentMethod", label: "Pagamento", width: 80 },
        { key: "donationAmountCents", label: "Valor da Doação", width: 100 },
        { key: "adminFeeCents", label: "Taxa Adm.", width: 90 },
      ];

  const rowHeight = 16;
  const headerHeight = 18;

  function drawHeader() {
    doc.setFillColor(230, 224, 209); // cream/olive tone consistente com o design system
    doc.rect(marginX, y, pageWidth - marginX * 2, headerHeight, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    let x = marginX + 4;
    for (const col of columns) {
      doc.text(col.label, x, y + 12);
      x += col.width;
    }
    y += headerHeight;
  }

  drawHeader();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  let totalDonation = 0;
  let totalFee = 0;

  for (const item of items) {
    if (y > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      y = 40;
      drawHeader();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
    }

    let x = marginX + 4;
    const values: Record<string, string> = {
      createdAt: fmtDate(item.createdAt),
      tenantName: item.tenantName ?? "—",
      donorName: item.donorName ?? "—",
      donorDocument: maskDocument(item.donorDocument),
      donorPhone: item.donorPhone ?? "—",
      donorEmail: item.donorEmail ?? "—",
      paymentMethod: translateMethod(item.paymentMethod) + (item.cardBrand ? ` (${item.cardBrand})` : ""),
      donationAmountCents: brl(item.donationAmountCents),
      adminFeeCents: brl(item.adminFeeCents),
    };

    for (const col of columns) {
      const raw = values[col.key] ?? "—";
      const text = doc.splitTextToSize(raw, col.width - 6)[0] ?? raw;
      doc.text(String(text), x, y + 11);
      x += col.width;
    }
    y += rowHeight;

    totalDonation += item.donationAmountCents;
    totalFee += item.adminFeeCents;
  }

  y += 10;
  doc.setDrawColor(200);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`Total de doações: ${items.length}`, marginX, y);
  doc.text(`Valor total das doações: ${brl(totalDonation)}`, marginX + 180, y);
  doc.text(`Total de taxa de administração: ${brl(totalFee)}`, marginX + 400, y);

  const fileName = `relatorio-doacoes_${periodStart}_a_${periodEnd}.pdf`;
  doc.save(fileName);
}

export function DonationsReport() {
  const [period, setPeriod] = useState(currentMonthRange);
  const [tenantFilter, setTenantFilter] = useState<string>("all");

  const reportFn = useServerFn(getDonationsReport);
  const tenantsFn = useServerFn(getTenantOptions);

  const tenants = useQuery({
    queryKey: ["donation-tenant-options"],
    queryFn: () => tenantsFn(),
  });
  const isPlatformView = tenants.data?.isPlatformAdmin ?? false;

  const report = useQuery({
    queryKey: ["donations-report", period, tenantFilter],
    queryFn: () =>
      reportFn({
        data: {
          ...period,
          tenantId: tenantFilter !== "all" ? tenantFilter : undefined,
        },
      }),
  });

  const items = report.data?.items ?? [];
  const isPlatformAdmin = report.data?.isPlatformAdmin ?? false;
  const totalDonation = items.reduce((sum, i) => sum + i.donationAmountCents, 0);
  const totalFee = items.reduce((sum, i) => sum + i.adminFeeCents, 0);

  const tenantLabel = isPlatformAdmin
    ? tenantFilter === "all"
      ? "Todas as instituições"
      : (tenants.data?.items.find((t) => t.id === tenantFilter)?.name ?? "—")
    : "—"; // igreja resolve o próprio nome no PDF via tenant do usuário; deixado neutro aqui

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl">Relatórios</h1>
        <p className="text-sm text-muted-foreground">
          Relatório completo de doações com dados captados no pagamento e taxa de administração
          consolidada.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="periodStart">De</Label>
          <Input
            id="periodStart"
            type="date"
            value={period.periodStart}
            onChange={(e) => setPeriod((p) => ({ ...p, periodStart: e.target.value }))}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="periodEnd">Até</Label>
          <Input
            id="periodEnd"
            type="date"
            value={period.periodEnd}
            onChange={(e) => setPeriod((p) => ({ ...p, periodEnd: e.target.value }))}
            className="w-40"
          />
        </div>
        {isPlatformView && (
          <div className="space-y-1">
            <Label>Instituição</Label>
            <Select value={tenantFilter} onValueChange={setTenantFilter}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Todas as instituições" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as instituições</SelectItem>
                {tenants.data?.items.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <Button
          onClick={() => buildPdf(items, period.periodStart, period.periodEnd, isPlatformAdmin, tenantLabel)}
          disabled={items.length === 0}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Baixar PDF
        </Button>
      </div>

      {report.isLoading ? (
        <Card>
          <CardContent className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
            <Inbox className="h-10 w-10 opacity-40" />
            <p className="text-sm">Nenhuma doação encontrada no período.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>
              <strong className="text-foreground">{items.length}</strong> doações
            </span>
            <span>
              Valor total das doações: <strong className="text-foreground">{brl(totalDonation)}</strong>
            </span>
            <span>
              Taxa de administração total: <strong className="text-foreground">{brl(totalFee)}</strong>
            </span>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    {isPlatformAdmin && <TableHead>Instituição</TableHead>}
                    <TableHead>Doador</TableHead>
                    <TableHead>CPF/CNPJ</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead className="text-right">Valor da Doação</TableHead>
                    <TableHead className="text-right">Taxa Adm.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="text-muted-foreground">{fmtDate(d.createdAt)}</TableCell>
                      {isPlatformAdmin && (
                        <TableCell className="text-muted-foreground">{d.tenantName ?? "—"}</TableCell>
                      )}
                      <TableCell className="font-medium">{d.donorName ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{maskDocument(d.donorDocument)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex flex-col">
                          <span>{d.donorPhone ?? "—"}</span>
                          <span className="text-xs">{d.donorEmail ?? "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {translateMethod(d.paymentMethod)}
                        {d.cardBrand ? ` · ${d.cardBrand}` : ""}
                      </TableCell>
                      <TableCell className="text-right font-medium">{brl(d.donationAmountCents)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {brl(d.adminFeeCents)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <FileText className="h-3.5 w-3.5" />
        O PDF inclui todos os dados exibidos acima, com totais consolidados no rodapé.
      </p>
    </div>
  );
}
