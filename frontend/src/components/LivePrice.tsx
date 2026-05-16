import { DollarSign } from "lucide-react";

interface LivePriceProps {
  price: number;
}

const LivePrice = ({ price }: LivePriceProps) => {
  return (
    <div className="glass-panel rounded-full px-3 sm:px-5 py-1.5 sm:py-2 flex items-center gap-1.5 sm:gap-2 animate-fade-in">
      <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
      <span className="font-display text-sm sm:text-lg font-semibold text-foreground tracking-tight">
        {price.toFixed(2)}
      </span>
    </div>
  );
};

export default LivePrice;
