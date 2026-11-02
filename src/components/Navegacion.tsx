"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icono } from "./Icono";

export type ItemMenu = { href: string; texto: string; icono: string };

function activo(ruta: string, href: string) {
  return href === "/" ? ruta === "/" : ruta === href || ruta.startsWith(href + "/");
}

function Marca() {
  return (
    <div className="rounded-xl bg-white px-3 py-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Agrícola BAS · Frutícola" className="h-auto w-full max-w-44" />
    </div>
  );
}

function Lista({ items, ruta, alElegir }: { items: ItemMenu[]; ruta: string; alElegir?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((i) => {
        const a = activo(ruta, i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            onClick={alElegir}
            aria-current={a ? "page" : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${
              a ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/6 hover:text-white"
            }`}
          >
            <Icono nombre={i.icono} className="size-5 shrink-0" />
            {i.texto}
          </Link>
        );
      })}
    </nav>
  );
}

function PieUsuario({ nombre, rol }: { nombre: string; rol: string }) {
  return (
    <div className="border-t border-white/10 pt-3">
      <Link href="/cuenta" className="flex items-center gap-3 rounded-lg px-3 py-2 text-white/80 hover:bg-white/6">
        <Icono nombre="cuenta" className="size-5 shrink-0" />
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-medium text-white">{nombre || "Mi cuenta"}</span>
          <span className="block truncate text-xs text-white/55">{rol}</span>
        </span>
      </Link>
      <form action="/auth/salir" method="post">
        <button className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-white/70 hover:bg-white/6 hover:text-white">
          <Icono nombre="salir" className="size-5" />
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}

export function Navegacion({
  items,
  barraMovil,
  nombre,
  rol,
}: {
  items: ItemMenu[];
  barraMovil: ItemMenu[];
  nombre: string;
  rol: string;
}) {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);

  useEffect(() => setAbierto(false), [ruta]);

  return (
    <>
      {/* Computador: menú lateral fijo */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col justify-between bg-verde-oscuro p-4 lg:flex">
        <div className="flex flex-col gap-6">
          <Marca />
          <Lista items={items} ruta={ruta} />
        </div>
        <PieUsuario nombre={nombre} rol={rol} />
      </aside>

      {/* Celular: barra superior */}
      <div className="sticky top-0 z-30 flex items-center justify-between bg-verde-oscuro px-4 py-2.5 lg:hidden">
        <Marca />
        <button
          onClick={() => setAbierto(true)}
          className="grid size-11 place-items-center rounded-lg text-white hover:bg-white/10"
          aria-label="Abrir menú"
        >
          <Icono nombre="menu" className="size-6" />
        </button>
      </div>

      {/* Celular: menú desplegable */}
      {abierto && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button className="absolute inset-0 bg-black/40" onClick={() => setAbierto(false)} aria-label="Cerrar menú" />
          <div className="absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col justify-between bg-verde-oscuro p-4">
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <Marca />
                <button
                  onClick={() => setAbierto(false)}
                  className="grid size-11 place-items-center rounded-lg text-white hover:bg-white/10"
                  aria-label="Cerrar menú"
                >
                  <Icono nombre="cerrar" className="size-6" />
                </button>
              </div>
              <Lista items={items} ruta={ruta} alElegir={() => setAbierto(false)} />
            </div>
            <PieUsuario nombre={nombre} rol={rol} />
          </div>
        </div>
      )}

      {/* Celular: barra inferior con accesos directos */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-linea bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        {barraMovil.map((i) => {
          const a = activo(ruta, i.href);
          return (
            <Link
              key={i.href}
              href={i.href}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                a ? "text-verde" : "text-tinta-suave"
              }`}
            >
              <Icono nombre={i.icono} className="size-6" />
              {i.texto}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
