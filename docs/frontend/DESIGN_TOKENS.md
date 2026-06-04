# Bino Foundry — design tokens (M2 audit)

Source of truth: `frontend/src/index.css` and `frontend/tailwind.config.ts`.

## Brand

| Token | Role |
|-------|------|
| `--primary` / `gold` | Luxury accent (HSL 43 85% 38%) |
| `--foreground` | Body text on `--background` |
| `--muted` / `--muted-foreground` | Panels and secondary text (AA on background) |
| `--radius` | 0.5rem base; cards use `rounded-xl` / `2rem` for customiser |

## Typography

- **Display:** Playfair Display (`font-display`) — headings, prices
- **Body:** Inter (`font-body`) — UI controls

## Buttons

Use shared `Button` variants from `@/components/ui/button`:

- Customer builders: `luxe`, `luxe-outline`, `secondary`, `ghost`
- Admin: `default`, `outline`, `secondary`

## Layout utilities

- `layout-header` / `layout-main` — safe areas (`env(safe-area-inset-*)`)
- `builder-split`, `builder-panel`, `builder-library` — responsive builders
- `customiser-options-scroll`, `admin-scroll-pane` — touch-friendly scroll regions

## Motion

Respect `prefers-reduced-motion` via `.motion-safe-animate` and `.motion-safe-spin` in `index.css`.
