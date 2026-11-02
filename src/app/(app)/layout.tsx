import { obtenerSesion } from "@/lib/auth";
import { etiquetaRol } from "@/lib/etiquetas";
import { Navegacion, type ItemMenu } from "@/components/Navegacion";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const { perfil } = await obtenerSesion();

  const items: ItemMenu[] = [
    { href: "/", texto: "Inicio", icono: "inicio" },
    { href: "/cuarteles", texto: "Cuarteles", icono: "cuarteles" },
    { href: "/riego", texto: "Riego", icono: "riego" },
    { href: "/campo", texto: "Campo", icono: "campo" },
  ];
  if (perfil.rol === "administrador") items.push({ href: "/usuarios", texto: "Usuarios", icono: "usuarios" });
  if (perfil.rol === "administrador" || perfil.rol === "propietario")
    items.push({ href: "/actividad", texto: "Actividad", icono: "actividad" });

  return (
    <div className="min-h-dvh">
      <Navegacion items={items} barraMovil={items.slice(0, 4)} nombre={perfil.nombre} rol={etiquetaRol(perfil.rol)} />
      <main className="px-4 pb-24 pt-5 sm:px-6 lg:ml-64 lg:px-10 lg:pb-12 lg:pt-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
