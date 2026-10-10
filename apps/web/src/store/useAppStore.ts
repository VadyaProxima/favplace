import { create } from "zustand";
import type {
  Coordinates,
  Location,
  MaterialType,
  ReliefDetail,
  RingForm,
  SurfaceFinish,
} from "@favplace/shared";
import { RING_FORMS } from "@favplace/shared";
import {
  MAX_RELIEF_MM,
  MIN_RELIEF_MM,
  reliefMillimeters,
  type TerrainFrame,
  type TerrainGeoFrame,
} from "../lib/referenceSignetTerrain.ts";
import type {
  BandProfile,
  RingWeight,
  ShoulderStyle,
} from "../lib/referenceMountainSignet.ts";

export type { ReliefDetail, RingForm };
export type { BandProfile, RingWeight, ShoulderStyle };

/** Порядок шагов конструктора. Он же порядок в прогресс-баре. */
export const STEPS = [
  "place",
  "relief",
  "form",
  "material",
  "size",
  "order",
] as const;

export type Step = (typeof STEPS)[number];

export const STEP_LABELS: Record<Step, string> = {
  form: "форма",
  place: "место",
  relief: "рельеф",
  material: "металл",
  size: "размер",
  order: "заказ",
};

interface AppState {
  step: Step;
  setStep: (step: Step) => void;
  nextStep: () => void;
  prevStep: () => void;

  ringForm: RingForm;
  setRingForm: (form: RingForm) => void;

  /**
   * Карта сейчас движется. Пока true, показываем индикатор пересчёта —
   * сам рельеф догоняет прогрессивно, от грубого кадра к точному.
   */
  interacting: boolean;
  setInteracting: (v: boolean) => void;

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

  /** Высота рельефа в мм. Ведёт reliefScale и наоборот — это одна величина. */
  reliefHeight: number;
  setReliefHeight: (height: number) => void;

  /** Та же высота, нормированная в 0..1 — в этом виде её ждёт геометрия. */
  reliefScale: number;
  setReliefScale: (scale: number) => void;

  reliefDetail: ReliefDetail;
  setReliefDetail: (detail: ReliefDetail) => void;

  engraving: string;
  setEngraving: (text: string) => void;

  heightMap: number[][] | null;
  setHeightMap: (data: number[][]) => void;

  /** Более широкий DEM — им продолжают точный кроп по плечам кольца. */
  contextHeightMap: number[][] | null;
  setTerrainFrames: (fine: number[][], context: number[][] | null) => void;

  terrainFrame: TerrainFrame | null;
  coarseTerrainFrame: TerrainFrame | null;
  terrainViewFrame: TerrainGeoFrame | null;
  setTerrainViewFrame: (frame: TerrainGeoFrame) => void;
  setReferenceTerrainFrames: (
    fine: TerrainFrame,
    coarse: TerrainFrame | null,
    view?: TerrainGeoFrame,
  ) => void;

  /** Вторая местность формы «duo»: она ложится по краям площадки. */
  edgeLocation: Location | null;
  setEdgeLocation: (location: Location) => void;
  setEdgeCoordinates: (lat: number, lng: number) => void;
  edgeRadius: number;
  setEdgeRadius: (radius: number) => void;
  edgeTerrainFrame: TerrainFrame | null;
  edgeCoarseTerrainFrame: TerrainFrame | null;
  setEdgeTerrainFrames: (fine: TerrainFrame, coarse: TerrainFrame | null) => void;
  /** Доля полуширины площадки, занятая основной местностью. */
  edgeStart: number;
  setEdgeStart: (value: number) => void;

  ringWeight: RingWeight;
  setRingWeight: (weight: RingWeight) => void;

  bandProfile: BandProfile;
  setBandProfile: (profile: BandProfile) => void;

  shoulderStyle: ShoulderStyle;
  setShoulderStyle: (style: ShoulderStyle) => void;

  /** Поворот выбранного кропа рельефа, градусы по часовой. */
  terrainBearing: number;
  setTerrainBearing: (bearing: number) => void;

  elevationMeta: { min: number; max: number } | null;
  setElevationMeta: (meta: { min: number; max: number }) => void;
}

const stepIndex = (step: Step) => STEPS.indexOf(step);

const RELIEF_SPAN_MM = MAX_RELIEF_MM - MIN_RELIEF_MM;

/** Нормированная высота 0..1 из миллиметров — обратная reliefMillimeters. */
const reliefScaleFromMm = (millimetres: number) =>
  Math.min(1, Math.max(0, (millimetres - MIN_RELIEF_MM) / RELIEF_SPAN_MM));

