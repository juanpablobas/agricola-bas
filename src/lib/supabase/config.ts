// Las variables NEXT_PUBLIC_APP_* tienen prioridad: así la app usa SIEMPRE el proyecto de Supabase
// indicado a mano, aunque la integración de Vercel haya creado otras variables con otro proyecto.
export const SUPABASE_URL = (process.env.NEXT_PUBLIC_APP_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
export const SUPABASE_ANON_KEY = (process.env.NEXT_PUBLIC_APP_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
