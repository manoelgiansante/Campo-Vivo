import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '@/lib/trpc';

// Simple fetch-based API hooks for when tRPC types aren't available
// This provides a fallback API layer

interface Field {
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

interface FieldNote {
  id: number;
  fieldId: number;
  title?: string;
  content: string;
  noteType: string;
  severity?: string;
  isResolved?: boolean;
  createdAt: string;
}

// Fields API
export function useFields() {
  return useQuery({
    queryKey: ['fields'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/trpc/fields.list`);
      const data = await res.json();
      return data.result?.data as Field[];
    },
  });
}

export function useField(id: number) {
  return useQuery({
    queryKey: ['field', id],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/trpc/fields.getById?input=${JSON.stringify({ id })}`);
      const data = await res.json();
      return data.result?.data as Field;
    },
    enabled: !!id,
  });
}

export function useCreateField() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (field: Omit<Field, 'id'>) => {
      const res = await fetch(`${API_URL}/api/trpc/fields.create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(field),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fields'] });
    },
  });
}

export function useUpdateField() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (field: Field) => {
      const res = await fetch(`${API_URL}/api/trpc/fields.update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(field),
      });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fields'] });
      queryClient.invalidateQueries({ queryKey: ['field', variables.id] });
    },
  });
}

export function useDeleteField() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_URL}/api/trpc/fields.delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fields'] });
    },
  });
}

// Notes API
export function useFieldNotes(fieldId?: number) {
  return useQuery({
    queryKey: ['notes', fieldId],
    queryFn: async () => {
      const url = fieldId 
        ? `${API_URL}/api/trpc/notes.listByField?input=${JSON.stringify({ fieldId })}`
        : `${API_URL}/api/trpc/notes.listAll`;
      const res = await fetch(url);
      const data = await res.json();
      return data.result?.data as FieldNote[];
    },
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (note: Omit<FieldNote, 'id' | 'createdAt'>) => {
      const res = await fetch(`${API_URL}/api/trpc/notes.create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(note),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}

// User API
export function useUser() {
  return useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/trpc/auth.me`);
      const data = await res.json();
      return data.result?.data;
    },
  });
}