/**
 * Рельеф по умолчанию. Прежде это была середина ползунка (2.34 мм по нынешней
 * шкале), но её постоянно хотелось поднять, поэтому берём на 50% больше —
 * 3.50 мм. Считаем от миллиметров, а не от позиции ползунка: «на 50% выше»
 * относится к металлу, а не к делению шкалы.
 */
const DEFAULT_RELIEF_SCALE = reliefScaleFromMm(reliefMillimeters(0.5) * 1.5);

export const useAppStore = create<AppState>((set) => ({
  step: "place",
  setStep: (step) => set({ step }),
  nextStep: () =>
    set((s) => ({ step: STEPS[Math.min(stepIndex(s.step) + 1, STEPS.length - 1)] })),
  prevStep: () => set((s) => ({ step: STEPS[Math.max(stepIndex(s.step) - 1, 0)] })),

  ringForm: "mountain",
  setRingForm: (ringForm) =>
    set({ ringForm: RING_FORMS.includes(ringForm) ? ringForm : "mountain" }),

  interacting: false,
  setInteracting: (interacting) => set({ interacting }),

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

  reliefHeight: reliefMillimeters(DEFAULT_RELIEF_SCALE),
  setReliefHeight: (reliefHeight) =>
    set({
      reliefHeight,
      reliefScale: reliefScaleFromMm(reliefHeight),
    }),

  reliefScale: DEFAULT_RELIEF_SCALE,
  setReliefScale: (reliefScale) => {
    const normalized = Math.min(1, Math.max(0, reliefScale));
    set({ reliefScale: normalized, reliefHeight: reliefMillimeters(normalized) });
  },

  reliefDetail: "high",
  setReliefDetail: (reliefDetail) => set({ reliefDetail }),

  engraving: "",
  setEngraving: (engraving) => set({ engraving }),

  heightMap: null,
  setHeightMap: (heightMap) => set({ heightMap }),

  contextHeightMap: null,
  setTerrainFrames: (heightMap, contextHeightMap) =>
    set({ heightMap, contextHeightMap }),

  edgeLocation: null,
  setEdgeLocation: (edgeLocation) => set({ edgeLocation }),
  /** Движение второй карты: меняем только координаты, имя и id сохраняем. */
  setEdgeCoordinates: (lat, lng) =>
    set((s) => ({
      edgeLocation: s.edgeLocation
        ? { ...s.edgeLocation, coordinates: { lat, lng } }
        : {
            id: crypto.randomUUID(),
            name: 'Вторая местность',
            country: '',
            coordinates: { lat, lng },
          },
    })),
  edgeRadius: 500,
  setEdgeRadius: (edgeRadius) => set({ edgeRadius }),
  edgeTerrainFrame: null,
  edgeCoarseTerrainFrame: null,
  setEdgeTerrainFrames: (edgeTerrainFrame, edgeCoarseTerrainFrame) =>
    set({ edgeTerrainFrame, edgeCoarseTerrainFrame }),
  edgeStart: 0.55,
  setEdgeStart: (edgeStart) =>
    set({ edgeStart: Math.min(0.95, Math.max(0.2, edgeStart)) }),

  terrainFrame: null,
  coarseTerrainFrame: null,
  terrainViewFrame: null,
  setTerrainViewFrame: (terrainViewFrame) => set({ terrainViewFrame }),
  setReferenceTerrainFrames: (terrainFrame, coarseTerrainFrame, terrainViewFrame) =>
    set({
      terrainFrame,
      coarseTerrainFrame,
      terrainViewFrame: terrainViewFrame ?? terrainFrame.frame,
      heightMap: terrainFrame.data,
      contextHeightMap: coarseTerrainFrame?.data ?? null,
      elevationMeta: {
        min: terrainFrame.minElev,
        max: terrainFrame.maxElev,
      },
    }),

  ringWeight: "classic",
  setRingWeight: (ringWeight) => set({ ringWeight }),

  bandProfile: "classic",
  setBandProfile: (bandProfile) => set({ bandProfile }),

  shoulderStyle: "classic",
  setShoulderStyle: (shoulderStyle) => set({ shoulderStyle }),

  terrainBearing: 0,
  setTerrainBearing: (terrainBearing) => set({ terrainBearing }),

  elevationMeta: null,
  setElevationMeta: (elevationMeta) => set({ elevationMeta }),
}));

export type { Coordinates };

if (typeof window !== 'undefined') {
  ;(window as unknown as { __favplaceStore: typeof useAppStore }).__favplaceStore =
    useAppStore
}
