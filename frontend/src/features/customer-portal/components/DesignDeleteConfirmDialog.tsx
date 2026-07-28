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
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DesignDeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "single" | "bulk";
  count?: number;
  busy?: boolean;
  onConfirm: () => void;
}

export function DesignDeleteConfirmDialog({
  open,
  onOpenChange,
  mode,
  count = 1,
  busy = false,
  onConfirm,
}: DesignDeleteConfirmDialogProps) {
  const isBulk = mode === "bulk";
  const title = isBulk ? "Delete Selected Designs" : "Delete Design";
  const confirmLabel = isBulk
    ? busy
      ? "Deleting…"
      : "Delete Designs"
    : busy
      ? "Deleting…"
      : "Delete";

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              {isBulk ? (
                <p>
                  You are about to permanently delete{" "}
                  <span className="font-medium text-foreground">
                    {count} {count === 1 ? "design" : "designs"}
                  </span>
                  .
                </p>
              ) : (
                <p>Are you sure you want to permanently delete this design?</p>
              )}
              <p>This action cannot be undone.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            className={cn(
              buttonVariants({ variant: "destructive" }),
              "text-[hsl(var(--primary-foreground))] hover:text-[hsl(var(--primary-foreground))]",
            )}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
