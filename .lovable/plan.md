

## Plan: JADLOG Branding Color Overhaul

### Problem
The JADLOG tracking page still uses dark blue/navy backgrounds and purple accents from the JL theme. The JADLOG brand uses **red (#e10526)** and **light gray (#f1f5f9)** — no blue at all.

### Changes in `src/pages/Rastreio.tsx`

**1. Theme CSS variables (`.theme-jadlog` block, lines 168-187)**
- Update `--hero-bg` from dark navy gradient to **red gradient**: `linear-gradient(135deg, #c2021a 0%, #8b0000 100%)`
- Update `--timeline-header` and `--timeline-title` from `#991b1b` to `#e10526`

**2. Hero section background (line 716)**
- Currently hardcoded `background: #020617` — make it use `var(--hero-bg)` so JADLOG gets the red background

**3. Navigation bar for JADLOG**
- Make nav background lighter gray: `rgba(255,255,255,0.95)` (already close, just ensure it's very light)

**4. Package label card (line 870)**
- Currently hardcoded `background: #0f172a` (dark navy) — for JADLOG, change to **red** (`#c2021a` or `#e10526`)

**5. Search box on red background**
- Adjust search input wrapper border/background for contrast on red hero
- Text colors in hero (`hero-desc`, `q-val`, `q-lab`, `q-icon`) need to be visible on red

**6. Timeline icon colors (line 422)**
- Currently hardcoded `color="#005a96"` (blue) — use the `primaryColor` variable so JADLOG gets red icons

**7. Conditional inline styles**
- Use `isJadlog` to conditionally set `package-label-card` background, timeline icon color, and hero background via CSS variables or inline styles

### Files Modified
- `src/pages/Rastreio.tsx` — all changes in this single file (CSS variables + conditional styles)

### Summary of Color Mapping for JADLOG
- Dark blue backgrounds → **Red (#e10526 / #c2021a)**
- Purple accents → **Red (#e10526)**
- Blue text/icons → **Red (#e10526)**
- Nav/footer gray → **Lighter gray (#f8fafc)**
- White text stays white (visible on red)

