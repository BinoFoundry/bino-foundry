import SunglassesCustomiser from "@/features/sunglasses/SunglassesCustomiser";

interface AdvancedSunglassesBuilderProps {
  onPriceChange: (price: number) => void;
}

/** Sunglasses customiser — Frame → Lens → RX → Extras → Review. */
const AdvancedSunglassesBuilder = ({ onPriceChange }: AdvancedSunglassesBuilderProps) => {
  return <SunglassesCustomiser onPriceChange={onPriceChange} />;
};

export default AdvancedSunglassesBuilder;
