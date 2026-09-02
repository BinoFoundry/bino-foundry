/**
 * The New Chapter storefront's announcement strip, repeated here so the builder
 * doesn't lose it when a customer crosses over from the shop.
 *
 * Values are taken from the storefront's `.announce` rule rather than this app's
 * tokens, so the two stay identical: #404225 on cream, 12.5px, .14em tracking.
 */
export function AnnouncementBar() {
  return (
    <div
      className="shrink-0 text-center font-medium uppercase"
      style={{
        background: "#404225",
        color: "#F7E6CA",
        fontSize: "12.5px",
        letterSpacing: "0.14em",
        padding: "9px 20px",
        // The storefront's .announce inherits `normal`; this app sets a line
        // height on body, which made the bar 5px taller and pushed the whole
        // header down relative to the storefront.
        lineHeight: "normal",
      }}
    >
      Limited stock · DM to order
    </div>
  );
}
