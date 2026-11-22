import { create } from 'zustand';
import { SystemHealth } from '../types';

interface AppState {
  health: SystemHealth | null;
  asOfDate: string;
  selectedDocumentId: string | null;
  darkMode: boolean;
  setHealth: (health: SystemHealth) => void;
  setAsOfDate: (date: string) => void;
  setSelectedDocumentId: (id: string | null) => void;
  toggleDarkMode: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  health: null,
  asOfDate: new Date().toISOString().split('T')[0],
  selectedDocumentId: null,
  darkMode: false,
  setHealth: (health) => set({ health }),
  setAsOfDate: (asOfDate) => set({ asOfDate }),
  setSelectedDocumentId: (selectedDocumentId) => set({ selectedDocumentId }),
  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
}));
