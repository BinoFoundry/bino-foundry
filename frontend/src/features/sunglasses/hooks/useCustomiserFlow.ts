import { useCallback, useEffect, useMemo, useState } from "react";

import type { CustomiserStep } from "../constants";
import { CUSTOMISER_STEPS } from "../constants";

/**
 * Drive the five-step customiser.
 *
 * `hiddenSteps` drops steps that have nothing to show — the Add-Ons step is
 * empty whenever every builder option belongs to the Lens or RX step, and a
 * blank panel with only a Continue button reads as a broken flow. Hidden steps
 * disappear from the stepper and are stepped over by Continue / Back.
 */
export function useCustomiserFlow(
  initial: CustomiserStep = "frame",
  hiddenSteps: readonly CustomiserStep[] = [],
) {
  const [step, setStep] = useState<CustomiserStep>(initial);

  // Keyed by value, not identity: a caller that rebuilds the array inline on
  // every render would otherwise churn `steps` and every callback below it.
  const hiddenKey = [...hiddenSteps].sort().join("|");
  const steps = useMemo(
    () => CUSTOMISER_STEPS.filter((s) => !hiddenKey.split("|").includes(s.id)),
    [hiddenKey],
  );

  const stepIndex = steps.findIndex((s) => s.id === step);

  // A step can be hidden after it was already open (the catalogue loads late).
  useEffect(() => {
    if (stepIndex !== -1 || steps.length === 0) return;
    const fallbackIndex = CUSTOMISER_STEPS.findIndex((s) => s.id === step);
    const next =
      steps.find((s) => CUSTOMISER_STEPS.findIndex((c) => c.id === s.id) > fallbackIndex) ??
      steps[steps.length - 1];
    setStep(next.id);
  }, [stepIndex, steps, step]);

  const goNext = useCallback(() => {
    const next = steps[stepIndex + 1];
    if (next) setStep(next.id);
  }, [stepIndex, steps]);

  const goBack = useCallback(() => {
    const prev = steps[stepIndex - 1];
    if (prev) setStep(prev.id);
  }, [stepIndex, steps]);

  const goTo = useCallback((target: CustomiserStep) => setStep(target), []);

  return {
    step,
    stepIndex,
    steps,
    isFirst: stepIndex === 0,
    isLast: stepIndex === steps.length - 1,
    goNext,
    goBack,
    goTo,
  };
}
