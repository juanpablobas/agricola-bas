import { redirect } from "next/navigation";

// "Qué comprar" se reemplazó por "Pedido de productos" (más simple, por carozos y nogales)
export default function Compra() {
  redirect("/programas/pedido");
}
