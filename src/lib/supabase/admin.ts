import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con la llave de servicio. Salta los permisos por fila:
 * usar solo en acciones de servidor que ya verificaron que quien llama es administrador.
 */
export function crearClienteAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
