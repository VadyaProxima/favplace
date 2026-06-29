"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface MapProps {
  center: [number, number];
  zoom?: number;
  onMarkerMove?: (lng: number, lat: number) => void;
}

export function Map({ center, zoom = 12, onMarkerMove }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center,
      zoom,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    const marker = new maplibregl.Marker({ draggable: !!onMarkerMove })
      .setLngLat(center)
      .addTo(map);

    if (onMarkerMove) {
      marker.on("dragend", () => {
        const lngLat = marker.getLngLat();
        onMarkerMove(lngLat.lng, lngLat.lat);
      });
    }

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.flyTo({ center, zoom, duration: 1000 });
    }
    if (markerRef.current) {
      markerRef.current.setLngLat(center);
    }
  }, [center, zoom]);

  return <div ref={containerRef} className="h-full w-full" />;
}
