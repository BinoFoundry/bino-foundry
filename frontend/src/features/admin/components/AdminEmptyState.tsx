interface AdminEmptyStateProps {
  message?: string;
}

export function AdminEmptyState({ message = "No items found." }: AdminEmptyStateProps) {
  return <p className="py-12 text-center text-sm text-muted-foreground">{message}</p>;
}
