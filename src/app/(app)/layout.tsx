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

  const r = perfil.rol;
  const tiene = (...roles: string[]) => roles.includes(r);
  const AGRO = ["administrador", "enc_administrativo", "enc_agricola", "propietario"];
  // Menú ordenado por uso: lo del día a día arriba, la administración abajo
  const items: ItemMenu[] = [
    { href: "/", texto: "Inicio", icono: "inicio", grupo: "Día a día" },
    { href: "/labores", texto: "Labores", icono: "labores", grupo: "Día a día" },
    ...(tiene(...AGRO) ? [{ href: "/programas", texto: "Programas", icono: "programas", grupo: "Día a día" }] : []),
    { href: "/riego", texto: "Riego", icono: "riego", grupo: "Día a día" },
    { href: "/clima", texto: "Clima", icono: "clima", grupo: "Día a día" },
    ...(tiene(...AGRO) ? [{ href: "/cosecha", texto: "Cosecha", icono: "cosecha", grupo: "Día a día" }] : []),
    ...(tiene(...AGRO) ? [{ href: "/inventario", texto: "Inventario", icono: "inventario", grupo: "Recursos" }] : []),
    { href: "/cuarteles", texto: "Cuarteles", icono: "cuarteles", grupo: "Recursos" },
    ...(tiene(...AGRO) ? [{ href: "/maquinaria", texto: "Maquinaria", icono: "maquinaria", grupo: "Recursos" }] : []),
    ...(tiene("administrador", "enc_administrativo", "propietario") ? [{ href: "/finanzas", texto: "Finanzas", icono: "finanzas", grupo: "Administración" }] : []),
    ...(tiene("administrador") ? [{ href: "/usuarios", texto: "Usuarios", icono: "usuarios", grupo: "Administración" }] : []),
    ...(tiene("administrador", "propietario") ? [{ href: "/actividad", texto: "Actividad", icono: "actividad", grupo: "Administración" }] : []),
    { href: "/campo", texto: "Configuración", icono: "campo", grupo: "Administración" },
  ];
  // Barra inferior del celular: los 4 accesos más usados según el rol (el resto queda en "Menú")
  const preferidos =
    r === "propietario" ? ["/", "/finanzas", "/programas", "/clima"]
    : r === "enc_administrativo" ? ["/", "/finanzas", "/inventario", "/labores"]
    : ["/", "/labores", "/programas", "/clima"];
  const barraMovil = [
    ...preferidos.map((h) => items.find((i) => i.href === h)).filter((i): i is ItemMenu => !!i),
    ...items.filter((i) => !preferidos.includes(i.href)),
  ].slice(0, 4);

  return (
    <div className="min-h-dvh">
      <Navegacion items={items} barraMovil={barraMovil} nombre={perfil.nombre} rol={etiquetaRol(perfil.rol)} />
      <main className="px-4 pb-24 pt-5 sm:px-6 lg:ml-64 lg:px-10 lg:pb-12 lg:pt-8">
        <div className="mx-auto max-w-6xl">
          <BannerAvisos clave={clavePush} />
          {children}
        </div>
      </main>
    </div>
  );
}
