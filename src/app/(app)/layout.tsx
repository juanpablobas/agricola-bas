import { obtenerSesion } from "@/lib/auth";
import { etiquetaRol } from "@/lib/etiquetas";
import { Navegacion, type ItemMenu } from "@/components/Navegacion";
import { BannerAvisos } from "@/components/BannerAvisos";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { clavePublica } from "@/lib/push";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const { perfil } = await obtenerSesion();
  let clavePush: string | null = null;
  try { clavePush = await clavePublica(crearClienteAdmin()); } catch { clavePush = null; }

  const items: ItemMenu[] = [
    { href: "/", texto: "Inicio", icono: "inicio" },
    { href: "/cuarteles", texto: "Cuarteles", icono: "cuarteles" },
    { href: "/riego", texto: "Riego", icono: "riego" },
    { href: "/campo", texto: "Campo", icono: "campo" },
  ];
  if (["administrador", "enc_administrativo", "propietario"].includes(perfil.rol))
    items.splice(2, 0, { href: "/finanzas", texto: "Finanzas", icono: "finanzas" });
  if (["administrador", "enc_administrativo", "enc_agricola", "propietario"].includes(perfil.rol))
    items.splice(items.findIndex((i) => i.href === "/campo") + 1, 0, { href: "/inventario", texto: "Inventario", icono: "inventario" });
  if (["administrador", "enc_administrativo", "enc_agricola", "propietario"].includes(perfil.rol))
    items.splice(items.findIndex((i) => i.href === "/inventario") + 1, 0, { href: "/programas", texto: "Programas", icono: "programas" });
  items.splice(items.findIndex((i) => i.href === "/campo") + 1, 0, { href: "/labores", texto: "Labores", icono: "labores" });
  if (["administrador", "enc_administrativo", "enc_agricola", "propietario"].includes(perfil.rol))
    items.splice(items.findIndex((i) => i.href === "/campo") + 1, 0, { href: "/cosecha", texto: "Cosecha", icono: "cosecha" });
  items.splice(items.findIndex((i) => i.href === "/campo") + 1, 0, { href: "/clima", texto: "Clima", icono: "clima" });
  if (perfil.rol === "administrador") items.push({ href: "/usuarios", texto: "Usuarios", icono: "usuarios" });
  if (perfil.rol === "administrador" || perfil.rol === "propietario")
    items.push({ href: "/actividad", texto: "Actividad", icono: "actividad" });

  return (
    <div className="min-h-dvh">
      <Navegacion items={items} barraMovil={items.slice(0, 4)} nombre={perfil.nombre} rol={etiquetaRol(perfil.rol)} />
      <main className="px-4 pb-24 pt-5 sm:px-6 lg:ml-64 lg:px-10 lg:pb-12 lg:pt-8">
        <div className="mx-auto max-w-6xl">
          <BannerAvisos clave={clavePush} />
          {children}
        </div>
      </main>
    </div>
  );
}
