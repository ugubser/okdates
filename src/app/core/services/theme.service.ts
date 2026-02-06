import { Injectable } from '@angular/core';
import { THEMES, DEFAULT_THEME, ThemeConfig } from '../config/theme.config';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  theme: ThemeConfig;

  constructor() {
    this.theme = this.detectTheme();
    this.applyTheme();
  }

  private detectTheme(): ThemeConfig {
    const urlParams = new URLSearchParams(window.location.search);
    const themeParam = urlParams.get('theme');

    if (themeParam) {
      const match = THEMES.find(t => t.id === themeParam);
      if (match) return match;
    }

    const hostname = window.location.hostname;
    const match = THEMES.find(t =>
      t.hostnames.some(h => hostname.includes(h))
    );
    return match || DEFAULT_THEME;
  }

  private applyTheme(): void {
    const classList = document.documentElement.classList;
    THEMES.forEach(t => classList.remove(t.cssClass));
    classList.add(this.theme.cssClass);
  }
}
