import { DollarSign } from "lucide-react";

interface LivePriceProps {
  price: number;
}

const LivePrice = ({ price }: LivePriceProps) => {
  return (
    <div
      className="glass-panel motion-safe-animate flex items-center gap-1.5 rounded-full px-3 py-1.5 sm:gap-2 sm:px-5 sm:py-2"
      aria-live="polite"
      aria-label={`Estimated total ${price.toFixed(2)}`}
    >
      <DollarSign className="h-3.5 w-3.5 text-highlight sm:h-4 sm:w-4" />
      <span className="type-price text-body sm:text-body-lg">
        {price.toFixed(2)}
      </span>
    </div>
  );
};

export default LivePrice;
