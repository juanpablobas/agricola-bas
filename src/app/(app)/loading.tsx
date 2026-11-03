// Mientras carga una pantalla se muestra este esqueleto, para que se note al tiro que la app respondió.
export default function Cargando() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Cargando">
      <div className="mb-2 h-4 w-32 rounded bg-linea/70" />
      <div className="mb-6 h-7 w-56 rounded bg-linea" />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="tarjeta h-20" />)}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="tarjeta flex h-52 flex-col gap-3 p-5">
            <div className="h-5 w-1/2 rounded bg-linea" />
            <div className="h-8 w-1/3 rounded bg-linea/70" />
            <div className="h-3 w-full rounded bg-papel" />
            <div className="h-3 w-5/6 rounded bg-papel" />
            <div className="h-3 w-2/3 rounded bg-papel" />
          </div>
        ))}
      </div>
    </div>
  );
}
