// Fechas en formato aaaa-mm-dd, sin horas ni zonas horarias (para evitar corrimientos de día).
const aUTC = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const aIso = (dt: Date) => dt.toISOString().slice(0, 10);

export const hoyChile = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
export const sumaDias = (iso: string, n: number) => {
  const dt = aUTC(iso);
  dt.setUTCDate(dt.getUTCDate() + n);
  return aIso(dt);
};
/** Lunes de la semana de una fecha */
export const lunesDe = (iso: string) => {
  const dow = aUTC(iso).getUTCDay(); // 0 domingo
  return sumaDias(iso, -((dow + 6) % 7));
};
export const esFecha = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && aIso(aUTC(s)) === s;
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export const nombreDia = (iso: string) => DIAS[aUTC(iso).getUTCDay()];
export const corta = (iso: string) => iso.slice(8, 10) + "-" + iso.slice(5, 7);
