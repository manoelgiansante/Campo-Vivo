import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, Platform, Dimensions } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useAppStore } from '@/store/appStore';
import { FontSize, FontWeight, Spacing } from '@/constants/theme';

// Placeholder map for web and when react-native-maps is not available
function PlaceholderMap() {
  const { colors } = useTheme();
  const { currentLocation } = useAppStore();

  return (
    <View style={[styles.mapPlaceholder, { backgroundColor: colors.surface }]}>
      <Ionicons name="map" size={64} color={colors.primary} />
      <Text style={[styles.mapPlaceholderText, { color: colors.text }]}>
        Mapa Campo Vivo
      </Text>
      {currentLocation && (
        <Text style={[styles.locationText, { color: colors.textSecondary }]}>
          📍 {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
        </Text>
      )}
    </View>
  );
}

export default function MapScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { setCurrentLocation, fields } = useAppStore();
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
      
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setCurrentLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    })();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.background }]}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Campo Vivo</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {fields.length} campos cadastrados
            </Text>
          </View>
          <Button
            title=""
            variant="ghost"
            onPress={() => router.push('/fields/new')}
            icon={<Ionicons name="add-circle" size={28} color={colors.primary} />}
          />
        </View>

        {/* Map Area */}
        <View style={styles.mapContainer}>
          <PlaceholderMap />
          
          {/* Floating Action Button */}
          <View style={styles.fabContainer}>
            <Button
              title="Novo Campo"
              onPress={() => router.push('/fields/new')}
              icon={<Ionicons name="add" size={20} color="#fff" />}
              style={styles.fab}
            />
          </View>

          {/* Location Button */}
          <View style={styles.locationButton}>
            <Button
              title=""
              variant="secondary"
              onPress={async () => {
                if (locationPermission) {
                  const location = await Location.getCurrentPositionAsync({});
                  setCurrentLocation({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                  });
                }
              }}
              icon={<Ionicons name="locate" size={24} color={colors.primary} />}
              style={{ width: 48, height: 48 }}
            />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
  },
  subtitle: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholderText: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    marginTop: Spacing.md,
  },
  locationText: {
    fontSize: FontSize.sm,
    marginTop: Spacing.sm,
  },
  fabContainer: {
    position: 'absolute',
    bottom: Spacing.lg,
    right: Spacing.md,
  },
  fab: {
    paddingHorizontal: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  locationButton: {
    position: 'absolute',
    bottom: Spacing.lg,
    left: Spacing.md,
  },
});
