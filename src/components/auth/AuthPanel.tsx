"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Field, inputClass } from "@/components/ui/primitives";
import { isSupabaseConfigured } from "@/lib/storage/adapter";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const schema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "At least 8 characters."),
  displayName: z.string().max(80).optional(),
});

type Values = z.infer<typeof schema>;

/**
 * Real Supabase auth once credentials exist; until then, the exact same
 * honest "not configured" message it has always shown — no silent failure.
 */
export function AuthPanel({ mode }: { mode: "login" | "signup" }) {
  const configured = isSupabaseConfigured();
  const router = useRouter();
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
    const client = getSupabaseBrowserClient();
    if (!configured || !client) {
      setError("email", {
        message: "Accounts need Supabase credentials. Your sheets are saved in this browser meanwhile.",
      });
      return;
    }

    const { email, password, displayName } = parsed.data;
    const { error } =
      mode === "signup"
        ? await client.auth.signUp({ email, password, options: { data: { display_name: displayName } } })
        : await client.auth.signInWithPassword({ email, password });

    if (error) {
      setError("email", { message: error.message });
      return;
    }
    router.push("/sheets");
  });

  return (
    <main id="main" className="grid min-h-dvh place-items-center px-5">
      <div className="w-full max-w-sm">
        <Link href="/" className="label">
          ← Film Contact Sheet
        </Link>
        <h1 className="mt-4 text-[18px] tracking-tight text-warm">
          {mode === "login" ? "Sign in" : "Create an account"}
        </h1>
        <p className="label mt-2 leading-relaxed">
          {configured
            ? "Sign in to sync your sheets across devices."
            : "This deployment stores sheets locally in your browser — no account required. Accounts arrive with cloud storage."}
        </p>

        <form onSubmit={onSubmit} className="mt-5 space-y-3">
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

        <div className="mt-5 flex items-center justify-between text-[11px]">
          <Link href={mode === "login" ? "/signup" : "/login"} className="text-smoke hover:text-warm">
            {mode === "login" ? "Create an account" : "I already have an account"}
          </Link>
          <Link href="/sheets" className="text-smoke hover:text-warm">
            Continue without one →
          </Link>
        </div>
      </div>
    </main>
  );
}
