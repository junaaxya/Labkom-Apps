"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icon (Leaflet CSS path issue in Next.js)
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface LocationPickerProps {
  latitude: number;
  longitude: number;
  radiusMeter: number;
  onLocationChange: (lat: number, lng: number) => void;
  onRadiusChange?: (radius: number) => void;
  className?: string;
}

function MapClickHandler({ onLocationChange }: { onLocationChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapCenterUpdater({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const prevRef = useRef({ lat, lng });

  useEffect(() => {
    if (prevRef.current.lat !== lat || prevRef.current.lng !== lng) {
      if (lat !== 0 || lng !== 0) {
        map.setView([lat, lng], map.getZoom());
      }
      prevRef.current = { lat, lng };
    }
  }, [lat, lng, map]);

  return null;
}

export function LocationPicker({
  latitude,
  longitude,
  radiusMeter,
  onLocationChange,
  className,
}: LocationPickerProps) {
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const hasValidPosition = latitude !== 0 || longitude !== 0;
  const center: [number, number] = hasValidPosition ? [latitude, longitude] : [-6.9, 107.6]; // Default Bandung
  const zoom = hasValidPosition ? 17 : 13;

  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError("Browser tidak mendukung geolocation.");
      return;
    }
    setGpsLoading(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onLocationChange(position.coords.latitude, position.coords.longitude);
        setGpsLoading(false);
      },
      (error) => {
        setGpsError(
          error.code === 1
            ? "Izin lokasi ditolak. Aktifkan GPS dan izinkan akses lokasi."
            : error.code === 2
              ? "Lokasi tidak tersedia."
              : "Timeout mendapatkan lokasi."
        );
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [onLocationChange]);

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-[#5a5a5a] uppercase">Pilih Lokasi di Peta</p>
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={gpsLoading}
          className="neo-btn min-h-[36px] px-3 py-1.5 text-xs bg-[#4b607f] text-white disabled:opacity-50"
        >
          {gpsLoading ? "Mencari..." : "📍 Lokasi Saya"}
        </button>
      </div>

      {gpsError && (
        <p className="text-xs text-red-600 font-semibold mb-2">{gpsError}</p>
      )}

      <div className="rounded-xl overflow-hidden neo-border" style={{ height: 280 }}>
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapClickHandler onLocationChange={onLocationChange} />
          <MapCenterUpdater lat={latitude} lng={longitude} />
          {hasValidPosition && (
            <>
              <Marker position={[latitude, longitude]} icon={defaultIcon} />
              <Circle
                center={[latitude, longitude]}
                radius={radiusMeter}
                pathOptions={{
                  color: "#4b607f",
                  fillColor: "#4b607f",
                  fillOpacity: 0.15,
                  weight: 2,
                }}
              />
            </>
          )}
        </MapContainer>
      </div>

      <p className="text-[10px] text-[#5a5a5a] mt-1.5">
        Klik peta untuk set titik, atau gunakan tombol &quot;Lokasi Saya&quot;. Lingkaran biru menunjukkan radius geofencing.
      </p>
    </div>
  );
}
