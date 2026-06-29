"use client";

import { useAppStore } from "@/store/useAppStore";
import { MATERIALS } from "@favplace/shared";

export function SummaryStep() {
  const { location, radius, material, surfaceFinish, ringWidth, reliefHeight, engraving, elevationMeta, setStep } = useAppStore();

  return (
    <div className="flex flex-1 flex-col items-center gap-8 px-6 py-10">
      <div className="text-center">
        <h2 className="text-3xl font-bold">Ваше кольцо готово</h2>
        <p className="mt-2 text-zinc-400">♡ Это место навсегда останется с вами</p>
      </div>

      <div className="flex h-80 w-full max-w-xl items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900">
        <p className="text-zinc-500">3D превью кольца</p>
      </div>

      <div className="w-full max-w-lg space-y-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-3">
          <h3 className="font-semibold">Конфигурация</h3>

          {location && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Место</span>
              <span>{location.name}, {location.country}</span>
            </div>
          )}

          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Масштаб</span>
            <span>{radius >= 1000 ? `${radius / 1000} км` : `${radius} м`}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Материал</span>
            <span>{MATERIALS[material].label}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Поверхность</span>
            <span>{surfaceFinish === "polished" ? "Полированная" : "Матовая"}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Ширина</span>
            <span>{ringWidth} мм</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Высота рельефа</span>
            <span>{reliefHeight} мм</span>
          </div>

          {engraving && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Гравировка</span>
              <span className="text-amber-400">{engraving}</span>
            </div>
          )}

          {elevationMeta && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Диапазон высот</span>
              <span>{Math.round(elevationMeta.min)} — {Math.round(elevationMeta.max)} м</span>
            </div>
          )}

          {location && (
            <div className="font-mono text-xs text-zinc-500 pt-2 border-t border-zinc-800">
              {location.coordinates.lat.toFixed(6)}° N, {location.coordinates.lng.toFixed(6)}° E
            </div>
          )}
        </div>

        <button className="w-full rounded-lg bg-amber-500 py-4 text-lg font-bold text-zinc-950 transition hover:bg-amber-400">
          Оформить заказ
        </button>

        <button
          onClick={() => setStep("material")}
          className="w-full rounded-lg border border-zinc-700 py-3 font-semibold text-zinc-300 transition hover:bg-zinc-800"
        >
          Изменить конфигурацию
        </button>
      </div>
    </div>
  );
}
