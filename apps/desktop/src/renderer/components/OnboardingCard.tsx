import { useState } from "react";
import { ONBOARDING_STEPS } from "../shell/onboarding";
import { useFocusTrap } from "../shell/use-focus-trap";
import { cn } from "../lib/cn";
import { IconSparkles } from "./icons";

interface OnboardingCardProps {
  onDismiss: () => void;
}

export function OnboardingCard({ onDismiss }: OnboardingCardProps): React.ReactElement {
  const [step, setStep] = useState(0);
  const containerRef = useFocusTrap(true, onDismiss);
  const current = ONBOARDING_STEPS[step];
  const isLast = step === ONBOARDING_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" role="presentation">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="palette-anim w-full max-w-[440px] rounded-panel border border-harness/30 bg-surface-raised p-5 shadow-2xl shadow-black/60"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-panel bg-harness/15 text-harness-soft">
            <IconSparkles width={18} height={18} />
          </span>
          <div>
            <h2 id="onboarding-title" className="text-[13px] font-semibold text-zinc-100">
              Cómo funciona Pragma Harness OS
            </h2>
            <p className="text-[12px] text-zinc-500">3 pasos, 30 segundos</p>
          </div>
        </div>

        <div className="mt-4 rounded-control border border-hairline bg-surface p-3">
          <p className="text-[12px] font-semibold text-harness-soft">{current.title}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-zinc-300">{current.body}</p>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {ONBOARDING_STEPS.map((entry, index) => (
              <span
                key={entry.title}
                className={cn("h-1.5 rounded-full transition-all", index === step ? "w-4 bg-harness" : "w-1.5 bg-zinc-600")}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="ml-auto rounded-control px-2 py-1.5 text-[12px] text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Saltar
          </button>
          {isLast ? (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-control bg-harness px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-harness-strong"
            >
              Entendido
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep((value) => value + 1)}
              className="rounded-control bg-harness px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-harness-strong"
            >
              Siguiente
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
