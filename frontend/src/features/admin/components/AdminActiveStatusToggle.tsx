import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

import { AdminStatusBadge } from "./AdminStatusBadge";

interface AdminActiveStatusToggleProps {
  isActive: boolean;
  entityLabel: string;
  disabled?: boolean;
  onConfirm: (nextActive: boolean) => void | Promise<void>;
  className?: string;
}

/**
 * Clickable Active/Inactive badge for admin list rows.
 * Asks for a quick confirmation, then calls onConfirm with the next status.
 */
export function AdminActiveStatusToggle({
  isActive,
  entityLabel,
  disabled = false,
  onConfirm,
  className,
}: AdminActiveStatusToggleProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const nextActive = !isActive;

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm(nextActive);
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled || busy}
        className={cn(
          "mt-1 inline-flex rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60",
          className,
        )}
        aria-label={
          isActive
            ? `Mark ${entityLabel} inactive`
            : `Mark ${entityLabel} active`
        }
        title={isActive ? "Click to set Inactive" : "Click to set Active"}
        onClick={(e) => {
          e.stopPropagation();
          setConfirmOpen(true);
        }}
      >
        {isActive === false ? (
          <AdminStatusBadge label="Inactive" variant="danger" />
        ) : (
          <AdminStatusBadge label="Active" variant="success" />
        )}
      </button>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!busy) setConfirmOpen(open);
        }}
      >
        <AlertDialogContent
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {nextActive ? "Set as Active?" : "Set as Inactive?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {nextActive
                ? `${entityLabel} will become Active and available where this catalogue is used.`
                : `${entityLabel} will become Inactive and hidden from active catalogue use.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={busy}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirm();
              }}
            >
              {busy ? "Updating…" : nextActive ? "Set Active" : "Set Inactive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
