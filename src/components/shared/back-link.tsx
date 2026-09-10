import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function BackLink({ href, label = "Voltar" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
      <ArrowLeft size={15} /> {label}
    </Link>
  );
}
