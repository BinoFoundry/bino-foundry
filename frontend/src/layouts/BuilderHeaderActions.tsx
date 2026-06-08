import { ShoppingBag, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { BUILDER_COPY } from "./builder-copy";

export function BuilderHeaderActions() {
  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-1.5 text-muted-foreground"
        onClick={() => toast.message(BUILDER_COPY.accountComingSoon)}
      >
        <User className="h-4 w-4" />
        <span className="hidden sm:inline">{BUILDER_COPY.account}</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-1.5 text-muted-foreground"
        onClick={() => toast.message(BUILDER_COPY.cartComingSoon)}
      >
        <ShoppingBag className="h-4 w-4" />
        <span className="hidden sm:inline">{BUILDER_COPY.cart}</span>
      </Button>
    </div>
  );
}
