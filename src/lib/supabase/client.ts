"use client";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";
import { createBrowserClient } from "@supabase/ssr";

/** Cliente de Supabase para el navegador (subida de archivos). */
export function crearClienteNavegador() {
  return createBrowserClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
  );
}
