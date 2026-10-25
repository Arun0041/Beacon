import { useEffect, useRef } from "react";
import L from "leaflet";

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  html: string;
  className?: string;
  size?: [number, number];
  popup?: string;
  onClick?: () => void;
};

export type MapCircle = {
  lat: number;
  lng: number;
  radiusM: number;
  color: string;
  fillOpacity?: number;
  label?: string;
};

type Props = {
  center: [number, number];
  zoom?: number;
  theme?: "light" | "dark";
  view?: { center: [number, number]; zoom?: number };
  markers?: MapMarker[];
  circles?: MapCircle[];
  myLoc?: { lat: number; lng: number; acc?: number } | null;
  onMapClick?: (lat: number, lng: number) => void;
  className?: string;
};

/* Key-free Esri canvas basemaps. Swap to MapLibre + PMTiles extracts for
 * the fully-offline milestone — see README. */
const TILES = {
  light: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attr:
      'Tiles &copy; Esri — Esri, DeLorme, NAVTEQ · Data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  dark: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attr:
      'Tiles &copy; Esri — Esri, DeLorme, NAVTEQ · Data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
};

export default function MapCanvas({
  center,
  zoom = 14,
  theme = "light",
  view,
  markers = [],
  circles = [],
  myLoc = null,
  onMapClick,
  className = "",
}: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const dataLayer = useRef<L.LayerGroup | null>(null);
  const meMarker = useRef<L.Marker | null>(null);
  const meCircle = useRef<L.Circle | null>(null);
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;

  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    const map = L.map(divRef.current, {
      center,
      zoom,
      zoomControl: true,
      attributionControl: true,
    });
    const tiles = TILES[theme];
    L.tileLayer(tiles.url, { attribution: tiles.attr, maxZoom: 19, maxNativeZoom: 16 }).addTo(map);
    dataLayer.current = L.layerGroup().addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => clickRef.current?.(e.latlng.lat, e.latlng.lng));
    mapRef.current = map;
    // invalidate after layout settles so tiles fill the container
    setTimeout(() => map.invalidateSize(), 50);
    return () => {
      map.remove();
      mapRef.current = null;
      dataLayer.current = null;
      meMarker.current = null;
      meCircle.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (view && mapRef.current) {
      mapRef.current.setView(view.center, view.zoom ?? mapRef.current.getZoom(), { animate: true });
    }
  }, [view]);

  useEffect(() => {
    const layer = dataLayer.current;
    if (!layer) return;
    layer.clearLayers();

    for (const c of circles) {
      L.circle([c.lat, c.lng], {
        radius: c.radiusM,
        color: c.color,
        weight: 1.5,
        fillColor: c.color,
        fillOpacity: c.fillOpacity ?? 0.1,
      }).addTo(layer);
      if (c.label) {
        L.marker([c.lat, c.lng], {
          icon: L.divIcon({
            className: "cl-wrap",
            html: `<div class="cl-label">${c.label}</div>`,
            iconSize: undefined,
          }),
          interactive: false,
        }).addTo(layer);
      }
    }

    for (const m of markers) {
      const mk = L.marker([m.lat, m.lng], {
        icon: L.divIcon({
          className: m.className ?? "mk-wrap",
          html: m.html,
          iconSize: m.size ?? [14, 14],
        }),
      });
      if (m.popup) mk.bindPopup(m.popup);
      if (m.onClick) mk.on("click", m.onClick);
      mk.addTo(layer);
    }
  }, [markers, circles]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !myLoc) return;
    const pos: L.LatLngExpression = [myLoc.lat, myLoc.lng];
    if (!meMarker.current) {
      meMarker.current = L.marker(pos, {
        icon: L.divIcon({ className: "mk-wrap", html: `<div class="mk-me"></div>`, iconSize: [16, 16] }),
        interactive: false,
        zIndexOffset: 500,
      }).addTo(map);
      meCircle.current = L.circle(pos, {
        radius: myLoc.acc ?? 0,
        color: "var(--color-info)",
        weight: 1,
        fillOpacity: 0.06,
        interactive: false,
      }).addTo(map);
    } else {
      meMarker.current.setLatLng(pos);
      meCircle.current?.setLatLng(pos);
      if (myLoc.acc) meCircle.current?.setRadius(myLoc.acc);
    }
  }, [myLoc]);

  return (
    <div
      ref={divRef}
      className={`relative z-0 h-full w-full ${theme === "dark" ? "map-dark" : "map-light"} ${className}`}
    />
  );
}
