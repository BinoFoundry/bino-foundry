import { Button } from "@/components/ui/button";

interface AdminDeleteConfirmProps {
  /** When false, nothing is rendered (default true for toolbar inline use). */
  open?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  label?: string;
  confirmLabel?: string;
  message?: string;
}

export function AdminDeleteConfirm({
  open = true,
  onCancel,
  onConfirm,
  label = "Delete?",
  confirmLabel = "Confirm",
  message,
}: AdminDeleteConfirmProps) {
  if (!open) return null;

  return (
    <div className="flex max-w-md flex-col items-end gap-2 sm:flex-row sm:items-center">
      <div className="text-right sm:text-left">
        <span className="text-xs font-medium text-destructive">{label}</span>
        {message ? <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{message}</p> : null}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="destructive" size="sm" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
