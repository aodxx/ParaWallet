# Forest Fintech Prototype Decision

Approved by Owner: 24 August 2026

Prototype URL after GitHub Pages deployment: `https://aodxx.github.io/ParaWallet/prototype-forest-fintech.html`

## Purpose

This prototype validated visual hierarchy and one-handed outdoor use before the approved direction was applied to the production React screens. The prototype itself contains no API calls, authentication, financial mutation, or production data.

## Locked direction

- Earthy Harmony palette: olive `#606C38`, deep forest `#283618`, warm cream `#FEFAE0`, soil gold `#DDA15E`, and terracotta `#BC6C25`
- Tapper wallet and Owner-custody wallet remain visible as a left/right pair
- Tapper receives one dominant `สแกนใบเสร็จ` action followed by Sale, Settlement, and Export actions
- Owner receives pending review as the first decision, before general metrics
- Bottom Navigation uses four destinations: `ภาพรวม`, `รายการ`, `กระเป๋า`, and `เพิ่มเติม`; notifications remain a large header button with a numeric badge
- Header uses an asymmetric SVG `Curved Edge` with a high–low organic wave inspired by the approved reference, keeping identity and connection status inside a stable high-contrast area
- Bottom Navigation uses a full deep-forest background plus an `Animated Circle Dock`: the circle glides to the selected destination inside a cream cutout ring, the icon rises with a short spring response, and the label remains large and readable

## Bottom Navigation accessibility specification

| Element | Prototype value | Production minimum |
|---|---:|---:|
| Thai label | 14px / weight 800 | 14px / weight 700 |
| Navigation icon | 22px | 22px |
| Navigation bar | 78px plus safe area | 72px plus safe area |
| Per-item touch target | at least 62px high | 56×56px |
| Active indicator | 44×31px filled capsule | Text and shape, not color alone |
| Narrow 360px fallback | 13px label | Never below 13px |

## Motion behavior

- Dock travel: 360ms spring-style easing; it responds only after a deliberate navigation tap
- Selected icon: rises 15px with one short pop; it does not loop continuously
- Badge: one short scale response when its destination becomes active
- Tap feedback: the pressed destination scales to 93% briefly
- `prefers-reduced-motion` disables transitions and keyframe effects while preserving the selected circle, icon, label, and badge state

Motion is feedback, not decoration. It must never delay navigation, move financial values, or obscure a status label.

The font stack prioritizes Android's Thai system font, followed by `Leelawadee UI`, Tahoma, and system sans-serif. Production must allow Android font scaling without clipped or overlapping labels.

## Production implementation

Phase D12 applies these tokens and composition rules in `src/App.tsx` and `src/styles.css`. The production navigation keeps four large destinations and moves secondary destinations into an accessible `เพิ่มเติม` bottom sheet. Financial logic, backend release, and schema are unchanged.

The remaining gate is a real-phone acceptance pass at normal brightness and outdoors if possible. Confirm wallet meanings, first action, curved-header height, label readability, dock movement, badge visibility, thumb reach, and whether four navigation labels remain understandable.
