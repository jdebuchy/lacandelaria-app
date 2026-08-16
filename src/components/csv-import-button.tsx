"use client";

import { ChangeEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type ParsedRow = Record<string, string>;

const NAME_HEADERS = ["nombre", "apellido"];
const OPTIONAL_HEADERS = [
  "apellido",
  "instagram",
  "telefono",
  "direccion",
  "direccion_2",
  "piso_depto",
  "barrio_cerrado",
  "nombre_barrio",
  "localidad",
  "provincia",
  "codigo_postal",
  "barrio",
  "zona",
  "tipo_direccion",
  "notas_entrega",
  "origen",
  "google_place_id",
  "google_place_label"
];

function parseCSVLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .trim()
    .split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const row: ParsedRow = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });
    return row;
  });
}

export function CsvImportButton() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setParseError(null);
    setResult(null);
    setRows([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);

      if (parsed.length === 0) {
        setParseError("El archivo está vacío o no tiene el formato correcto.");
        return;
      }

      const firstRow = parsed[0];
      const hasNameColumns = NAME_HEADERS.some((h) => h in firstRow);
      if (!hasNameColumns) {
        setParseError("El archivo debe incluir nombre o apellido.");
        return;
      }

      setRows(parsed);
    };
    reader.readAsText(file, "UTF-8");
  }

  function handleOpen() {
    setOpen(true);
    setRows([]);
    setParseError(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose() {
    setOpen(false);
  }

  async function handleImport() {
    if (rows.length === 0) return;
    setPending(true);
    setResult(null);

    const response = await fetch("/api/panel/customers/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows })
    });

    const data = (await response.json()) as { success: boolean; message: string };
    setResult(data);
    setPending(false);

    if (data.success) {
      router.refresh();
    }
  }

  const previewRows = rows.slice(0, 5);
  const allHeaders = rows.length > 0
    ? [
      ...NAME_HEADERS.filter((h) => h in rows[0]),
      ...OPTIONAL_HEADERS.filter((h) => h in rows[0] && !NAME_HEADERS.includes(h))
    ]
    : [];

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="rounded-control border border-line px-4 py-2 text-body text-ink-soft transition hover:border-line-strong hover:text-ink"
      >
        Importar CSV
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-card border border-line bg-paper-muted p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-title font-semibold text-ink">Importar clientes desde CSV</h2>
              <button
                type="button"
                onClick={handleClose}
                className="text-ink-faint transition hover:text-ink-soft"
              >
                ✕
              </button>
            </div>

            <p className="mt-2 text-body text-ink-soft">
              El archivo debe incluir{" "}
              <span className="font-mono text-ink-soft">nombre</span>
              {" "}y/o{" "}
              <span className="font-mono text-ink-soft">apellido</span>.
              {" "}Las demás columnas son opcionales, incluyendo{" "}
              <span className="font-mono text-ink-soft">telefono</span>
              {" "}e{" "}
              <span className="font-mono text-ink-soft">instagram</span>.
              {" "}Opcionalmente puedes incluir{" "}
              <span className="font-mono text-ink-soft">
                {OPTIONAL_HEADERS.join(", ")}
              </span>.
            </p>
            <p className="mt-2 text-meta text-ink-faint">
              Se aceptan campos entre comillas para direcciones con comas.
            </p>

            <div className="mt-4">
              <label className="flex cursor-pointer items-center gap-3 rounded-control border border-dashed border-line bg-paper px-4 py-4 text-body text-ink-soft transition hover:border-line-strong hover:text-ink-soft">
                <span className="text-title">📂</span>
                <span>Seleccionar archivo .csv</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={handleFileChange}
                />
              </label>
            </div>

            {parseError ? (
              <p className="mt-3 text-body text-danger-fg">{parseError}</p>
            ) : null}

            {rows.length > 0 && !result ? (
              <div className="mt-4">
                <p className="mb-2 text-body text-ink-soft">
                  {rows.length} fila{rows.length !== 1 ? "s" : ""} detectada{rows.length !== 1 ? "s" : ""}.
                  {rows.length > 5 ? ` Mostrando las primeras 5.` : ""}
                </p>
                <div className="overflow-x-auto rounded-control border border-line">
                  <table className="min-w-full text-meta text-ink-soft">
                    <thead className="bg-paper text-ink-soft">
                      <tr>
                        {allHeaders.map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-medium uppercase tracking-wider">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, i) => (
                        <tr key={i} className="border-t border-line">
                          {allHeaders.map((h) => (
                            <td key={h} className="max-w-[140px] truncate px-3 py-2">
                              {row[h] || <span className="text-ink-faint">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {result ? (
              <p className={`mt-4 text-body ${result.success ? "text-accent" : "text-danger-fg"}`}>
                {result.message}
              </p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-control border border-line px-4 py-2 text-body text-ink-soft transition hover:border-line-strong hover:text-ink"
              >
                {result?.success ? "Cerrar" : "Cancelar"}
              </button>
              {!result?.success ? (
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={rows.length === 0 || pending}
                  className="rounded-control bg-accent px-4 py-2 text-body font-medium text-accent-fg transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pending ? "Importando..." : `Importar ${rows.length > 0 ? rows.length : ""} clientes`}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
