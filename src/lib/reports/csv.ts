// CSV (délimiteur ';' + BOM UTF-8, format attendu par Excel en locale FR)
// plutôt qu'un .xlsx binaire : les bibliothèques npm capables de générer un
// vrai .xlsx (xlsx, exceljs) embarquent toutes deux des vulnérabilités
// "high" non corrigées sur le registre npm. Le CSV s'ouvre nativement dans
// Excel sans dépendance supplémentaire.

function csvEscape(value: string | number): string {
  const str = String(value);
  if (/[;"\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsvRow(fields: (string | number)[]): string {
  return fields.map(csvEscape).join(";");
}

export function buildCsvResponse(lines: string[], filename: string): Response {
  const csv = "﻿" + lines.join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
