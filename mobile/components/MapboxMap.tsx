import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Platform } from 'react-native';
import Mapbox, { Camera, MapView, LocationPuck, RasterSource, RasterLayer } from '@rnmapbox/maps';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

// Configure Mapbox access token
Mapbox.setAccessToken('pk.eyJ1IjoibWFub2VsZ2lhbnNhbnRlIiwiYSI6ImNtYXVvMG1lMTBkcG4ya3B6anM5a2VoOW0ifQ.zN4Ra2gAVOJ8Hf1tuYfyQA');

interface MapboxMapProps {
  initialLocation?: { latitude: number; longitude: number };
  onLocationChange?: (location: { latitude: number; longitude: number }) => void;
  showUserLocation?: boolean;
  style?: any;
}

export default function MapboxMapComponent({
  initialLocation,
  onLocationChange,
  showUserLocation = true,
  style,
}: MapboxMapProps) {
  const { colors } = useTheme();
  const cameraRef = useRef<Camera>(null);
  const [mapStyle, setMapStyle] = useState<'satellite' | 'streets'>('satellite');

  const defaultCenter = initialLocation || { latitude: -12.9714, longitude: -38.5014 };

  const centerOnUser = () => {
    // This will center on user location
    cameraRef.current?.setCamera({
      centerCoordinate: [defaultCenter.longitude, defaultCenter.latitude],
      zoomLevel: 14,
      animationDuration: 1000,
    });
  };

  const styleUrl = mapStyle === 'satellite' 
    ? Mapbox.StyleURL.SatelliteStreet 
    : Mapbox.StyleURL.Street;

  return (
    <View style={[styles.container, style]}>
      <MapView
        style={styles.map}
        styleURL={styleUrl}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={true}
        compassViewPosition={3}
        scaleBarEnabled={false}
      >
        <Camera
          ref={cameraRef}
          zoomLevel={12}
          centerCoordinate={[defaultCenter.longitude, defaultCenter.latitude]}
          animationMode="flyTo"
          animationDuration={1000}
        />
        
        {showUserLocation && (
          <LocationPuck
            puckBearing="heading"
            puckBearingEnabled={true}
            pulsing={{ isEnabled: true, color: colors.primary }}
          />
        )}
      </MapView>

      {/* Map Style Toggle */}
      <View style={styles.mapStyleToggle}>
        <TouchableOpacity
          style={[
            styles.styleButton,
            mapStyle === 'satellite' && styles.styleButtonActive
          ]}
          onPress={() => setMapStyle('satellite')}
        >
          <Ionicons 
            name="globe" 
            size={18} 
            color={mapStyle === 'satellite' ? '#fff' : '#333'} 
          />
          <Text style={[
            styles.styleButtonText,
            { color: mapStyle === 'satellite' ? '#fff' : '#333' }
          ]}>Satélite</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.styleButton,
            mapStyle === 'streets' && styles.styleButtonActive
          ]}
          onPress={() => setMapStyle('streets')}
        >
          <Ionicons 
            name="map" 
            size={18} 
            color={mapStyle === 'streets' ? '#fff' : '#333'} 
          />
          <Text style={[
            styles.styleButtonText,
            { color: mapStyle === 'streets' ? '#fff' : '#333' }
          ]}>Mapa</Text>
        </TouchableOpacity>
      </View>

      {/* Location Button */}
      <TouchableOpacity 
        style={styles.locationButton}
        onPress={centerOnUser}
      >
        <Ionicons name="locate" size={24} color={colors.primary} />
      </TouchableOpacity>

      {/* NDVI Scale */}
      <View style={styles.ndviScale}>
        <Text style={styles.ndviTitle}>NDVI</Text>
        <View style={styles.ndviGradient}>
          <View style={[styles.ndviColor, { backgroundColor: '#d73027' }]} />
          <View style={[styles.ndviColor, { backgroundColor: '#fc8d59' }]} />
          <View style={[styles.ndviColor, { backgroundColor: '#fee08b' }]} />
          <View style={[styles.ndviColor, { backgroundColor: '#d9ef8b' }]} />
          <View style={[styles.ndviColor, { backgroundColor: '#91cf60' }]} />
          <View style={[styles.ndviColor, { backgroundColor: '#1a9850' }]} />
        </View>
        <View style={styles.ndviLabels}>
          <Text style={styles.ndviLabel}>0.0</Text>
          <Text style={styles.ndviLabel}>1.0</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  mapStyleToggle: {
    position: 'absolute',
    top: 100,
    right: 16,
    flexDirection: 'column',
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  styleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  styleButtonActive: {
    backgroundColor: '#16a34a',
  },
  styleButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  locationButton: {
    position: 'absolute',
    bottom: 180,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  ndviScale: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8,
    padding: 8,
  },
  ndviTitle: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  ndviGradient: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 2,
    overflow: 'hidden',
  },
  ndviColor: {
    flex: 1,
    height: 12,
  },
  ndviLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  ndviLabel: {
    color: '#fff',
    fontSize: 8,
  },
});
