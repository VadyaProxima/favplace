"use client";

import { useAppStore } from "@/store/useAppStore";

export function EngravingStep() {
  const { engraving, setEngraving, setStep } = useAppStore();

  return (
    <div className="flex flex-1 flex-col items-center gap-8 px-6 py-10">
      <h2 className="text-3xl font-bold">Гравировка</h2>
      <p className="text-zinc-400 text-center">
        Добавьте текст на внутреннюю сторону кольца
      </p>

      <div className="w-full max-w-md space-y-4">
        <input
          value={engraving}
          onChange={(e) => setEngraving(e.target.value.slice(0, 30))}
          placeholder="Например: 18.07.2024 ♡"
          maxLength={30}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-center text-lg text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none"
        />
        <div className="text-center text-xs text-zinc-500">
          {engraving.length}/30 символов
        </div>

        {engraving && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center">
            <div className="text-xs text-zinc-500 mb-2">Предпросмотр гравировки</div>
            <div className="font-serif text-xl tracking-widest text-amber-400">
              {engraving}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setStep("material")}
          className="rounded-lg border border-zinc-700 px-6 py-3 font-semibold text-zinc-300 transition hover:bg-zinc-800"
        >
          Назад
        </button>
        <button
          onClick={() => setStep("summary")}
          className="rounded-lg bg-amber-500 px-8 py-3 font-semibold text-zinc-950 transition hover:bg-amber-400"
        >
          Итог
        </button>
      </div>
    </div>
  );
}
