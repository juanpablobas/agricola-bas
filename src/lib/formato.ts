const nf = (dec: number) =>
  new Intl.NumberFormat("es-CL", { minimumFractionDigits: dec, maximumFractionDigits: dec });

/** 85,00 */
export const num = (v: number | string | null | undefined, dec = 0) =>
  v === null || v === undefined || v === "" ? "—" : nf(dec).format(Number(v));

/** 85,00 ha */
export const ha = (v: number | string | null | undefined) => (v === null || v === undefined ? "—" : `${num(v, 2)} ha`);

/** 12,5 % */
export const pct = (v: number) => `${num(v, 1)} %`;

/** $1.234.567 */
export const clp = (v: number | null | undefined) =>
  v === null || v === undefined
    ? "—"
    : new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(v);

/** 02-11-2026 (las fechas sin hora se leen como fecha local, sin corrimiento de zona) */
export const fecha = (v: string | null | undefined) => {
  if (!v) return "—";
  const [y, m, d] = v.slice(0, 10).split("-");
  return `${d}-${m}-${y}`;
};

/** 02-11-2026 14:35 en hora de Chile */
export const fechaHora = (v: string | null | undefined) => {
  if (!v) return "—";
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date(v))
    .replace(",", "");
};

export const bytes = (b: number | null | undefined) => {
  if (!b) return "—";
  if (b < 1024 * 1024) return `${num(b / 1024, 0)} KB`;
  return `${num(b / 1024 / 1024, 1)} MB`;
};

/** Lee un número escrito con coma o punto decimal ("4,53" → 4.53). Vacío → null. */
export const leerNumero = (v: FormDataEntryValue | null): number | null => {
  if (v === null) return null;
  const s = String(v).trim().replace(/\./g, (m, i, str) => (str.includes(",") ? "" : m)).replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

export const leerTexto = (v: FormDataEntryValue | null): string | null => {
  const s = v === null ? "" : String(v).trim();
  return s === "" ? null : s;
};
