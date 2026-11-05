import { redirect } from "next/navigation";

// "Planificar" se juntó con "Agregar labor": lo planificado es una labor "por hacer".
export default function Planificar() {
  redirect("/labores/registrar?estado=programado");
}
