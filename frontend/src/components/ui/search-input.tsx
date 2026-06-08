import { Search } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";
import { controlSearchClass } from "@/styles/control-styles";

export interface SearchInputProps extends Omit<React.ComponentProps<"input">, "type"> {
  wrapperClassName?: string;
  iconClassName?: string;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, wrapperClassName, iconClassName, ...props }, ref) => {
    return (
      <div className={cn("relative", wrapperClassName)}>
        <Search
          className={cn(
            "pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground",
            iconClassName,
          )}
          aria-hidden
        />
        <input
          ref={ref}
          type="search"
          className={cn(controlSearchClass, className)}
          {...props}
        />
      </div>
    );
  },
);
SearchInput.displayName = "SearchInput";

export { SearchInput };
