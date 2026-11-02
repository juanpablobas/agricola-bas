// Íconos de trazo simple (24x24), sin dependencias externas.
const RUTAS: Record<string, string> = {
  inicio: "M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5",
  cuarteles: "M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z",
  riego: "M12 3.5s-6 6.6-6 10.5a6 6 0 0 0 12 0c0-3.9-6-10.5-6-10.5z",
  campo: "M3 20h18M5 20V9l7-5 7 5v11M10 20v-6h4v6",
  usuarios: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.5a6.5 6.5 0 0 1 3.5 5.5",
  actividad: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  cuenta: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  salir: "M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10",
  menu: "M4 7h16M4 12h16M4 17h16",
  cerrar: "M6 6l12 12M18 6 6 18",
  mas: "M12 5v14M5 12h14",
  editar: "M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4",
  volver: "M15 5l-7 7 7 7",
  subir: "M12 16V4M7 9l5-5 5 5M4 20h16",
  archivo: "M6 3h8l4 4v14H6zM14 3v4h4",
  foto: "M4 7h3l2-2h6l2 2h3v12H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  buscar: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  alerta: "M12 4 2.5 20h19L12 4zM12 10v4M12 17v.5",
  ok: "M5 12.5l4.5 4.5L19 7.5",
  historia: "M3 12a9 9 0 1 0 3-6.7M3 4v4.5h4.5M12 8v4l3 2",
  basura: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
};

export function Icono({ nombre, className = "size-5" }: { nombre: keyof typeof RUTAS | string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={RUTAS[nombre] ?? ""} />
    </svg>
  );
}
