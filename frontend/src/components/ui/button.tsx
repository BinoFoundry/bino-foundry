import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Olive primary fill — blush hover, olive text (Bino Foundry interaction system).
 * Uses explicit tokens so foreground never aliases --btn-primary-bg.
 */
const primaryOliveFill = [
  "btn-primary-olive",
  "bg-[hsl(var(--brand-olive))] text-[hsl(var(--primary-foreground))]",
  "hover:bg-[#D9BBB0] hover:text-[#404225]",
  "active:bg-[#D9BBB0] active:text-[#404225]",
  "focus-visible:text-[hsl(var(--primary-foreground))]",
  "hover:focus-visible:text-[#404225]",
].join(" ");

/**
 * Bino Foundry premium button system.
 *
 * - `default` / `primary` — olive fill, primary-foreground text
 * - `secondary` / `outline` — white fill, muted olive border & text
 * - `ghost` / `link` — minimal text buttons
 * - `luxe` / `luxe-outline` — aliases (deprecated, use primary/secondary)
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap font-body text-nav font-normal tracking-brand",
    "rounded-[var(--btn-radius)] transition-colors duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-45",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-current",
  ].join(" "),
  {
    variants: {
      variant: {
        /** Primary CTA — olive background, primary-foreground text/icons */
        default: primaryOliveFill,
        primary: primaryOliveFill,
        /** Secondary — white background, muted olive border & text */
        secondary: [
          "border border-[hsl(var(--btn-secondary-border))] bg-[hsl(var(--btn-secondary-bg))] text-[hsl(var(--btn-secondary-fg))]",
          "hover:border-[hsl(var(--btn-secondary-border))] hover:bg-[hsl(var(--btn-secondary-hover-bg))] hover:text-[hsl(var(--btn-secondary-hover-fg))]",
        ].join(" "),
        outline: [
          "border border-[hsl(var(--btn-secondary-border))] bg-[hsl(var(--btn-secondary-bg))] text-[hsl(var(--btn-secondary-fg))]",
          "hover:border-[hsl(var(--btn-secondary-border))] hover:bg-[hsl(var(--btn-secondary-hover-bg))] hover:text-[hsl(var(--btn-secondary-hover-fg))]",
        ].join(" "),
        /** Text button — no fill, subtle hover */
        ghost: [
          "text-[hsl(var(--btn-text-fg))]",
          "hover:bg-[hsl(var(--btn-text-hover-bg))] hover:text-[hsl(var(--btn-text-hover-fg))]",
        ].join(" "),
        link: [
          "text-[hsl(var(--btn-text-hover-fg))] underline-offset-4",
          "hover:underline hover:text-[hsl(var(--btn-primary-hover))]",
        ].join(" "),
        /** Destructive — muted, no bright alarm styling */
        destructive: [
          "bg-destructive text-destructive-foreground",
          "hover:bg-[hsl(var(--btn-destructive-hover))]",
        ].join(" "),
        /** @deprecated Use `default` or `primary` */
        luxe: primaryOliveFill,
        /** @deprecated Use `secondary` or `outline` */
        "luxe-outline": [
          "border border-[hsl(var(--btn-secondary-border))] bg-[hsl(var(--btn-secondary-bg))] text-[hsl(var(--btn-secondary-fg))]",
          "hover:border-[hsl(var(--btn-secondary-border))] hover:bg-[hsl(var(--btn-secondary-hover-bg))] hover:text-[hsl(var(--btn-text-hover-fg))]",
        ].join(" "),
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 px-4 text-small",
        lg: "h-11 px-7",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
