import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Field {
  id: number;
  name: string;
  description?: string;
  areaHectares?: number;
  latitude?: string;
  longitude?: string;
  boundaries?: any;
  city?: string;
  state?: string;
  soilType?: string;
  irrigationType?: string;
  isActive?: boolean;
}

export interface FieldNote {
  id: number;
  fieldId: number;
  title?: string;
  content: string;
  noteType: string;
  severity?: string;
  isResolved?: boolean;
  createdAt: Date;
}

interface AppState {
  // User
  user: any | null;
  setUser: (user: any) => void;
  
  // Fields
  fields: Field[];
  setFields: (fields: Field[]) => void;
  selectedField: Field | null;
  setSelectedField: (field: Field | null) => void;
  
  // Notes
  notes: FieldNote[];
  setNotes: (notes: FieldNote[]) => void;
  
  // UI State
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  
  // Location - persisted
  currentLocation: { latitude: number; longitude: number } | null;
  setCurrentLocation: (location: { latitude: number; longitude: number } | null) => void;
  lastKnownLocation: { latitude: number; longitude: number } | null;
  setLastKnownLocation: (location: { latitude: number; longitude: number } | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // User
      user: null,
      setUser: (user) => set({ user }),
      
      // Fields
      fields: [],
      setFields: (fields) => set({ fields }),
      selectedField: null,
      setSelectedField: (field) => set({ selectedField: field }),
      
      // Notes
      notes: [],
      setNotes: (notes) => set({ notes }),
      
      // UI State
      isLoading: false,
      setIsLoading: (isLoading) => set({ isLoading }),
      
      // Location
      currentLocation: null,
      setCurrentLocation: (location) => set({ 
        currentLocation: location,
        // Salva também como última localização conhecida
        lastKnownLocation: location 
      }),
      lastKnownLocation: null,
      setLastKnownLocation: (location) => set({ lastKnownLocation: location }),
    }),
    {
      name: 'campovivo-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Apenas persistir esses campos
      partialize: (state) => ({
        lastKnownLocation: state.lastKnownLocation,
        fields: state.fields,
        user: state.user,
      }),
    }
  )
);
