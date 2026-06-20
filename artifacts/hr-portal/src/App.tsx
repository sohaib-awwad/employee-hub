import { Switch, Route, Redirect, Router as WouterRouter } from "wouter";
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from "@tanstack/react-query";
import { getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import AdminLayout from "@/components/admin-layout";
import AdminOverview from "@/pages/admin/overview";
import AdminLeaves from "@/pages/admin/leaves";
import AdminRequests from "@/pages/admin/requests";
import AdminAnnouncements from "@/pages/admin/announcements";
import AdminEmployees from "@/pages/admin/employees";
import AdminAttendance from "@/pages/admin/attendance";
import Layout from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import Attendance from "@/pages/attendance";
import LeaveRequests from "@/pages/leave-requests";
import Announcements from "@/pages/announcements";

const CURRENT_USER_KEY = getGetCurrentUserQueryKey();

// The fetch mutator throws an ApiError carrying the HTTP status.
function isAuthError(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  return status === 401 || status === 403;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
  // If any request is rejected as unauthenticated (401) or not-allowed (403) —
  // e.g. the session cookie was swapped to a non-admin in another tab — re-check
  // /auth/me so the app stops showing a stale view and the route guard sends the
  // user where their real session belongs (login, or the employee app).
  queryCache: new QueryCache({
    onError: (err, query) => {
      if (isAuthError(err) && query.queryKey[0] !== CURRENT_USER_KEY[0]) {
        queryClient.invalidateQueries({ queryKey: CURRENT_USER_KEY });
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (err) => {
      if (isAuthError(err)) {
        queryClient.invalidateQueries({ queryKey: CURRENT_USER_KEY });
      }
    },
  }),
});

// Role-aware routing:
//  - still checking session  → full-screen spinner
//  - not logged in           → only /login is reachable
//  - admin                   → admin area
//  - employee                → the employee app (sidebar layout)
function AuthedRoutes() {
  const { user, isLoading, isAdmin } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route>
          <Redirect to="/login" />
        </Route>
      </Switch>
    );
  }

  if (isAdmin) {
    return (
      <AdminLayout>
        <Switch>
          <Route path="/admin" component={AdminOverview} />
          <Route path="/admin/leaves" component={AdminLeaves} />
          <Route path="/admin/requests" component={AdminRequests} />
          <Route path="/admin/announcements" component={AdminAnnouncements} />
          <Route path="/admin/employees" component={AdminEmployees} />
          <Route path="/admin/attendance" component={AdminAttendance} />
          <Route>
            <Redirect to="/admin" />
          </Route>
        </Switch>
      </AdminLayout>
    );
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/attendance" component={Attendance} />
        <Route path="/leave-requests" component={LeaveRequests} />
        <Route path="/announcements" component={Announcements} />
        <Route path="/login">
          <Redirect to="/" />
        </Route>
        {/* A non-admin landing on an admin URL (e.g. a stale tab) goes home. */}
        <Route path="/admin">
          <Redirect to="/" />
        </Route>
        <Route path="/admin/*">
          <Redirect to="/" />
        </Route>
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <AuthedRoutes />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
