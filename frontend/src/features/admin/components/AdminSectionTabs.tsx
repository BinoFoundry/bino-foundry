import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AdminTabOption<T extends string> {
  id: T;
  label: string;
}

interface AdminSectionTabsProps<T extends string> {
  tabs: readonly AdminTabOption<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
}

export function AdminSectionTabs<T extends string>({
  tabs,
  active,
  onChange,
  className,
}: AdminSectionTabsProps<T>) {
  return (
    <div className={cn("flex flex-wrap gap-2 border-b border-border px-4 py-3 sm:px-6", className)}>
      {tabs.map((tab) => (
        <Button
          key={tab.id}
          size="sm"
          variant={active === tab.id ? "default" : "outline"}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </Button>
      ))}
    </div>
  );
}
