import React, { createContext, useContext, useMemo } from 'react';

export type ParkMode = 'national' | 'state';

// National Parks theme - Forest Green
const NATIONAL_THEME = {
  primary: '#22C55E',
  primaryLight: 'rgba(34, 197, 94, 0.15)',
  primaryMedium: 'rgba(34, 197, 94, 0.3)',
  primaryDark: '#166534',
  accent: '#22C55E',
  border: '#22C55E',
  text: '#22C55E',
  background: 'rgba(34, 197, 94, 0.1)',
  buttonBackground: 'rgba(22, 101, 52, 0.9)',
  buttonBackgroundLight: 'rgba(22, 101, 52, 0.4)',
  sliderTrack: '#22C55E',
  sliderThumb: '#22C55E',
  chipBackground: 'rgba(34, 197, 94, 0.15)',
  chipBorder: 'rgba(34, 197, 94, 0.3)',
  chipText: 'rgba(34, 197, 94, 0.9)',
  overlay: 'rgba(0, 40, 20, 0.75)',
  gradientStart: '#0a1a0f',
  gradientEnd: '#1a2e1a',
};

// State Parks theme - Park Sign Brown
const STATE_THEME = {
  primary: '#CD853F',
  primaryLight: 'rgba(139, 90, 43, 0.2)',
  primaryMedium: 'rgba(139, 90, 43, 0.4)',
  primaryDark: '#8B5A2B',
  accent: '#CD853F',
  border: '#8B5A2B',
  text: '#CD853F',
  background: 'rgba(139, 90, 43, 0.1)',
  buttonBackground: 'rgba(139, 90, 43, 0.9)',
  buttonBackgroundLight: 'rgba(139, 90, 43, 0.4)',
  sliderTrack: '#CD853F',
  sliderThumb: '#CD853F',
  chipBackground: 'rgba(205, 133, 63, 0.15)',
  chipBorder: 'rgba(205, 133, 63, 0.3)',
  chipText: 'rgba(205, 133, 63, 0.9)',
  overlay: 'rgba(40, 20, 0, 0.75)',
  gradientStart: '#1a0f05',
  gradientEnd: '#2e1a0a',
};

export type ParkTheme = typeof NATIONAL_THEME;

interface ParkThemeContextValue {
  mode: ParkMode;
  theme: ParkTheme;
  isStateMode: boolean;
  isNationalMode: boolean;
}

const ParkThemeContext = createContext<ParkThemeContextValue>({
  mode: 'national',
  theme: NATIONAL_THEME,
  isStateMode: false,
  isNationalMode: true,
});

export const useParkTheme = () => useContext(ParkThemeContext);

export const getThemeForMode = (mode: ParkMode): ParkTheme => {
  return mode === 'state' ? STATE_THEME : NATIONAL_THEME;
};

interface ParkThemeProviderProps {
  mode: ParkMode;
  children: React.ReactNode;
}

export const ParkThemeProvider: React.FC<ParkThemeProviderProps> = ({ mode, children }) => {
  const value = useMemo(() => ({
    mode,
    theme: getThemeForMode(mode),
    isStateMode: mode === 'state',
    isNationalMode: mode === 'national',
  }), [mode]);

  return React.createElement(
    ParkThemeContext.Provider,
    { value },
    children
  );
};

// Export themes for direct access
export { NATIONAL_THEME, STATE_THEME };
