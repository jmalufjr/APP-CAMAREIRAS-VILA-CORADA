import { redirect } from "next/navigation";

// A ficha técnica agora fica em cada item do cardápio de bar da piscina.
export default function FichaTecnicaRedirect() {
  redirect("/checklists/poolbar");
}
