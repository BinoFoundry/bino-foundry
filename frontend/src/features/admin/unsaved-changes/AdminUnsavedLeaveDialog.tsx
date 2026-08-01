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

import { ADMIN_UNSAVED_COPY } from "./copy";

interface AdminUnsavedLeaveDialogProps {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
}

export function AdminUnsavedLeaveDialog({ open, onStay, onLeave }: AdminUnsavedLeaveDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{ADMIN_UNSAVED_COPY.title}</AlertDialogTitle>
          <AlertDialogDescription>{ADMIN_UNSAVED_COPY.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel type="button" onClick={onStay}>
            {ADMIN_UNSAVED_COPY.stay}
          </AlertDialogCancel>
          <AlertDialogAction type="button" onClick={onLeave}>
            {ADMIN_UNSAVED_COPY.leave}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
