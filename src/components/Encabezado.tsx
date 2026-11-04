import Link from "next/link";
import { Icono } from "./Icono";

export function Encabezado({
  titulo,
  subtitulo,
  volver,
  acciones,
}: {
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  volver?: { href: string; texto: string };
  acciones?: React.ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {volver && (
          <Link href={volver.href} className="mb-1 inline-flex items-center gap-1 text-sm text-tinta-suave hover:text-verde">
            <Icono nombre="volver" className="size-4" />
            {volver.texto}
          </Link>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-tinta">{titulo}</h1>
        {subtitulo && <p className="mt-0.5 text-sm text-tinta-suave">{subtitulo}</p>}
      </div>
      {acciones && (
        // En el celular los botones quedan ordenados en dos columnas, del mismo ancho y fáciles de tocar
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap [&>*]:px-3 sm:[&>*]:px-4 [&>:first-child:nth-last-child(odd)]:col-span-2 [&>*]:text-center [&>*]:leading-tight">
          {acciones}
        </div>
      )}
    </header>
  );
}
