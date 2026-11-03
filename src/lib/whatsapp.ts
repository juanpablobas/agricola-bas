/** Deja un teléfono chileno en formato internacional sin signos (569XXXXXXXX). Devuelve null si no parece un teléfono. */
export function telefonoChile(t: string | null | undefined): string | null {
  if (!t) return null;
  let d = t.replace(/\D/g, "");
  if (d.startsWith("0056")) d = d.slice(2);
  if (d.length === 9 && d.startsWith("9")) d = "56" + d;
  if (d.length === 8) d = "569" + d;
  return /^56\d{9}$/.test(d) ? d : null;
}

/** Enlace que abre WhatsApp con el mensaje escrito. Sin teléfono, WhatsApp deja elegir a quién enviarlo. */
export function enlaceWhatsapp(telefono: string | null | undefined, texto: string): string {
  const n = telefonoChile(telefono);
  return `https://wa.me/${n ?? ""}?text=${encodeURIComponent(texto)}`;
}
