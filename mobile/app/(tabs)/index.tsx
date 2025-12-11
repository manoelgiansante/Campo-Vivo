import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Text, Platform, Dimensions, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useAppStore } from '@/store/appStore';
import { FontSize, FontWeight, Spacing } from '@/constants/theme';

// Import map only for native platforms
let MapView: any = null;
let PROVIDER_DEFAULT: any = null;
let UrlTile: any = null;

if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  PROVIDER_DEFAULT = Maps.PROVIDER_DEFAULT;
  UrlTile = Maps.UrlTile;
}

import type { Region } from 'react-native-maps';

const MAPBOX_TOKEN = 'pk.eyJ1IjoibWFub2VsZ2lhbnNhbnRlIiwiYSI6ImNtYXVvMG1lMTBkcG4ya3B6anM5a2VoOW0ifQ.zN4Ra2gAVOJ8Hf1tuYfyQA';

export default function MapScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { setCurrentLocation, currentLocation, lastKnownLocation, fields } = useAppStore();
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [mapStyle, setMapStyle] = useState<'satellite' | 'streets'>('satellite');
  const [isLocating, setIsLocating] = useState(false);
  const mapRef = useRef<MapView>(null);

  // Buscar localização ao iniciar
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
      
      if (status === 'granted') {
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          setCurrentLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        } catch (error) {
          console.log('Erro ao obter localização:', error);
          // Usa última localização conhecida se disponível
        }
      }
    })();
  }, []);

  // Centralizar no mapa quando a localização mudar
  useEffect(() => {
    if (currentLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 500);
    }
  }, []);

  const centerOnLocation = async () => {
    console.log('centerOnLocation chamado');
    console.log('locationPermission:', locationPermission);
    console.log('mapRef.current:', !!mapRef.current);
    
    if (!locationPermission) {
      // Tenta pedir permissão novamente
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permissão Necessária',
          'Permita o acesso à localização nas configurações do dispositivo.',
          [{ text: 'OK' }]
        );
        return;
      }
      setLocationPermission(true);
    }

    setIsLocating(true);
    try {
      console.log('Buscando localização...');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000,
        distanceInterval: 0,
      });
      
      console.log('Localização obtida:', location.coords);
      
      const newLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      
      setCurrentLocation(newLocation);
      
      // Salvar como última localização conhecida
      useAppStore.setState({ lastKnownLocation: newLocation });
      
      if (mapRef.current) {
        console.log('Animando mapa para:', newLocation);
        mapRef.current.animateToRegion({
          latitude: newLocation.latitude,
          longitude: newLocation.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }, 1500);
      } else {
        console.log('mapRef.current é null!');
      }
    } catch (error) {
      console.log('Erro ao obter localização:', error);
      Alert.alert('Erro', 'Não foi possível obter sua localização. Verifique se o GPS está ativado.');
    } finally {
      setIsLocating(false);
    }
  };

  // Usar última localização conhecida ou localização atual ou padrão
  const locationToUse = currentLocation || lastKnownLocation;
  
  const initialRegion: Region = locationToUse ? {
    latitude: locationToUse.latitude,
    longitude: locationToUse.longitude,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  } : {
    // Localização padrão (Brasil central)
    latitude: -15.7801,
    longitude: -47.9292,
    latitudeDelta: 5,
    longitudeDelta: 5,
  };

  // Mapbox tile URL for satellite imagery
  const satelliteUrl = `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.png?access_token=${MAPBOX_TOKEN}`;
  const streetsUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`;

  // Web fallback - show message that maps only work on native
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SafeAreaView style={styles.webFallback}>
          <Ionicons name="map-outline" size={64} color={colors.primary} />
          <Text style={[styles.webFallbackTitle, { color: colors.text }]}>
            Mapa disponível apenas no app
          </Text>
          <Text style={[styles.webFallbackText, { color: colors.textSecondary }]}>
            Para visualizar o mapa, baixe o app Campo Vivo no seu celular.
          </Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Map */}
      {MapView && (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={initialRegion}
          showsUserLocation={locationPermission === true}
          showsMyLocationButton={false}
          mapType="none"
        >
          {UrlTile && (
            <UrlTile
              urlTemplate={mapStyle === 'satellite' ? satelliteUrl : streetsUrl}
              maximumZ={19}
              flipY={false}
            />
          )}
        </MapView>
      )}

      {/* Header Overlay */}
      <SafeAreaView style={styles.headerOverlay} edges={['top']}>
        <View style={[styles.header, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View>
            <Text style={[styles.title, { color: '#fff' }]}>Campo Vivo</Text>
            <Text style={[styles.subtitle, { color: 'rgba(255,255,255,0.8)' }]}>
              {fields.length} campos cadastrados
            </Text>
          </View>
          <Button
            title=""
            variant="ghost"
            onPress={() => router.push('/fields/new')}
            icon={<Ionicons name="add-circle" size={28} color="#fff" />}
          />
        </View>
      </SafeAreaView>

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
            size={20} 
            color={mapStyle === 'satellite' ? '#fff' : colors.text} 
          />
          <Text style={[
            styles.styleButtonText,
            { color: mapStyle === 'satellite' ? '#fff' : colors.text }
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
            size={20} 
            color={mapStyle === 'streets' ? '#fff' : colors.text} 
          />
          <Text style={[
            styles.styleButtonText,
            { color: mapStyle === 'streets' ? '#fff' : colors.text }
          ]}>Mapa</Text>
        </TouchableOpacity>
      </View>

      {/* Location Button */}
      <TouchableOpacity 
        style={[
          styles.locationButton, 
          { backgroundColor: isLocating ? colors.primary : colors.surface }
        ]}
        onPress={centerOnLocation}
        disabled={isLocating}
      >
        <Ionicons 
          name={isLocating ? "navigate" : "locate"} 
          size={24} 
          color={isLocating ? '#fff' : colors.primary} 
        />
      </TouchableOpacity>

      {/* FAB - New Field */}
      <TouchableOpacity 
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => router.push('/fields/new')}
      >
        <Ionicons name="add" size={24} color="#fff" />
        <Text style={styles.fabText}>Novo Campo</Text>
      </TouchableOpacity>

      {/* NDVI Scale */}
      <View style={[styles.ndviScale, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
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
          <Text style={styles.ndviLabel}>0</Text>
          <Text style={styles.ndviLabel}>1</Text>
        </View>
      </View>
    </View>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 0,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
  },
  subtitle: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  mapStyleToggle: {
    position: 'absolute',
    top: 120,
    right: Spacing.md,
    flexDirection: 'column',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
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
    backgroundColor: '#22c55e',
  },
  styleButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  locationButton: {
    position: 'absolute',
    bottom: 100,
    left: Spacing.md,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fab: {
    position: 'absolute',
    bottom: 100,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fabText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  ndviScale: {
    position: 'absolute',
    bottom: 100,
    left: '50%',
    marginLeft: -50,
    width: 100,
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  ndviTitle: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
  },
  ndviGradient: {
    flexDirection: 'row',
    height: 8,
    width: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
  ndviColor: {
    flex: 1,
  },
  ndviLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 2,
  },
  ndviLabel: {
    color: '#fff',
    fontSize: 8,
  },
  webFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  webFallbackTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  webFallbackText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 300,
  },
});
