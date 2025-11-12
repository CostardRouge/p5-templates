# Accessibility Features

## Reduced Motion Support

The application respects the `prefers-reduced-motion` accessibility setting, which users can enable in their operating system settings.

### How It Works

When a user has reduced motion enabled, the application automatically:

1. **Disables all animations** - Keyframe animations are set to minimal duration
2. **Removes transitions** - CSS transitions are reduced to near-instant
3. **Prevents transforms** - Scale, rotate, and translate effects are disabled
4. **Maintains functionality** - All interactive features continue to work
5. **Keeps essential feedback** - Important visual states (like recording indicator) remain visible

### Implementation

The reduced motion support is implemented in `src/app/globals.css`:

```css
@media (prefers-reduced-motion: reduce) {
    /* Global animation/transition disable */
    *,
    *::before,
    *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
    }

    /* Specific animation disables */
    .animate-pulse,
    .animate-pulse-soft {
        animation: none !important;
    }

    /* Transform disables */
    .group:hover *[class*="group-hover:scale"],
    *[class*="hover:scale"],
    *[class*="hover:rotate"],
    *[class*="hover:-translate"] {
        transform: none !important;
    }
}
```

### Testing Reduced Motion

#### macOS
1. Open System Settings
2. Go to Accessibility → Display
3. Enable "Reduce motion"

#### Windows
1. Open Settings
2. Go to Accessibility → Visual effects
3. Turn off "Animation effects"

#### Linux (GNOME)
```bash
gsettings set org.gnome.desktop.interface enable-animations false
```

#### Browser DevTools
Most modern browsers allow you to emulate reduced motion:

**Chrome/Edge:**
1. Open DevTools (F12)
2. Press Cmd/Ctrl + Shift + P
3. Type "Show Rendering"
4. Check "Emulate CSS media feature prefers-reduced-motion"

**Firefox:**
1. Open DevTools (F12)
2. Go to Settings (gear icon)
3. Under "Advanced settings", check "Enable accessibility features"
4. In the Inspector, use the media query toggle

### What Gets Disabled

When reduced motion is active:

- ✅ Hover scale effects on cards and images
- ✅ Rotation animations on logo
- ✅ Slide-in transitions
- ✅ Fade animations
- ✅ Pulse effects
- ✅ Transform animations
- ✅ Smooth scrolling

### What Remains

Essential functionality that stays enabled:

- ✅ Color changes on hover (instant)
- ✅ Border highlights
- ✅ Recording indicator (static red border)
- ✅ All interactive features
- ✅ Layout changes
- ✅ Content updates

## Future Accessibility Improvements

Potential enhancements to consider:

- [ ] High contrast mode support
- [ ] Focus visible indicators
- [ ] Keyboard navigation improvements
- [ ] Screen reader optimizations
- [ ] Font size preferences
- [ ] Color blindness modes

## Resources

- [MDN: prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- [WCAG 2.1 Animation Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html)
- [A11y Project: Reduced Motion](https://www.a11yproject.com/posts/understanding-vestibular-disorders/)
