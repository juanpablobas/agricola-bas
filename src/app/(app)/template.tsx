// Se vuelve a montar en cada cambio de pantalla: da una entrada suave al contenido.
export default function Plantilla({ children }: { children: React.ReactNode }) {
  return <div className="aparecer">{children}</div>;
}
