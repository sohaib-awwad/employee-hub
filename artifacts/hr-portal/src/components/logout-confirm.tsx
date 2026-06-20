import { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * Wraps any logout trigger (icon button, menu item, …) and asks for
 * confirmation before actually ending the session.
 */
export function LogoutConfirm({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Log out of Olive?</AlertDialogTitle>
          <AlertDialogDescription>
            You'll be returned to the sign-in page and will need to log in again to continue.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-logout-cancel">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => logout()}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="button-logout-confirm"
          >
            Log out
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
