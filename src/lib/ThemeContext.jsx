import React, { createContext, useContext, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [tema_cor, setTemaCor] = useState('azul');
  const [modo_exibicao, setModoExibicao] = useState('claro');
  const [loaded, setLoaded] = useState(false);

  // Load preferences from user data
  useEffect(() => {
    base44.auth.me().then(user => {
      if (user?.tema_cor) setTemaCor(user.tema_cor);
      if (user?.modo_exibicao) setModoExibicao(user.modo_exibicao);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  // Apply dark mode to document
  useEffect(() => {
    if (!loaded) return;
    const root = document.documentElement;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = modo_exibicao === 'escuro' || (modo_exibicao === 'automatico' && prefersDark);
    
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [modo_exibicao, loaded]);

  // Listen to system preference changes (for auto mode)
  useEffect(() => {
    if (modo_exibicao !== 'automatico') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
      document.documentElement.classList.toggle('dark', e.matches);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [modo_exibicao]);

  const savePreferences = async (newTema, newModo) => {
    const t = newTema ?? tema_cor;
    const m = newModo ?? modo_exibicao;
    setTemaCor(t);
    setModoExibicao(m);
    await base44.auth.updateMe({ tema_cor: t, modo_exibicao: m });
  };

  return (
    <ThemeContext.Provider value={{ tema_cor, modo_exibicao, savePreferences }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}