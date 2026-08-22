import { getLoginOptions } from "@/lib/actions/auth";
import { LoginForm } from "./login-form";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { BrandLogo } from "@/components/shared/brand-logo";

export default async function LoginPage() {
  const options = await getLoginOptions();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12 relative">
      <ThemeToggle className="absolute top-4 right-4" />
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <BrandLogo size={140} priority />
          <div>
            <h1 className="font-heading text-3xl leading-none text-primary">Vila Corada</h1>
            <p className="text-xs text-muted-foreground tracking-wide mt-2">CAMAREIRAS</p>
          </div>
        </div>
        <LoginForm options={options} />
      </div>
    </div>
  );
}
