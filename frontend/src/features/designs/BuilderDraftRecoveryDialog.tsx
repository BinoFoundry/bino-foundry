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

import { BUILDER_DRAFT_RECOVERY_COPY } from "./builder-save-copy";

interface BuilderDraftRecoveryDialogProps {
  open: boolean;
  onRestore: () => void;
  onDiscard: () => void;
}

export function BuilderDraftRecoveryDialog({
  open,
  onRestore,
  onDiscard,
}: BuilderDraftRecoveryDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{BUILDER_DRAFT_RECOVERY_COPY.title}</AlertDialogTitle>
          <AlertDialogDescription>{BUILDER_DRAFT_RECOVERY_COPY.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel type="button" onClick={onDiscard}>
            {BUILDER_DRAFT_RECOVERY_COPY.discard}
          </AlertDialogCancel>
          <AlertDialogAction type="button" onClick={onRestore}>
            {BUILDER_DRAFT_RECOVERY_COPY.restore}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
