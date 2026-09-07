/**
 * Run `task` over `items` a few at a time, preserving result order.
 *
 * PostgREST has no multi-row update with differing values, so bulk admin work
 * becomes one request per row. Sending them strictly one after another puts the
 * total at the mercy of the row count: the bead asset recalculation grew past
 * the hosting gateway's 30s ceiling and failed outright rather than finishing
 * slowly. Overlapping a bounded number keeps the wall time proportional to the
 * round trip instead, while the bound keeps us inside Supabase's connection
 * limits and stops a large catalogue stampeding it.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const limit = Math.max(1, Math.floor(concurrency));
  const results = new Array<R>(items.length);
  let next = 0;

  const worker = async (): Promise<void> => {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await task(items[index]!, index);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
