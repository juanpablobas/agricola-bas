import { SUPABASE_URL } from "./config";
import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con la llave de servicio. Salta los permisos por fila:
 * usar solo en acciones de servidor que ya verificaron que quien llama es administrador.
 */
export function crearClienteAdmin() {
  return createClient(SUPABASE_URL, (process.env.APP_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
