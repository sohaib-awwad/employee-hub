import { Switch, Route, Redirect, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
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
