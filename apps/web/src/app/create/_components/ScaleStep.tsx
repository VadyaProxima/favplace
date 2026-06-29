"use client";

import { useAppStore } from "@/store/useAppStore";

const SCALE_OPTIONS = [
  { value: 100, label: "100 м", desc: "Один дом" },
  { value: 500, label: "500 м", desc: "Квартал" },
  { value: 2000, label: "2 км", desc: "Район" },
  { value: 5000, label: "5 км", desc: "Город" },
  { value: 10000, label: "10 км", desc: "Регион" },
];

export function ScaleStep() {
  const { radius, setRadius, setStep } = useAppStore();

  return (
    <div className="flex flex-1 flex-col items-center gap-8 px-6 py-10">
      <h2 className="text-3xl font-bold">Выберите масштаб</h2>
      <p className="text-zinc-400">Насколько детализированным будет рельеф</p>

      <div className="grid w-full max-w-lg gap-3">
        {SCALE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setRadius(opt.value)}
            className={`flex items-center justify-between rounded-lg border p-4 transition ${
              radius === opt.value
                ? "border-amber-500 bg-amber-500/10"
                : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"
            }`}
          >
            <div className="text-left">
              <div className="font-semibold">{opt.label}</div>
              <div className="text-sm text-zinc-400">{opt.desc}</div>
            </div>
            {radius === opt.value && (
              <div className="h-3 w-3 rounded-full bg-amber-500" />
            )}
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setStep("location")}
          className="rounded-lg border border-zinc-700 px-6 py-3 font-semibold text-zinc-300 transition hover:bg-zinc-800"
        >
          Назад
        </button>
        <button
          onClick={() => setStep("preview")}
          className="rounded-lg bg-amber-500 px-8 py-3 font-semibold text-zinc-950 transition hover:bg-amber-400"
        >
          Предпросмотр
        </button>
      </div>
    </div>
  );
}
