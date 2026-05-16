import SunglassesCustomiser from "@/features/sunglasses/SunglassesCustomiser";

interface AdvancedSunglassesBuilderProps {
  onPriceChange: (price: number) => void;
}

/** Sunglasses customiser — Frame → Lens → Options → Final Preview (project brief flow). */
const AdvancedSunglassesBuilder = ({ onPriceChange }: AdvancedSunglassesBuilderProps) => {
  return <SunglassesCustomiser onPriceChange={onPriceChange} />;
};

export default AdvancedSunglassesBuilder;
