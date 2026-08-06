"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Field, inputClass } from "@/components/ui/primitives";
import { isSupabaseConfigured } from "@/lib/storage/adapter";

const schema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "At least 8 characters."),
  displayName: z.string().max(80).optional(),
});

type Values = z.infer<typeof schema>;

/**
 * Accounts are Phase 2. The form is real and validated, but until Supabase
 * credentials exist it says so plainly rather than failing silently.
 */
export function AuthPanel({ mode }: { mode: "login" | "signup" }) {
  const configured = isSupabaseConfigured();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<Values>();

  const onSubmit = handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError((issue.path[0] as keyof Values) ?? "email", { message: issue.message });
      return;
    }
    setError("email", {
      message: configured
        ? "Supabase auth isn’t wired up in this build yet."
        : "Accounts need Supabase credentials. Your sheets are saved in this browser meanwhile.",
    });
  });

  return (
    <main id="main" className="grid min-h-dvh place-items-center px-5">
      <div className="w-full max-w-sm">
        <Link href="/" className="label">
          ← Film Contact Sheet
        </Link>
        <h1 className="mt-4 text-3xl tracking-tight text-warm">
          {mode === "login" ? "Sign in" : "Create an account"}
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-smoke">
          {configured
            ? "Sign in to sync your sheets across devices."
            : "This deployment stores sheets locally in your browser — no account required. Accounts arrive with cloud storage."}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {mode === "signup" ? (
            <Field label="Display name">
              {(id) => <input id={id} className={inputClass} {...register("displayName")} />}
            </Field>
          ) : null}
          <Field label="Email">
            {(id) => (
              <input id={id} type="email" autoComplete="email" className={inputClass} {...register("email")} />
            )}
          </Field>
          <Field label="Password">
            {(id) => (
              <input
                id={id}
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className={inputClass}
                {...register("password")}
              />
            )}
          </Field>
          {errors.email?.message || errors.password?.message ? (
            <p role="alert" className="text-[12px] text-darkroom">
              {errors.email?.message ?? errors.password?.message}
            </p>
          ) : null}
          <Button variant="primary" type="submit" className="w-full" disabled={isSubmitting}>
            {mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <div className="mt-6 flex items-center justify-between text-[13px]">
          <Link href={mode === "login" ? "/signup" : "/login"} className="text-smoke hover:text-warm">
            {mode === "login" ? "Create an account" : "I already have an account"}
          </Link>
          <Link href="/projects" className="text-smoke hover:text-warm">
            Continue without one →
          </Link>
        </div>
      </div>
    </main>
  );
}
