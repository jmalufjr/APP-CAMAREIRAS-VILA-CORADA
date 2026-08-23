"use client";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download } from "lucide-react";

export interface CategoryCount {
  name: string;
  count: number;
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function TopCategoriesTable({
  title,
  categories,
  csvFilename,
}: {
  title: string;
  categories: CategoryCount[];
  csvFilename?: string;
}) {
  const top10 = categories.slice(0, 10);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-heading text-lg">{title}</CardTitle>
        {csvFilename && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadCsv(csvFilename, [
                ["Categoria", "Ocorrências"],
                ...top10.map((c) => [c.name, c.count]),
              ])
            }
          >
            <Download size={14} /> Exportar CSV
          </Button>
        )}
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Ocorrências</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {top10.map((c, i) => (
              <TableRow key={c.name}>
                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                <TableCell>{c.name}</TableCell>
                <TableCell>{c.count}</TableCell>
              </TableRow>
            ))}
            {top10.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  Nenhuma ocorrência no período.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
