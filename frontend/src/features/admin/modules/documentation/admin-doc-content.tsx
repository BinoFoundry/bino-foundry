import type { ReactNode } from "react";

import type { AdminDocTopicId } from "./admin-doc-topics";

export interface AdminDocSection {
  heading: string;
  body: ReactNode;
}

/** Rich article bodies keyed by topic. Kept in TSX for simple formatting. */
export function getAdminDocSections(topic: AdminDocTopicId): AdminDocSection[] {
  switch (topic) {
    case "overview":
      return [
        {
          heading: "What Admin controls",
          body: (
            <>
              <p>
                Admin is the catalogue and rendering control plane for the Bracelet Builder and
                Sunglasses Builder. Changes here flow into the live storefront after save — there is
                no separate “publish” step for most catalogue fields.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  <span className="font-medium text-foreground">Products</span> — frames, beads,
                  types, sizes, wrist targets, preparation options
                </li>
                <li>
                  <span className="font-medium text-foreground">Sunglasses</span> — tints, add-ons,
                  lens glass look
                </li>
                <li>
                  <span className="font-medium text-foreground">Settings</span> — system strand
                  defaults, currency, email
                </li>
              </ul>
            </>
          ),
        },
        {
          heading: "Recommended order for a new bracelet asset",
          body: (
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Confirm bead sizes and wrist sizes exist under Products.</li>
              <li>Open the correct Bead type / sub-type (Crystal, Charm → Dangling, etc.).</li>
              <li>Add the bead in Bead library — upload, crop, enable sizes.</li>
              <li>
                Check Live Preview with <span className="font-medium text-foreground">Use Parent
                Calibration</span> on first. Only then create a Custom Override if needed.
              </li>
              <li>Spot-check in the Bracelet Builder at a small and a large wrist (e.g. 14 cm and 20 cm).</li>
            </ol>
          ),
        },
        {
          heading: "Defaults vs Custom Override",
          body: (
            <>
              <p>
                Rendering uses a hierarchy. More specific levels win only when they opt out of
                parent calibration:
              </p>
              <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-muted/40 p-3 text-[11px] leading-relaxed text-foreground">
                {`System default
  → Bead type default
    → Sub-type default
      → Individual bead override`}
              </pre>
              <p className="mt-2">
                Badges such as <span className="font-medium text-foreground">AUTO (Bead Type)</span>{" "}
                mean the value is inherited.{" "}
                <span className="font-medium text-foreground">Custom Override</span> means this level
                owns the value. Saving a type or system default never rewrites existing bead
                overrides.
              </p>
            </>
          ),
        },
      ];

    case "beads":
      return [
        {
          heading: "Bead library workflow",
          body: (
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Create or open a bead and assign type + sub-type.</li>
              <li>Upload the source image, then run crop / cutout so the strand asset is clean.</li>
              <li>
                Enable the catalogue mm sizes customers may buy. Preview Size in strand settings
                follows these enabled sizes.
              </li>
              <li>
                Leave <span className="font-medium text-foreground">Use Parent Calibration</span> on
                unless this one asset needs a unique hang, scale, or anchor.
              </li>
              <li>
                With Parent on, changing Bead type / Sub-type updates Live Preview immediately
                (including Layout mode). The Layout mode control itself stays locked until you turn
                Parent off for a Custom Override.
              </li>
              <li>Save, then verify Live Preview and the Bracelet Builder.</li>
            </ol>
          ),
        },
        {
          heading: "Render size vs strand occupancy",
          body: (
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <span className="font-medium text-foreground">Render size (image only)</span> — how
                large the image looks. Does not change gaps along the cord.
              </li>
              <li>
                <span className="font-medium text-foreground">Strand occupancy (gaps only)</span> —
                how much space along the cord neighbours leave. Stay near 1.00 unless packing is
                wrong. Does not change how large the image looks. The Bracelet Builder always
                equalises leftover gaps; to see occupancy on a sparse strand, use Live Preview →{" "}
                <span className="font-medium text-foreground">Reveal occupancy gaps</span>{" "}
                (preview-only clustered layout).
              </li>
            </ul>
          ),
        },
        {
          heading: "Normalized exports",
          body: (
            <p>
              When size offers show a normalized / re-export flag, regenerate so every mm variant
              shares consistent paint metrics. Skipping this is a common cause of “same mm looks
              different” between crystals and charms.
            </p>
          ),
        },
      ];

    case "bead-types":
      return [
        {
          heading: "Types vs sub-types",
          body: (
            <>
              <p>
                <span className="font-medium text-foreground">Bead types</span> (Crystal, Charm,
                Spacer, …) set placement mode and the main rendering baseline.{" "}
                <span className="font-medium text-foreground">Sub-types</span> (e.g. Charm →
                Dangling (on cord) / Drop (lower hang) / Fixed (on strand)) refine that baseline for
                a family of assets. Dangling and Drop hang the same way; only height differs.
              </p>
              <p className="mt-2">
                Prefer fixing a problem at type or sub-type level when many beads share it. Use a
                bead-level Custom Override only for one-off art.
              </p>
            </>
          ),
        },
        {
          heading: "Placement mode",
          body: (
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <span className="font-medium text-foreground">Replace</span> — typical for crystals
                and spacers that fill a slot.
              </li>
              <li>
                <span className="font-medium text-foreground">Insert between</span> — typical for
                charms and connectors that nest between neighbours.
              </li>
            </ul>
          ),
        },
        {
          heading: "Layout mode",
          body: (
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <span className="font-medium text-foreground">Inline</span> — sits on the cord
                (crystals, fixed charms, spacers).
              </li>
              <li>
                <span className="font-medium text-foreground">Dangling</span> — hangs from its
                hanging ring; height may extend past the cord. Attach point follows automatically.
              </li>
            </ul>
          ),
        },
      ];

    case "strand-render":
      return [
        {
          heading: "Where to edit",
          body: (
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <span className="font-medium text-foreground">General settings → Strand defaults</span>{" "}
                — platform-wide baseline (including visual size scaling).
              </li>
              <li>
                <span className="font-medium text-foreground">Bead types / sub-types</span> — class
                baselines and family refinements.
              </li>
              <li>
                <span className="font-medium text-foreground">Bead library → Strand appearance</span>{" "}
                — per-asset override when parent calibration is turned off.
              </li>
            </ul>
          ),
        },
        {
          heading: "Primary controls",
          body: (
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <span className="font-medium text-foreground">Render size (image only)</span> —
                calibrated photo size from the hierarchy. With Parent on it shows as AUTO /
                read-only from the parent; edit it on the type, or turn Parent off for a Custom
                Override.
              </li>
              <li>
                <span className="font-medium text-foreground">Customize image size</span> —
                optional safe nudge (Image size adjust) while Parent stays on. Scales only the
                photo; does not rewrite Render size, packing, or hang (default 1.00 = identical).
              </li>
              <li>
                <span className="font-medium text-foreground">Strand occupancy (gaps only)</span> —
                space along the bracelet (stay near 1.00).
              </li>
              <li>
                <span className="font-medium text-foreground">Vertical offset</span> — push toward /
                away from the cord (% of item height).
              </li>
              <li>
                <span className="font-medium text-foreground">Layout mode</span> — Inline (on cord)
                or Dangling (hangs from ring). Attach point follows this automatically.
              </li>
              <li>
                <span className="font-medium text-foreground">Orientation</span> — outward or inward
                facing.
              </li>
              <li>
                <span className="font-medium text-foreground">Visual size scaling</span> (system) —
                how strongly 6 → 8 → 10 mm differences appear. Use Compare sizes in Live Preview.
              </li>
            </ul>
          ),
        },
        {
          heading: "Live Preview checklist",
          body: (
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Keep Apply draft settings on while tuning.</li>
              <li>Switch bead size and wrist size in the preview toolbar.</li>
              <li>Enable Compare sizes when checking the size curve or mixed mm charms — neighbours should touch without overlapping.</li>
              <li>Confirm large wrists (e.g. 20 cm) do not clip hanging assets — use Fit / Reset zoom.</li>
              <li>Turn Apply draft off once to confirm the saved catalogue resolve matches Builder.</li>
            </ol>
          ),
        },
        {
          heading: "Intended workflow",
          body: (
            <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 text-[11px] leading-relaxed text-foreground">
              {`New asset
  → sensible type / sub-type default
    → small adjustment only if needed
      → usable result

Not: invent 0.1 / −0.2 values from scratch for every asset.`}
            </pre>
          ),
        },
      ];

    case "dangling-charms":
      return [
        {
          heading: "Dangling vs Drop vs Fixed",
          body: (
            <>
              <p>
                These Charm sub-types are catalogue data (keep their slugs). Both{" "}
                <span className="font-medium text-foreground">Dangling</span> and{" "}
                <span className="font-medium text-foreground">Drop</span> use the same hang style
                (Layout mode → Dangling). The difference is height on the cord:
              </p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                <li>
                  <span className="font-medium text-foreground">Dangling (on cord)</span> — hanging
                  ring sits on the cord (higher hang).
                </li>
                <li>
                  <span className="font-medium text-foreground">Drop (lower hang)</span> — same hang
                  style, sits lower under the cord (teardrop / longer pendants).
                </li>
                <li>
                  <span className="font-medium text-foreground">Fixed (on strand)</span> — sits on the
                  strand; does not hang (inline / center).
                </li>
              </ul>
              <p className="mt-2">
                On the bead form, the hint under Sub-type restates this so uploaders pick the right
                family without opening Advanced appearance.
              </p>
            </>
          ),
        },
        {
          heading: "End-to-end dangling setup",
          body: (
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>
                Sub-type / type: <span className="font-medium text-foreground">Layout mode →
                Dangling</span>,{" "}
                <span className="font-medium text-foreground">Orientation → Outward</span>. Attach
                point follows automatically.
              </li>
              <li>
                Tune <span className="font-medium text-foreground">Vertical offset</span> until the
                hanging ring sits on the cord. Use Hang offset only for a fine radial nudge.
              </li>
              <li>
                Turn on <span className="font-medium text-foreground">Compare sizes</span> to preview
                mixed mm on one strand (single-SKU charms still get a 6 / 8 / 10 preview ladder).
              </li>
              <li>
                Switch Wrist to catalogue max (e.g. 20 cm) and confirm hang is fully visible.
              </li>
              <li>Save, then confirm the same wrist in the Bracelet Builder.</li>
            </ol>
          ),
        },
        {
          heading: "Varying sizes on one bracelet",
          body: (
            <>
              <p>
                Enable multiple mm offers on the bead (or use Compare sizes for a preview ladder).
                Width follows catalogue mm; dangling height can hang past the cord. Occupancy and
                render size stay independent — do not shrink occupancy just to make a charm look
                smaller.
              </p>
              <p className="mt-2">
                Fixed charms that should sit on the cord belong on an{" "}
                <span className="font-medium text-foreground">inline / center</span> baseline, not
                dangling / loop.
              </p>
            </>
          ),
        },
        {
          heading: "Clipping at large wrists",
          body: (
            <p>
              The ring fills more of the canvas at larger wrists. Camera Fit reframes so hanging
              shells stay inside the viewport. If something still clips after a wrist change, use
              Fit / Reset zoom in the preview, then re-check the Builder.
            </p>
          ),
        },
      ];

    case "frames":
      return [
        {
          heading: "Frame editor",
          body: (
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Add the frame SKU and upload plate / view assets.</li>
              <li>Crop the plate so lens regions align with the product photos.</li>
              <li>
                Define lens cutouts (smart detect or manual). Keep Left / Right / Details consistent
                across views.
              </li>
              <li>Use Reset carefully — draft geometry can differ from the last saved crop.</li>
              <li>Copy config between frames only when the plate family truly matches.</li>
            </ol>
          ),
        },
        {
          heading: "Performance tip",
          body: (
            <p>
              Heavy mask / clip payloads load with frame detail, not the list. Open a frame (or wait
              for hover prefetch) before expecting full editor data.
            </p>
          ),
        },
      ];

    case "sunglasses":
      return [
        {
          heading: "Sunglasses config",
          body: (
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <span className="font-medium text-foreground">Lens tints</span> — colours customers
                can apply in the builder.
              </li>
              <li>
                <span className="font-medium text-foreground">Builder options</span> — add-ons and
                accessories exposed in the sunglasses flow.
              </li>
            </ul>
          ),
        },
        {
          heading: "Lens glass look",
          body: (
            <p>
              Presets control replacement glass, tint layers, reflection, edge, and inner frame.
              Use the live preview on the preset page, then assign the preset where the product
              flow expects it. Prefer refining an existing preset over inventing one-off layer
              stacks per SKU.
            </p>
          ),
        },
      ];

    case "sizes-capacity":
      return [
        {
          heading: "Bead sizes",
          body: (
            <p>
              Catalogue mm diameters (e.g. 6, 8, 10). Enable offers per bead in the bead editor.
              Visual size scaling (system) softens jumps between those mm values; the 6 mm anchor
              stays stable.
            </p>
          ),
        },
        {
          heading: "Wrist sizes",
          body: (
            <p>
              Customer wrist targets drive bracelet circumference and how full the ring looks on
              canvas. Always spot-check assets at both ends of the active range (smallest and
              largest cm).
            </p>
          ),
        },
        {
          heading: "How We Prepare",
          body: (
            <p>
              Checkout preparation options (e.g. Ready to Wear / DIY). Separate from strand
              rendering — do not confuse these with bead calibration.
            </p>
          ),
        },
      ];

    case "settings":
      return [
        {
          heading: "General settings",
          body: (
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Site currency and builder copy defaults.</li>
              <li>
                <span className="font-medium text-foreground">Strand rendering defaults</span> —
                system baseline and visual size scaling.
              </li>
              <li>SMTP and email diagnostics for transactional mail.</li>
            </ul>
          ),
        },
        {
          heading: "Strand migration tools",
          body: (
            <p>
              Admin tools can initialize missing type defaults or clean redundant library overrides.
              They are designed to skip beads that already have a Custom Override. Prefer these
              over hand-editing JSON in the database.
            </p>
          ),
        },
        {
          heading: "Unsaved changes",
          body: (
            <p>
              Editors guard against accidental navigation when the form is dirty. Save or discard
              before switching sections if the leave dialog appears.
            </p>
          ),
        },
      ];
  }
}
