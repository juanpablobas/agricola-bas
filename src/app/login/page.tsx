import { FormularioIngreso } from "./FormularioIngreso";
import { Aviso } from "@/components/Aviso";

export const metadata = { title: "Ingresar" };

export default async function PaginaIngreso({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="grid min-h-dvh place-items-center bg-verde-oscuro px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-white">
          <span className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-white/10 text-lg font-bold tracking-wide">
            BAS
          </span>
          <h1 className="text-xl font-semibold">Agrícola BAS</h1>
          <p className="text-sm text-white/65">Fundo La Morera · Graneros</p>
        </div>
        <div className="tarjeta p-6 shadow-xl shadow-black/20">
          {error === "inactivo" && (
            <div className="mb-4">
              <Aviso tipo="error">Tu cuenta está desactivada. Habla con el administrador.</Aviso>
            </div>
          )}
          {error === "enlace" && (
            <div className="mb-4">
              <Aviso tipo="error">El enlace venció o ya se usó. Pide uno nuevo.</Aviso>
            </div>
          )}
          <FormularioIngreso />
        </div>
      </div>
    </main>
  );
}
