import { useEffect, useRef } from "react";

/**
 * Scroll editor to top only when opening the form or switching records — not after save.
 */
export function useAdminEditorScroll<T extends { id: string }>(
  scrollRef: React.RefObject<HTMLElement | null>,
  modal: { type: "add" } | { type: "edit"; entry: T } | null,
  extraDeps: unknown[] = [],
): void {
  const prevKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const key = modal ? (modal.type === "add" ? "add" : modal.entry.id) : null;
    if (key !== null && key !== prevKeyRef.current) {
      scrollRef.current?.scrollTo({ top: 0 });
    }
    prevKeyRef.current = key;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- extraDeps are intentional triggers (e.g. filter)
  }, [modal, scrollRef, ...extraDeps]);
}
