"use client";

import { useState, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import { Map } from "./Map";

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    country?: string;
  };
}

export function LocationStep() {
  const { location, setLocation, setStep } = useAppStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
      );
      const data = await res.json();
      setResults(data);
    } finally {
      setSearching(false);
    }
  }, [query]);

  const selectResult = (result: SearchResult) => {
    setLocation({
      id: crypto.randomUUID(),
      name: result.display_name.split(",")[0],
      country: result.address?.country ?? "",
      coordinates: { lat: parseFloat(result.lat), lng: parseFloat(result.lon) },
    });
    setResults([]);
    setQuery(result.display_name);
  };

  return (
    <div className="flex flex-1 flex-col items-center gap-6 px-6 py-10">
      <div className="w-full max-w-xl space-y-4">
        <h2 className="text-center text-3xl font-bold">Выберите место</h2>
        <p className="text-center text-zinc-400">
          Место, которое навсегда останется с вами
        </p>

        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Гора Фудзи, Москва, Байкал..."
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none"
          />
          <button
            onClick={search}
            disabled={searching}
            className="rounded-lg bg-amber-500 px-6 py-3 font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-50"
          >
            {searching ? "..." : "Найти"}
          </button>
        </div>

        {results.length > 0 && (
          <ul className="space-y-1 rounded-lg border border-zinc-800 bg-zinc-900">
            {results.map((r, i) => (
              <li key={i}>
                <button
                  onClick={() => selectResult(r)}
                  className="w-full px-4 py-3 text-left text-sm text-zinc-300 transition hover:bg-zinc-800"
                >
                  {r.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {location && (
        <div className="w-full max-w-xl space-y-4">
          <div className="h-80 overflow-hidden rounded-lg border border-zinc-800">
            <Map
              center={[location.coordinates.lng, location.coordinates.lat]}
              zoom={12}
            />
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm">
            <div className="text-zinc-400">
              {location.name}, {location.country}
            </div>
            <div className="mt-1 font-mono text-xs text-zinc-500">
              {location.coordinates.lat.toFixed(4)}°, {location.coordinates.lng.toFixed(4)}°
            </div>
          </div>

          <button
            onClick={() => setStep("scale")}
            className="w-full rounded-lg bg-amber-500 py-3 font-semibold text-zinc-950 transition hover:bg-amber-400"
          >
            Выбрать масштаб
          </button>
        </div>
      )}
    </div>
  );
}
