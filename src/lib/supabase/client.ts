import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";
"use client";
import { createBrowserClient } from "@supabase/ssr";

/** Cliente de Supabase para el navegador (subida de archivos). */
export function crearClienteNavegador() {
  return createBrowserClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
  );
}
