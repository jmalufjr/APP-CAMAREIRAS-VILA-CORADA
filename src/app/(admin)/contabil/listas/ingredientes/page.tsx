import { redirect } from "next/navigation";

// Mudou para Listas operacionais, abaixo do cardápio de bar da piscina.
export default function IngredientesRedirect() {
  redirect("/checklists/poolbar/ingredientes");
}
