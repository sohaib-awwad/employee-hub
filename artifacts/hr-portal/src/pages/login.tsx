import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
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
import { Loader2 } from "lucide-react";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

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
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        {/* Brand — same mark/wordmark as the app sidebar for consistency */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex items-center gap-2">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="shrink-0">
              <path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-4H7l5-8v4h4l-5 8z"
                fill="#22C55E"
              />
            </svg>
            <span className="text-2xl font-bold tracking-tight text-foreground">
              Olive
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to your Employee Hub
          </p>
        </div>

        <Card className="border-border shadow-sm">
          <CardContent className="p-6">
            {serverError && (
              <div
                className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                data-testid="text-login-error"
                role="alert"
              >
                {serverError}
              </div>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          autoComplete="email"
                          placeholder="you@company.com"
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
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="current-password"
                          placeholder="••••••••"
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
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
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
            <div className="mt-6 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground/70">Demo accounts</p>
              <p className="mt-1">
                <span className="font-medium">Admin</span> — admin@example.com / admin123
              </p>
              <p>
                <span className="font-medium">Employee</span> — employee@example.com / employee123
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
