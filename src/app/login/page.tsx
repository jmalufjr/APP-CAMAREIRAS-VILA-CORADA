import { getLoginOptions } from "@/lib/actions/auth";
import { LoginForm } from "./login-form";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import Image from "next/image";

export default async function LoginPage() {
  const options = await getLoginOptions();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12 relative">
      <ThemeToggle className="absolute top-4 right-4" />
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <Image
            src="/vila-corada-logo.svg"
            alt="Vila Corada"
            width={140}
            height={140}
            className="size-[140px]"
            priority
          />
          <h1 className="font-heading text-3xl text-primary">Camareiras</h1>
        </div>
        <LoginForm options={options} />
      </div>
    </div>
  );
}
