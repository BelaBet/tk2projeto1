import { TableCell, TableRow } from "@/components/ui/table";

export function EmptyRow({ colSpan, message = "Nenhum registro encontrado." }: { colSpan: number; message?: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-8 text-center text-sm text-muted-foreground">
        {message}
      </TableCell>
    </TableRow>
  );
}

export function LoadingRow({ colSpan }: { colSpan: number }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-8 text-center text-sm text-muted-foreground">
        Carregando…
      </TableCell>
    </TableRow>
  );
}
