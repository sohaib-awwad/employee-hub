import { createContext, useContext, type ReactNode } from "react";
import {
  useGetCurrentUser,
  getGetCurrentUserQueryKey,
  useLogout,
  type Employee,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface AuthContextValue {
  /** The logged-in user, or null when not authenticated. */
  user: Employee | null;
  /** True while the initial /auth/me check is in flight. */
  isLoading: boolean;
  isAdmin: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Provides the current user to the whole app. It reads /auth/me once; a 401
 * (not logged in) is treated as "no user" rather than an error to surface.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useGetCurrentUser({
    query: {
      queryKey: getGetCurrentUserQueryKey(),
      retry: false,
      staleTime: 5 * 60 * 1000,
    },
  });

  const logoutMutation = useLogout();

  // A 401 from /auth/me just means "not signed in".
  const user = isError ? null : data ?? null;

  const logout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } finally {
      // Drop every cached, user-scoped query, then re-check /auth/me (→ 401),
      // which flips `user` to null and sends the guards back to /login.
      queryClient.clear();
      await queryClient.invalidateQueries({
        queryKey: getGetCurrentUserQueryKey(),
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAdmin: user?.role === "admin", logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
