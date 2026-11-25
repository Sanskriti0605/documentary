import { create } from 'zustand';
import { SystemHealth } from '../types';

interface AppState {
  health: SystemHealth | null;
  asOfDate: string;
  selectedDocumentId: string | null;
  darkMode: boolean;
  showHighlights: boolean;
  setHealth: (health: SystemHealth) => void;
  setAsOfDate: (date: string) => void;
  setSelectedDocumentId: (id: string | null) => void;
  toggleDarkMode: () => void;
  setShowHighlights: (show: boolean) => void;
  toggleHighlights: () => void;
}

const getInitialHighlights = (): boolean => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem('veritas_show_highlights');
      if (saved !== null) {
        return saved === 'true';
      }
    }
  } catch (e) {
    // Fallback for sandboxed or private browsing environments
  }
  return true; // Default ON
};

export const useAppStore = create<AppState>((set) => ({
  health: null,
  asOfDate: new Date().toISOString().split('T')[0],
  selectedDocumentId: null,
  darkMode: false,
  showHighlights: getInitialHighlights(),
  setHealth: (health) => set({ health }),
  setAsOfDate: (asOfDate) => set({ asOfDate }),
  setSelectedDocumentId: (selectedDocumentId) => set({ selectedDocumentId }),
  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
  setShowHighlights: (showHighlights) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('veritas_show_highlights', String(showHighlights));
      }
    } catch (e) {}
    set({ showHighlights });
  },
  toggleHighlights: () => {
    set((state) => {
      const next = !state.showHighlights;
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('veritas_show_highlights', String(next));
        }
      } catch (e) {}
      return { showHighlights: next };
    });
  },
}));
