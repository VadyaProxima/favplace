import { create } from "zustand";
import type { MaterialType, SurfaceFinish, Coordinates, Location } from "@favplace/shared";

export type Step = "location" | "scale" | "preview" | "material" | "engraving" | "summary";

interface AppState {
  step: Step;
  setStep: (step: Step) => void;

  location: Location | null;
  setLocation: (location: Location) => void;

  radius: number;
  setRadius: (radius: number) => void;

  material: MaterialType;
  setMaterial: (material: MaterialType) => void;

  surfaceFinish: SurfaceFinish;
  setSurfaceFinish: (finish: SurfaceFinish) => void;

  ringSize: number;
  setRingSize: (size: number) => void;

  ringWidth: number;
  setRingWidth: (width: number) => void;

  reliefHeight: number;
  setReliefHeight: (height: number) => void;

  engraving: string;
  setEngraving: (text: string) => void;

  heightMap: number[][] | null;
  setHeightMap: (data: number[][]) => void;

  elevationMeta: { min: number; max: number } | null;
  setElevationMeta: (meta: { min: number; max: number }) => void;
}

export const useAppStore = create<AppState>((set) => ({
  step: "location",
  setStep: (step) => set({ step }),

  location: null,
  setLocation: (location) => set({ location }),

  radius: 500,
  setRadius: (radius) => set({ radius }),

  material: "gold",
  setMaterial: (material) => set({ material }),

  surfaceFinish: "polished",
  setSurfaceFinish: (surfaceFinish) => set({ surfaceFinish }),

  ringSize: 17,
  setRingSize: (ringSize) => set({ ringSize }),

  ringWidth: 4,
  setRingWidth: (ringWidth) => set({ ringWidth }),

  reliefHeight: 1.5,
  setReliefHeight: (reliefHeight) => set({ reliefHeight }),

  engraving: "",
  setEngraving: (engraving) => set({ engraving }),

  heightMap: null,
  setHeightMap: (heightMap) => set({ heightMap }),

  elevationMeta: null,
  setElevationMeta: (elevationMeta) => set({ elevationMeta }),
}));
