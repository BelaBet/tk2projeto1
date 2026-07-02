import { createFileRoute } from "@tanstack/react-router";
import { DonationsReport } from "@/components/donations/DonationsReport";

export const Route = createFileRoute("/_authenticated/manage/relatorios")({
  component: ManageRelatorios,
  head: () => ({ meta: [{ title: "Relatórios" }] }),
});

function ManageRelatorios() {
  return <DonationsReport showTenantFilter={false} />;
}
