"use client";

export default function ErrorApp({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="tarjeta mx-auto mt-10 max-w-lg p-6 text-center">
      <h1 className="text-lg font-semibold">Algo falló al cargar esta página</h1>
      <p className="mt-1 text-sm text-tinta-suave">
        Puede ser la conexión. Si se repite, avisa al administrador con este código: {error.digest ?? "sin código"}.
      </p>
      <button onClick={reset} className="boton mt-4">Reintentar</button>
    </div>
  );
}
