import { Coins } from "lucide-react";

import { useFormatCurrency } from "@/hooks/use-format-currency";

interface LivePriceProps {
  price: number;
}

const LivePrice = ({ price }: LivePriceProps) => {
  const { format } = useFormatCurrency();

  return (
    <div
      className="glass-panel motion-safe-animate flex items-center gap-1.5 rounded-full px-3 py-1.5 sm:gap-2 sm:px-5 sm:py-2"
      aria-live="polite"
      aria-label={`Estimated total ${format(price)}`}
    >
      <Coins className="h-3.5 w-3.5 text-highlight sm:h-4 sm:w-4" />
      <span className="type-price text-body sm:text-body-lg">{format(price)}</span>
    </div>
  );
};

export default LivePrice;
