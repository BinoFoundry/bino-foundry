import { Button } from "@/components/ui/button";

interface AdminDeleteConfirmProps {
  /** When false, nothing is rendered (default true for toolbar inline use). */
  open?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  label?: string;
}

export function AdminDeleteConfirm({
  open = true,
  onCancel,
  onConfirm,
  label = "Delete?",
}: AdminDeleteConfirmProps) {
  if (!open) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-destructive">{label}</span>
      <Button variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
      <Button variant="destructive" size="sm" onClick={onConfirm}>
        Confirm
      </Button>
    </div>
  );
}
