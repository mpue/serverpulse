import React from 'react';
import { useThemeStore } from '../../store/themeStore';

export default function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();

  const next = () => {
    const order: Array<'light' | 'dark' | 'system'> = ['dark', 'light', 'system'];
    const idx = order.indexOf(theme);
    setTheme(order[(idx + 1) % order.length]);
  };

  const icon = theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '💻';

  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={next}
      title={`Theme: ${theme}`}
      style={{ fontSize: '1rem', padding: '4px 8px' }}
    >
      {icon}
    </button>
  );
}
