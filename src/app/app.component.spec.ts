import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { ThemeService } from './core/services/theme.service';
import { provideRouter } from '@angular/router';

// Mock ThemeService (accesses window.location in constructor)
const mockThemeService = {
  theme: { id: 'default', name: 'Default', cssClass: 'theme-default', hostnames: [] },
};

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: ThemeService, useValue: mockThemeService },
        provideRouter([]),
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have the 'OkDates' title`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('OkDates');
  });
});
