export * from "./pricing";

import type { ReliefDetail, RingForm } from "./pricing";

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  sw: Coordinates;
  ne: Coordinates;
}

export interface Location {
  id: string;
  name: string;
  country: string;
  coordinates: Coordinates;
  elevation?: number;
  boundingBox?: BoundingBox;
}

export type MaterialType = "gold" | "silver" | "platinum";

export type SurfaceFinish = "polished" | "matte";

/** The constructor currently produces one silver, polished finish. */
export const RING_PRODUCTION_DEFAULTS = {
  material: "silver",
  surfaceFinish: "polished",
  twoTone: false,
} as const;

export interface RingConfig {
  size: number;
  width: number;
  thickness: number;
  material: MaterialType;
  surfaceFinish: SurfaceFinish;
  reliefHeight: number;
  areaRadius: number;
  areaOffset: Coordinates;
  engraving?: string;
}

export interface Project {
  id: string;
  userId: string;
  location: Location;
  ringConfig: RingConfig;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus = "draft" | "pending" | "processing" | "completed";

export interface Order {
  id: string;
  projectId: string;
  userId: string;
  status: OrderStatus;
  totalPrice: number;
  createdAt: string;
}

/** Снапшот конфигуратора, который уходит вместе с заявкой. */
export interface CheckoutConfig {
  ringForm: RingForm;
  material: MaterialType;
  surfaceFinish: SurfaceFinish;
  reliefDetail: ReliefDetail;
  reliefHeight: number;
  twoTone: boolean;
  ringSize: number;
  engraving: string;
  radius: number;
  location: {
    name: string;
    country: string;
    lat: number;
    lng: number;
  } | null;
  /** ссылка на конфигуратор с этими же параметрами */
  shareUrl?: string;
}

export interface CheckoutCustomer {
  name: string;
  phone: string;
  email: string;
  delivery: string;
  comment?: string;
  promo?: string;
}

export interface CheckoutRequest {
  config: CheckoutConfig;
  customer: CheckoutCustomer;
}

export interface CheckoutResponse {
  id: string;
  number: string;
  totalPrice: number;
  status: OrderStatus;
}

export interface TerrainGenerationParams {
  center: Coordinates;
  radius: number;
  resolution: number;
  ringWidth: number;
  reliefHeight: number;
}

export const DEFAULT_RING_CONFIG: RingConfig = {
  size: 17,
  width: 4,
  thickness: 2,
  material: RING_PRODUCTION_DEFAULTS.material,
  surfaceFinish: "polished",
  reliefHeight: 1.5,
  areaRadius: 500,
  areaOffset: { lat: 0, lng: 0 },
};

export const MATERIALS: Record<MaterialType, { label: string; color: string; metalness: number; roughness: number }> = {
  /** Pale warm metal — not saturated yellow */
  gold: { label: "Золото", color: "#E4DCCE", metalness: 1.0, roughness: 0.12 },
  silver: { label: "Серебро", color: "#DCDFE2", metalness: 1.0, roughness: 0.11 },
  platinum: { label: "Платина", color: "#E6E5E3", metalness: 1.0, roughness: 0.1 },
};
