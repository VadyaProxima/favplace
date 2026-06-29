"use client";

import { useAppStore, type Step } from "@/store/useAppStore";

const STEPS: { key: Step; label: string }[] = [
  { key: "location", label: "Место" },
  { key: "scale", label: "Масштаб" },
  { key: "preview", label: "Предпросмотр" },
  { key: "material", label: "Материал" },
  { key: "engraving", label: "Гравировка" },
  { key: "summary", label: "Итог" },
];

export function StepNavigator() {
  const { step, setStep } = useAppStore();
  const currentIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <nav className="border-b border-zinc-800 px-6 py-4">
      <div className="mx-auto flex max-w-3xl items-center justify-between">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            onClick={() => setStep(s.key)}
            className={`flex items-center gap-2 text-sm font-medium transition ${
              i === currentIndex
                ? "text-amber-500"
                : i < currentIndex
                  ? "text-zinc-400 hover:text-zinc-200"
                  : "text-zinc-600"
            }`}
          >
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${
                i === currentIndex
                  ? "bg-amber-500 text-zinc-950"
                  : i < currentIndex
                    ? "bg-zinc-700 text-zinc-300"
                    : "bg-zinc-800 text-zinc-500"
              }`}
            >
              {i + 1}
            </span>
            <span className="hidden sm:inline">{s.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
