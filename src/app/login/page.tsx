import { getLoginOptions } from "@/lib/actions/auth";
import { LoginForm } from "./login-form";
import Image from "next/image";

export default async function LoginPage() {
  const options = await getLoginOptions();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
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
          <div>
            <h1 className="font-heading text-3xl text-primary">Camareiras</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Vila Corada · Suítes Beira Mar
            </p>
          </div>
        </div>
        <LoginForm options={options} />
      </div>
    </div>
  );
}
