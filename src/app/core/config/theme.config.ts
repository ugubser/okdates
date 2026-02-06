export interface ThemeConfig {
  id: string;
  name: string;
  cssClass: string;
  logo: {
    type: 'text' | 'image';
    path?: string;
    alt: string;
    link: string;
  };
  hostnames: string[];
}

export const THEMES: ThemeConfig[] = [
  {
    id: 'okdates',
    name: 'OkDates',
    cssClass: 'okdates-theme',
    logo: { type: 'text', alt: 'OkDates', link: '/' },
    hostnames: ['okdates.web.app', 'okdates.firebaseapp.com', 'localhost'],
  },
  {
    id: 'vanguard',
    name: 'Vanguard Signals',
    cssClass: 'vanguard-theme',
    logo: {
      type: 'image',
      path: 'assets/logos/vanguard-signals.png',
      alt: 'Vanguard Signals',
      link: 'https://www.vanguardsignals.com',
    },
    hostnames: ['vanguardsignals.com'],
  },
];

export const DEFAULT_THEME = THEMES[0];
