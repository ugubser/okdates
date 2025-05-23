# Domain-Based Stylesheet Implementation Report

## Current Architecture Analysis

The application currently uses:
- **Global styles**: `src/styles.scss` with CSS custom properties (`:root` variables)
- **Component styles**: Individual `.scss` files for each component
- **Angular Material**: Material Design components with theme overrides
- **Build configuration**: Single stylesheet configuration in `angular.json`

## Implementation Approaches

### 1. **Runtime Domain Detection with CSS Classes** ⭐ *Recommended*

**Approach**: Detect domain at runtime and apply different CSS classes to the body/root element.

**Implementation**:
```typescript
// In app.component.ts
export class AppComponent implements OnInit {
  ngOnInit() {
    const hostname = window.location.hostname;
    const themeClass = this.getThemeClass(hostname);
    document.body.classList.add(themeClass);
  }

  private getThemeClass(hostname: string): string {
    if (hostname.includes('vanguardsignals.com')) {
      return 'vanguard-theme';
    }
    return 'okdates-theme';
  }
}
```

**Styling structure**:
```scss
// styles.scss
:root {
  // Default OkDates theme
  &.okdates-theme {
    --primary-color: #3f51b5;
    --accent-color: #ff4081;
    // ... other variables
  }
  
  &.vanguard-theme {
    --primary-color: #2c3e50;
    --accent-color: #e74c3c;
    // ... completely different variables
  }
}
```

**Pros**: Simple, runtime-flexible, single build
**Cons**: All styles bundled together

### 2. **Build-Time Configuration with Angular Environments**

**Approach**: Create different build configurations for each domain with different stylesheets.

**Implementation**:
```json
// angular.json - add new configuration
"vanguard": {
  "fileReplacements": [
    {
      "replace": "src/styles.scss",
      "with": "src/styles-vanguard.scss"
    }
  ]
}
```

**Pros**: Smaller bundle size per domain, clear separation
**Cons**: Requires separate builds/deployments per domain

### 3. **Dynamic Stylesheet Loading**

**Approach**: Load different stylesheets based on domain detection.

**Implementation**:
```typescript
// In app.component.ts
ngOnInit() {
  const hostname = window.location.hostname;
  if (hostname.includes('vanguardsignals.com')) {
    this.loadStylesheet('/assets/themes/vanguard.css');
  }
}

private loadStylesheet(href: string) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}
```

**Pros**: Clean separation, on-demand loading
**Cons**: Flash of unstyled content (FOUC), more complex

## Recommended Implementation Plan

### Phase 1: CSS Custom Properties (Runtime Detection)
1. Refactor current styles to use more CSS custom properties
2. Create theme classes in `styles.scss`
3. Add domain detection logic to `app.component.ts`
4. Test with both domains

### Phase 2: Enhanced Theming (Optional)
1. Create theme service for centralized management
2. Add theme switching capability
3. Persist theme preferences

## File Structure Changes

```
src/
├── styles/
│   ├── themes/
│   │   ├── _okdates.scss
│   │   ├── _vanguard.scss
│   │   └── _mixins.scss
│   └── styles.scss (imports themes)
├── app/
│   └── core/
│       └── services/
│           └── theme.service.ts
```

## Benefits of This Approach

1. **Single codebase**: One build serves multiple domains
2. **Runtime flexibility**: Can switch themes without rebuilds
3. **Maintainable**: Centralized theme management
4. **Scalable**: Easy to add new domains/themes
5. **Performance**: No additional HTTP requests for stylesheets

This approach provides the best balance of flexibility, maintainability, and performance for your multi-domain requirement.

## Implementation Steps

### Step 1: Create Theme Structure
1. Create `src/styles/themes/` directory
2. Move theme variables to separate SCSS files
3. Update `styles.scss` to import themes

### Step 2: Add Domain Detection
1. Update `app.component.ts` with domain detection logic
2. Apply theme classes to document body
3. Test with localhost and production domains

### Step 3: Refactor Existing Styles
1. Convert hardcoded colors to CSS custom properties
2. Ensure all components use CSS variables
3. Test theme switching functionality

### Step 4: Create Vanguard Theme
1. Design color palette for Vanguard Signals
2. Implement theme variables in `_vanguard.scss`
3. Test complete styling differences

This implementation allows for easy maintenance while supporting multiple domain appearances with a single codebase.