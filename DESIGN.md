# Edora — Design System

## Vision

**Tone:** Luxury-refined meets academic intelligence. Think premium study tool — not a toy, not a corporate dashboard. Edora should feel like the smartest, most beautiful notebook a student has ever used.

**Unforgettable element:** The deep black sidebar contrasting against the warm off-white main area — with indigo as the single accent that signals intelligence and focus.

**Audience:** Class 10 students (14–16 years old) — young enough to appreciate warmth and clarity, old enough to respond to something that feels premium and serious.

---

## Color System

```css
:root {
  /* Backgrounds */
  --sidebar-bg: #0f0f0f;
  --main-bg: #fafafa;
  --card-bg: #ffffff;
  --hover-bg: #f3f4f6;

  /* Accent */
  --accent: #6c63ff;
  --accent-soft: #ede9ff;
  --accent-hover: #5b52e0;

  /* Text */
  --text-primary: #0f0f0f;
  --text-muted: #6b7280;
  --text-subtle: #9ca3af;
  --sidebar-text: #e5e5e5;
  --sidebar-muted: #737373;

  /* Borders */
  --border: #e5e7eb;
  --border-subtle: #f3f4f6;

  /* States */
  --success: #10b981;
  --error: #ef4444;
  --warning: #f59e0b;

  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.08);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.12);
}

.dark {
  --main-bg: #141414;
  --card-bg: #1c1c1c;
  --hover-bg: #242424;
  --text-primary: #f5f5f5;
  --text-muted: #a3a3a3;
  --border: #2a2a2a;
  --border-subtle: #1f1f1f;
}
```

---

## Typography

```css
/* Display — headings, welcome screen */
font-family: 'Instrument Serif', serif;
/* Use for: h1, welcome greeting */

/* Body — everything else */
font-family: 'DM Sans', sans-serif;
/* Use for: paragraphs, labels, buttons, input */

/* Mono — code, math expressions */
font-family: 'JetBrains Mono', monospace;
```

### Type Scale

| Token        | Size    | Weight | Usage                    |
|--------------|---------|--------|--------------------------|
| `display`    | 2.5rem  | 500    | Welcome greeting         |
| `heading-1`  | 1.5rem  | 600    | Section headings         |
| `heading-2`  | 1.125rem| 600    | Card titles              |
| `body`       | 0.9375rem| 400   | Chat messages, paragraphs|
| `small`      | 0.8125rem| 400   | Timestamps, hints        |
| `label`      | 0.75rem | 500    | Buttons, badges          |

---

## Spacing System

Based on a 4px base unit.

```
4px   — xs  (tight gaps, icon padding)
8px   — sm  (inner padding, small gaps)
12px  — md  (standard gaps)
16px  — lg  (section padding)
24px  — xl  (card padding)
32px  — 2xl (section spacing)
48px  — 3xl (large section gaps)
```

---

## Layout

```
┌─────────────────────────────────────────────────────┐
│  Sidebar (240px fixed)  │  Main Area (flex-1)        │
│                         │                            │
│  [Logo]                 │  [Header — session name]   │
│  [New Chat btn]         │                            │
│  [Search]               │  [Chat / Welcome area]     │
│                         │                            │
│  Recent                 │                            │
│  - Session 1            │                            │
│  - Session 2            │                            │
│  - Session 3            │                            │
│                         │  [Input bar — pinned]      │
│  ─────────────────      │                            │
│  [Settings]             │                            │
│  [Help]                 │                            │
└─────────────────────────────────────────────────────┘
```

- Sidebar: `240px`, fixed, `var(--sidebar-bg)`
- Main: `flex-1`, scrollable, `var(--main-bg)`
- Input bar: `sticky bottom-0`, full width of main
- Total min-height: `100vh`

---

## Components

### Sidebar
- Background: `#0f0f0f`
- Logo: `Instrument Serif`, white, 18px
- New Chat: full-width button, accent background, rounded-lg
- Session items: hover shows subtle `#1a1a1a` background
- Bottom nav: Settings + Help icons, muted text

### Input Bar
- Background: `white` (light) / `#1c1c1c` (dark)
- Border: `1px solid var(--border)`, `border-radius: 16px`
- Shadow: `var(--shadow-md)` on focus
- Left: `+` icon for PDF upload
- Right: Send button with accent background
- Transitions: border-color, box-shadow on focus — 200ms ease

### Chat Messages
- No outer card borders — messages float freely
- User bubble: right-aligned, `var(--accent-soft)` bg, rounded-2xl
- Assistant: left-aligned, no background, just text
- Avatar: small 28px circle — indigo for Edora, initial for user
- Timestamp: `var(--text-subtle)`, `small` size, below message

### Welcome Screen
- Centered vertically and horizontally in main area
- Greeting: `display` size, `Instrument Serif`
- Subtitle: `body` size, `var(--text-muted)`
- Input: same component as chat input, centered, max-width 640px
- Quick cards: 3 cards in a row, `var(--card-bg)`, hover lifts with shadow

### Quick Start Cards
- Icon: 36px square, `var(--accent-soft)` bg, accent icon
- Title: `heading-2`
- Subtitle: `small`, muted
- Hover: `translateY(-2px)`, shadow increases — 200ms ease

### Quiz Cards
- Bordered, `var(--card-bg)`, rounded-xl
- Question: `heading-2`
- Options: 4 buttons, full width, outlined — turn green/red on answer
- Explanation: revealed after answer, muted text, indented

---

## Motion

- **Page load:** staggered fade-up for welcome screen elements (0ms, 100ms, 200ms delays)
- **Message appear:** fade-in + subtle slide-up (150ms ease-out)
- **Streaming text:** no animation — raw character append feels natural
- **Card hover:** `translateY(-2px)` + shadow — 200ms ease
- **Button press:** `scale(0.97)` — 100ms
- **Sidebar session hover:** background fade — 150ms

---

## Fonts — Google Fonts Import

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono&display=swap" rel="stylesheet">
```

---

## Don'ts

- No purple gradients on white backgrounds
- No generic card grids with equal borders everywhere
- No Inter or Roboto
- No rounded corners everywhere uniformly — vary intentionally
- No flat send buttons — always have subtle depth
- No emoji in UI chrome (only in content if student uses them)