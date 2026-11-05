import { redirect } from "next/navigation";

// Las tareas del plan pasaron a ser labores "por hacer" en la lista de Labores.
export default function EditarPlan() {
  redirect("/labores");
}
