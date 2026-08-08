import { create } from "zustand";
import type { MaterialType, SurfaceFinish, Coordinates, Location } from "@favplace/shared";

export type Step = "studio" | "form" | "material" | "engraving" | "summary";
export type ReliefDetail = "low" | "medium" | "high";
/**
 * classic = lion GLB signet, mountain = continuous plateau,
 * disc / plug = procedural cylinder inserts,
 * bar = rectangular insert spanning band width,
 * square / circle / oval = basic_ring.glb empty faces + relief
 */
export type RingForm =
  | "classic"
  | "mountain"
  | "disc"
  | "plug"
  | "bar"
  | "square"
  | "circle"
  | "oval";

interface AppState {
  step: Step;
  setStep: (step: Step) => void;

  ringForm: RingForm;
  setRingForm: (form: RingForm) => void;

  /** Two-tone mountain/disc: polished band + light terrain */
  mountainTwoTone: boolean;
  setMountainTwoTone: (v: boolean) => void;

  location: Location | null;
  setLocation: (location: Location) => void;
  setCoordinates: (lat: number, lng: number) => void;

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

  reliefDetail: ReliefDetail;
  setReliefDetail: (detail: ReliefDetail) => void;

  engraving: string;
  setEngraving: (text: string) => void;

  heightMap: number[][] | null;
  setHeightMap: (data: number[][]) => void;

  elevationMeta: { min: number; max: number } | null;
  setElevationMeta: (meta: { min: number; max: number }) => void;
}

export const useAppStore = create<AppState>((set) => ({
  step: "studio",
  setStep: (step) => set({ step }),

  ringForm: "mountain",
  setRingForm: (ringForm) => set({ ringForm }),

  mountainTwoTone: false,
  setMountainTwoTone: (mountainTwoTone) => set({ mountainTwoTone }),

  location: null,
  setLocation: (location) => set({ location }),
  setCoordinates: (lat, lng) =>
    set((s) => ({
      location: s.location
        ? { ...s.location, coordinates: { lat, lng } }
        : { id: crypto.randomUUID(), name: 'Выбранное место', country: '', coordinates: { lat, lng } },
    })),

  radius: 500,
  setRadius: (radius) => set({ radius }),

  material: "silver",
  setMaterial: (material) => set({ material }),

  surfaceFinish: "polished",
  setSurfaceFinish: (surfaceFinish) => set({ surfaceFinish }),

  ringSize: 17,
  setRingSize: (ringSize) => set({ ringSize }),

  ringWidth: 4,
  setRingWidth: (ringWidth) => set({ ringWidth }),

  reliefHeight: 2,
  setReliefHeight: (reliefHeight) => set({ reliefHeight }),

  reliefDetail: "high",
  setReliefDetail: (reliefDetail) => set({ reliefDetail }),

  engraving: "",
  setEngraving: (engraving) => set({ engraving }),

  heightMap: null,
  setHeightMap: (heightMap) => set({ heightMap }),

  elevationMeta: null,
  setElevationMeta: (elevationMeta) => set({ elevationMeta }),
}));

if (typeof window !== 'undefined') {
  ;(window as unknown as { __favplaceStore: typeof useAppStore }).__favplaceStore =
    useAppStore
}