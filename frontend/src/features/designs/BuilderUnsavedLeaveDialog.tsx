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

import { BUILDER_UNSAVED_LEAVE_COPY } from "./builder-save-copy";

interface BuilderUnsavedLeaveDialogProps {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
}

export function BuilderUnsavedLeaveDialog({
  open,
  onStay,
  onLeave,
}: BuilderUnsavedLeaveDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{BUILDER_UNSAVED_LEAVE_COPY.title}</AlertDialogTitle>
          <AlertDialogDescription>{BUILDER_UNSAVED_LEAVE_COPY.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel type="button" onClick={onStay}>
            {BUILDER_UNSAVED_LEAVE_COPY.stay}
          </AlertDialogCancel>
          <AlertDialogAction type="button" onClick={onLeave}>
            {BUILDER_UNSAVED_LEAVE_COPY.leave}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
