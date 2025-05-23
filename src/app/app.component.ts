import { Component, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'OkDates';

  ngOnInit() {
    this.applyThemeBasedOnDomain();
  }

  private applyThemeBasedOnDomain(): void {
    const hostname = window.location.hostname;
    const themeClass = this.getThemeClass(hostname);
    
    // Remove any existing theme classes
    document.documentElement.classList.remove('okdates-theme', 'vanguard-theme');
    
    // Apply the appropriate theme class
    document.documentElement.classList.add(themeClass);
  }

  private getThemeClass(hostname: string): string {
    // For localhost testing: use URL parameter ?theme=vanguard
    const urlParams = new URLSearchParams(window.location.search);
    const themeParam = urlParams.get('theme');
    
    if (themeParam === 'vanguard') {
      return 'vanguard-theme';
    }
    
    if (hostname.includes('vanguardsignals.com')) {
      return 'vanguard-theme';
    }
    return 'okdates-theme';
  }
}