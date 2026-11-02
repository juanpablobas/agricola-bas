"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { Icono } from "./Icono";

type Registrar = (datos: {
  ruta: string;
  nombre: string;
  mime: string;
  bytes: number;
  entidad: string;
  entidad_id: string;
  descripcion?: string | null;
}) => Promise<{ ok?: string; error?: string }>;

const MAX_MB = 50;

function nombreSeguro(n: string) {
  const limpio = n
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-80);
  return limpio || "archivo";
}

export function SubirArchivo({ entidad, entidadId, registrar }: { entidad: string; entidadId: string; registrar: Registrar }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<{ tipo: "ok" | "error" | "subiendo"; texto: string } | null>(null);

  async function subir(archivos: FileList | null) {
    if (!archivos?.length) return;
    const supabase = crearClienteNavegador();
    let subidos = 0;
    for (const archivo of Array.from(archivos)) {
      if (archivo.size > MAX_MB * 1024 * 1024) {
        setEstado({ tipo: "error", texto: `${archivo.name} pesa más de ${MAX_MB} MB.` });
        continue;
      }
      setEstado({ tipo: "subiendo", texto: `Subiendo ${archivo.name}…` });
      const ruta = `${entidad}/${entidadId}/${Date.now()}-${nombreSeguro(archivo.name)}`;
      const { error } = await supabase.storage.from("archivos").upload(ruta, archivo, {
        contentType: archivo.type || undefined,
        upsert: false,
      });
      if (error) {
        setEstado({ tipo: "error", texto: `No se pudo subir ${archivo.name}.` });
        continue;
      }
      const r = await registrar({
        ruta,
        nombre: archivo.name,
        mime: archivo.type || "application/octet-stream",
        bytes: archivo.size,
        entidad,
        entidad_id: entidadId,
      });
      if (r.error) {
        setEstado({ tipo: "error", texto: r.error });
        continue;
      }
      subidos++;
    }
    if (entrada.current) entrada.current.value = "";
    if (subidos > 0) {
      setEstado({ tipo: "ok", texto: subidos === 1 ? "Archivo agregado." : `${subidos} archivos agregados.` });
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="boton-secundario w-fit cursor-pointer">
        <Icono nombre="subir" className="size-4" />
        Subir foto o documento
        <input
          ref={entrada}
          type="file"
          multiple
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.kml,.kmz,.dwg"
          className="sr-only"
          onChange={(e) => subir(e.target.files)}
        />
      </label>
      {estado && (
        <p
          className={`text-sm ${estado.tipo === "error" ? "text-alerta" : estado.tipo === "ok" ? "text-verde" : "text-tinta-suave"}`}
          role="status"
        >
          {estado.texto}
        </p>
      )}
    </div>
  );
}
