import { create } from 'zustand';

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
  
  // Location
  currentLocation: { latitude: number; longitude: number } | null;
  setCurrentLocation: (location: { latitude: number; longitude: number } | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
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
  setCurrentLocation: (location) => set({ currentLocation: location }),
}));
