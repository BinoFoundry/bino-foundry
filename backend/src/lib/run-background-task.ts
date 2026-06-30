/** Run work after the current response without blocking the request handler. */
export function runBackgroundTask(label: string, task: () => Promise<void>): void {
  queueMicrotask(() => {
    void task().catch((error) => {
      console.warn(`[background:${label}]`, error);
    });
  });
}
