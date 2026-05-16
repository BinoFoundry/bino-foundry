import { useCallback, useState } from "react";

import type { CustomiserStep } from "../constants";
import { CUSTOMISER_STEPS } from "../constants";

export function useCustomiserFlow(initial: CustomiserStep = "frame") {
  const [step, setStep] = useState<CustomiserStep>(initial);

  const stepIndex = CUSTOMISER_STEPS.findIndex((s) => s.id === step);

  const goNext = useCallback(() => {
    const next = CUSTOMISER_STEPS[stepIndex + 1];
    if (next) setStep(next.id);
  }, [stepIndex]);

  const goBack = useCallback(() => {
    const prev = CUSTOMISER_STEPS[stepIndex - 1];
    if (prev) setStep(prev.id);
  }, [stepIndex]);

  const goTo = useCallback((target: CustomiserStep) => setStep(target), []);

  return {
    step,
    stepIndex,
    steps: CUSTOMISER_STEPS,
    isFirst: stepIndex === 0,
    isLast: stepIndex === CUSTOMISER_STEPS.length - 1,
    goNext,
    goBack,
    goTo,
  };
}
