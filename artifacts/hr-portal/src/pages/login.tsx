import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ThemeToggle } from "@/components/theme-toggle";
import { Loader2, Zap, Check } from "lucide-react";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

// Sold on the brand panel — kept honest to what Olive actually does.
const HIGHLIGHTS = [
  "Punch in and track your hours",
  "Request time off in seconds",
  "Stay in the loop with announcements",
];

const PORTFOLIO_URL = "https://sohaib-awwad.github.io/Portfolio/";

export default function Login() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const login = useLogin();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (values: LoginValues) => {
    setServerError(null);
    login.mutate(
      { data: values },
      {
        onSuccess: (employee) => {
          // Prime the auth cache so the route guards re-render immediately,
          // then land on the role's home.
          queryClient.setQueryData(getGetCurrentUserQueryKey(), employee);
          setLocation(employee.role === "admin" ? "/admin" : "/");
        },
        onError: () =>
          setServerError("Invalid email or password. Please try again."),
      },
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background lg:grid lg:grid-cols-2">
      {/* Brand panel — fixed olive gradient with layered texture, light text */}
      <div
        className="relative flex flex-col justify-between overflow-hidden px-8 py-10 text-white lg:px-12 lg:py-12 xl:px-16 xl:py-14"
        style={{
          background:
            "radial-gradient(115% 85% at 80% 22%, hsl(84 40% 32% / 0.7) 0%, transparent 55%), linear-gradient(150deg, hsl(156 26% 9%) 0%, hsl(164 32% 6%) 100%)",
        }}
      >
        {/* Texture: fine dot grid + soft glow blobs */}
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.07) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="pointer-events-none absolute -left-28 -bottom-24 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -top-20 right-0 h-72 w-72 rounded-full bg-[#9DB36B]/10 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "120px 120px",
          }}
        />

        {/* Logo + wordmark */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg shadow-black/20">
            <Zap className="h-6 w-6 text-white" fill="currentColor" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-white">Olive</span>
        </div>

        {/* Headline + copy */}
        <div className="relative z-10 my-10 lg:my-0 lg:max-w-lg">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#9DB36B]">
            Employee Hub
          </p>
          <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl xl:text-5xl">
            Everything your workday needs, in one place.
          </h1>
          <p className="mt-5 hidden max-w-md text-base leading-relaxed text-white/70 sm:block lg:text-lg">
            Track your hours, request time off, and stay on top of company
            announcements — sign in to pick up where you left off.
          </p>

          <ul className="mt-9 hidden space-y-4 lg:block">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#9DB36B]/15 text-[#9DB36B]">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <span className="text-base text-white/85">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 hidden text-sm text-white/40 lg:block">
          © {new Date().getFullYear()} Olive · made by{" "}
          <a
            href={PORTFOLIO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[#9DB36B] underline-offset-2 hover:text-[#b6cc8d] hover:underline"
          >
            Floppy Man
          </a>
        </p>
      </div>

      {/* Form panel — token-based, adapts to light/dark */}
      <div className="relative flex flex-1 items-center justify-center px-6 py-12 sm:px-10 lg:px-12">
        <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-md">
          <h2 className="text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
            Welcome back
          </h2>
          <p className="mt-2 text-base text-muted-foreground">
            Sign in to your Employee Hub
          </p>

          {serverError && (
            <div
              className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              data-testid="text-login-error"
              role="alert"
            >
              {serverError}
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder="you@company.com"
                        className="h-11 text-base"
                        {...field}
                        data-testid="input-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        placeholder="••••••••"
                        className="h-11 text-base"
                        {...field}
                        data-testid="input-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="h-11 w-full bg-primary text-base text-primary-foreground hover:bg-primary/90"
                disabled={login.isPending}
                data-testid="button-login"
              >
                {login.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          </Form>

          {/* Demo accounts — convenience for reviewers; remove for production. */}
          <div className="mt-6 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground/70">Demo accounts</p>
            <p className="mt-1">
              <span className="font-medium">Admin</span> — admin@example.com / admin123
            </p>
            <p>
              <span className="font-medium">Employee</span> — employee@example.com / employee123
            </p>
          </div>

          {/* Credit — shown here on mobile (the brand-panel footer is desktop-only) */}
          <p className="mt-8 text-center text-xs text-muted-foreground lg:hidden">
            © {new Date().getFullYear()} Olive · made by{" "}
            <a
              href={PORTFOLIO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Floppy Man
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
