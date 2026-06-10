import { Link } from "react-router-dom";
import { Settings, ShoppingBag, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { BUILDER_COPY } from "@/layouts/builder-copy";
import { useAuth } from "@/state/auth/AuthProvider";

export function BuilderHeaderActions() {
  const { user, openAuth, hasPermission } = useAuth();

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      {user ? (
        <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" asChild>
          <Link to="/account">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">{BUILDER_COPY.account}</span>
          </Link>
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          onClick={() => openAuth({ mode: "sign-in" })}
        >
          <User className="h-4 w-4" />
          <span className="hidden sm:inline">{BUILDER_COPY.account}</span>
        </Button>
      )}

      {hasPermission("admin.access") ? (
        <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" asChild>
          <Link to="/admin">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Manage</span>
          </Link>
        </Button>
      ) : null}

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
