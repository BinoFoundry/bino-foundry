import { Button } from "@/components/ui/button";

interface AdminDeleteConfirmProps {
  onCancel: () => void;
  onConfirm: () => void;
  label?: string;
}

export function AdminDeleteConfirm({
  onCancel,
  onConfirm,
  label = "Delete?",
}: AdminDeleteConfirmProps) {
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
