# Forest Fintech Prototype Decision

Approved by Owner: 24 August 2026

Prototype URL after GitHub Pages deployment: `https://aodxx.github.io/ParaWallet/prototype-forest-fintech.html`

## Purpose

This prototype validates visual hierarchy and one-handed outdoor use before changing the production React screens. It contains no API calls, authentication, financial mutation, or production data.

## Locked direction

- Deep forest header and primary cards, warm cream background, leaf-green active states, amber pending work, and terracotta disputes
- Tapper wallet and Owner-custody wallet remain visible as a left/right pair
- Tapper receives one dominant `สแกนใบเสร็จ` action followed by Sale, Settlement, and Export actions
- Owner receives pending review as the first decision, before general metrics
- Bottom Navigation uses four destinations: `ภาพรวม`, `รายการ`, `กระเป๋า`, and `เพิ่มเติม`; notifications remain a large header button with a numeric badge

## Bottom Navigation accessibility specification

| Element | Prototype value | Production minimum |
|---|---:|---:|
| Thai label | 14px / weight 800 | 14px / weight 700 |
| Navigation icon | 22px | 22px |
| Navigation bar | 78px plus safe area | 72px plus safe area |
| Per-item touch target | at least 62px high | 56×56px |
| Active indicator | 44×31px filled capsule | Text and shape, not color alone |
| Narrow 360px fallback | 13px label | Never below 13px |

The font stack prioritizes Android's Thai system font, followed by `Leelawadee UI`, Tahoma, and system sans-serif. Production must allow Android font scaling without clipped or overlapping labels.

## Review gate before implementation

Review both roles on a real phone at normal brightness and outdoors if possible. Confirm wallet meanings, first action, label readability, badge visibility, thumb reach, and whether four navigation labels remain understandable. Only after approval should the visual tokens and composition be applied to `src/App.tsx` and `src/styles.css`.
