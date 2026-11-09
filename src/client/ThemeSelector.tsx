import {useEffect, useState} from 'react';

type Theme = 'system' | 'light' | 'dark' | 'paper';

function savedTheme(): Theme {
  try {
    const value = localStorage.getItem('fimbria-theme');
    if (value === 'light' || value === 'dark' || value === 'paper') return value;
  } catch {
    // Theme selection still works when browser storage is unavailable.
  }
  return 'system';
}

export function ThemeSelector() {
  const [theme, setTheme] = useState<Theme>(savedTheme);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
    };
    apply();
    try {
      localStorage.setItem('fimbria-theme', theme);
    } catch {
      // Persistence is optional in restricted browsers.
    }
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  return <div className="theme-selector">
    <label htmlFor="fimbria-theme">Theme</label>
    <select id="fimbria-theme" value={theme} onChange={event => setTheme(event.target.value as Theme)}>
      <option value="system">System</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
      <option value="paper">Paper</option>
    </select>
  </div>;
}
