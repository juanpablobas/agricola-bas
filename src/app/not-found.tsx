import Link from "next/link";

export default function NoEncontrado() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="text-center">
        <p className="text-sm font-medium text-tinta-suave">Error 404</p>
        <h1 className="mt-1 text-2xl font-semibold">No encontramos esa página</h1>
        <Link href="/" className="boton mt-5">Volver al inicio</Link>
      </div>
    </main>
  );
}
