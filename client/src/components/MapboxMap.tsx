import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// Set the Mapbox access token
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.eyJ1IjoibWFub2VsZ2lhbnNhbnRlIiwiYSI6ImNtYXVvMG1lMTBkcG4ya3B6anM5a2VoOW0ifQ.zN4Ra2gAVOJ8Hf1tuYfyQA';
mapboxgl.accessToken = MAPBOX_TOKEN;

export interface MapboxMapProps {
  className?: string;
  initialCenter?: [number, number]; // [lng, lat]
  initialZoom?: number;
  style?: "satellite" | "streets" | "outdoors" | "satellite-streets";
  onMapReady?: (map: mapboxgl.Map) => void;
  onClick?: (e: mapboxgl.MapMouseEvent) => void;
  interactive?: boolean;
}

export function MapboxMap({
  className = "",
  initialCenter = [-47.9292, -15.7801], // Brasília
  initialZoom = 4,
  style = "satellite",
  onMapReady,
  onClick,
  interactive = true,
}: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [loaded, setLoaded] = useState(false);

  const getStyleUrl = (styleName: string) => {
    switch (styleName) {
      case "satellite":
        return "mapbox://styles/mapbox/satellite-v9";
      case "satellite-streets":
        return "mapbox://styles/mapbox/satellite-streets-v12";
      case "streets":
        return "mapbox://styles/mapbox/streets-v12";
      case "outdoors":
        return "mapbox://styles/mapbox/outdoors-v12";
      default:
        return "mapbox://styles/mapbox/satellite-v9";
    }
  };

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: getStyleUrl(style),
      center: initialCenter,
      zoom: initialZoom,
      interactive,
      attributionControl: true,
      logoPosition: "bottom-left",
    });

    map.current.on("load", () => {
      setLoaded(true);
      if (onMapReady && map.current) {
        onMapReady(map.current);
      }
    });

    if (onClick) {
      map.current.on("click", onClick);
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update style when prop changes
  useEffect(() => {
    if (map.current && loaded) {
      map.current.setStyle(getStyleUrl(style));
    }
  }, [style, loaded]);

  return (
    <div ref={mapContainer} className={`w-full h-full ${className}`} />
  );
}

// Hook to use Mapbox map instance
export function useMapbox() {
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const setMap = (map: mapboxgl.Map) => {
    mapRef.current = map;
  };

  const getMap = () => mapRef.current;

  const flyTo = (center: [number, number], zoom?: number) => {
    if (mapRef.current) {
      mapRef.current.flyTo({
        center,
        zoom: zoom || mapRef.current.getZoom(),
        duration: 1500,
      });
    }
  };

  const addMarker = (lngLat: [number, number], options?: mapboxgl.MarkerOptions) => {
    if (mapRef.current) {
      return new mapboxgl.Marker(options)
        .setLngLat(lngLat)
        .addTo(mapRef.current);
    }
    return null;
  };

  const addPolygon = (
    id: string,
    coordinates: [number, number][][],
    fillColor = "#22C55E",
    fillOpacity = 0.4,
    lineColor = "#FFFFFF",
    lineWidth = 2
  ) => {
    if (!mapRef.current) return;

    // Remove existing layer/source if exists
    if (mapRef.current.getLayer(id)) {
      mapRef.current.removeLayer(id);
    }
    if (mapRef.current.getLayer(`${id}-outline`)) {
      mapRef.current.removeLayer(`${id}-outline`);
    }
    if (mapRef.current.getSource(id)) {
      mapRef.current.removeSource(id);
    }

    // Add source
    mapRef.current.addSource(id, {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates,
        },
      },
    });

    // Add fill layer
    mapRef.current.addLayer({
      id,
      type: "fill",
      source: id,
      paint: {
        "fill-color": fillColor,
        "fill-opacity": fillOpacity,
      },
    });

    // Add outline layer
    mapRef.current.addLayer({
      id: `${id}-outline`,
      type: "line",
      source: id,
      paint: {
        "line-color": lineColor,
        "line-width": lineWidth,
      },
    });
  };

  const removePolygon = (id: string) => {
    if (!mapRef.current) return;

    if (mapRef.current.getLayer(id)) {
      mapRef.current.removeLayer(id);
    }
    if (mapRef.current.getLayer(`${id}-outline`)) {
      mapRef.current.removeLayer(`${id}-outline`);
    }
    if (mapRef.current.getSource(id)) {
      mapRef.current.removeSource(id);
    }
  };

  const getUserLocation = (): Promise<[number, number]> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve([position.coords.longitude, position.coords.latitude]);
        },
        (error) => {
          reject(error);
        }
      );
    });
  };

  return {
    setMap,
    getMap,
    flyTo,
    addMarker,
    addPolygon,
    removePolygon,
    getUserLocation,
  };
}

export default MapboxMap;
