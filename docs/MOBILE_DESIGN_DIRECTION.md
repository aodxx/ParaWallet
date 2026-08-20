# ParaWallet Mobile Design Direction

## Design goal

Make the next action obvious for an Owner or Tapper standing outdoors with one hand available, intermittent connectivity, and limited time. The interface should feel like a field ledger rather than a desktop analytics dashboard.

## Information architecture

Use a compact top bar for identity and connection state, a garden switcher immediately below it, and a fixed bottom navigation with four destinations: `ภาพรวม`, `รายการ`, `กระเป๋า`, and `เพิ่มเติม`. Put creation actions in a prominent floating/inline action area rather than hiding them in a sidebar.

Owner priority order: review pending sales, see money still held by Tapper, confirm settlements, manage garden and members. Tapper priority order: scan receipt, record sale, see owner money held, send money, review own history.

## Visual system

Use the existing rubber-inspired palette but increase contrast and hierarchy: deep forest green for primary actions, warm leaf green for positive balance, amber for pending review, terracotta for disputes, and neutral cream surfaces. Use large numeric totals, short labels, compact supporting text, and status text plus icons so color is never the only signal.

## Mobile interaction rules

Use 16px page gutters, a minimum 44px touch target, full-width primary buttons, bottom sheets instead of centered desktop modals, sticky action bars for long forms, and horizontal scrolling only for secondary filters. Keep the first viewport focused on one decision. Avoid four equal dashboard cards stacked before the user reaches an action.

## Screen composition

The mobile dashboard begins with the selected garden, connection state, one primary balance card, one role-specific outstanding card, and a `งานที่ต้องทำ` section. The primary action is role-aware: `สแกนบิล` for Tapper and `ตรวจรายการรอ` for Owner. Secondary actions remain visible but visually quieter.

Lists use large two-line rows with amount/status on the right and a clear tap affordance. Detail screens use a step-like timeline: evidence, calculation, wallet impact, status, and actions. Forms group fields into short sections and keep the calculated split visible before submit.

## Responsive breakpoints

- 375–430px: single-column field layout, bottom navigation, full-width actions.
- 431–767px: single-column layout with two-column metric clusters only when values remain readable.
- 768–1023px: tablet split layout with persistent garden context and wider list rows.
- 1024px and above: desktop sidebar may return, but preserve the same task hierarchy and mobile action labels.

## Accessibility and reliability

Keep text readable in outdoor conditions, preserve focus states, use semantic buttons and labels, support reduced motion, and show explicit loading/empty/offline/error states. Never display fallback money values as if they came from Google Sheets.
