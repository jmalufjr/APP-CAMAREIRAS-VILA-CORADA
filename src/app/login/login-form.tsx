"use client";

import { useState, useTransition } from "react";
import { signInAction, type LoginOption } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

export function LoginForm({ options }: { options: LoginOption[] }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Card className="border-border/70">
      <CardContent className="pt-6">
        <form
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await signInAction(formData);
              if (result?.error) setError(result.error);
            });
          }}
          className="space-y-5"
        >
          <div className="space-y-2">
            <Label htmlFor="user">Usuário</Label>
            <Select value={email} onValueChange={(v) => setEmail(v ?? "")}>
              <SelectTrigger id="user" className="w-full">
                <SelectValue placeholder="Selecione seu nome" />
              </SelectTrigger>
              <SelectContent>
                {options.map((opt) => (
                  <SelectItem key={opt.id} value={opt.email}>
                    {opt.role === "admin" ? "admin" : opt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="email" value={email} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={isPending || !email}>
            {isPending ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
