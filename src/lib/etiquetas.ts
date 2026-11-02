export type Rol = "administrador" | "enc_administrativo" | "enc_agricola" | "operario" | "propietario";

export const ROLES: { valor: Rol; etiqueta: string; descripcion: string }[] = [
  { valor: "administrador", etiqueta: "Administrador", descripcion: "Acceso completo, usuarios y configuración" },
  { valor: "enc_administrativo", etiqueta: "Encargado administrativo", descripcion: "Facturas, compras, presupuesto e informes" },
  { valor: "enc_agricola", etiqueta: "Encargado agrícola", descripcion: "Cuarteles, labores, aplicaciones, cosecha y riego" },
  { valor: "operario", etiqueta: "Operario", descripcion: "Registra sus propias labores" },
  { valor: "propietario", etiqueta: "Propietario", descripcion: "Consulta tableros, informes y resultados" },
];

export const etiquetaRol = (rol: string) => ROLES.find((r) => r.valor === rol)?.etiqueta ?? rol;

export type EstadoProductivo = "en_formacion" | "productivo" | "en_recambio" | "sin_plantar" | "eliminado";

export const ESTADOS: { valor: EstadoProductivo; etiqueta: string }[] = [
  { valor: "en_formacion", etiqueta: "En formación" },
  { valor: "productivo", etiqueta: "Productivo" },
  { valor: "en_recambio", etiqueta: "En recambio" },
  { valor: "sin_plantar", etiqueta: "Sin plantar" },
  { valor: "eliminado", etiqueta: "Eliminado" },
];

export const etiquetaEstado = (e: string) => ESTADOS.find((x) => x.valor === e)?.etiqueta ?? e;

/** Color por especie, usado en gráficos y fichas */
export const COLOR_ESPECIE: Record<string, string> = {
  Nogal: "#7a5c3a",
  Cerezo: "#a3263a",
  Nectarín: "#d9772b",
  Durazno: "#e0a43c",
  Ciruelo: "#6b3f7a",
};
export const colorEspecie = (e?: string | null) => (e && COLOR_ESPECIE[e]) || "#5d6b63";

export const TABLAS: Record<string, string> = {
  perfil: "Usuario",
  campo: "Datos del campo",
  temporada: "Temporada",
  especie: "Especie",
  variedad: "Variedad",
  equipo_riego: "Equipo de riego",
  sector_riego: "Sector de riego",
  cuartel: "Cuartel",
  cuartel_sector: "Sector del cuartel",
  cuartel_periodo: "Plantación del cuartel",
  centro_costo: "Centro de costo",
  archivo: "Archivo",
};

export const ACCIONES: Record<string, string> = {
  INSERT: "Creó",
  UPDATE: "Modificó",
  DELETE: "Eliminó",
};
