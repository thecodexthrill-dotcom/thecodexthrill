# Design System Requirements

## Brand and visual direction

Premium software engineering identity: black, white, metallic gold, and sophisticated neutral shades, with complete dark and light themes. Gold is an accent, not a substitute for readable text or status color. Avoid generic templates, excessive gradients, arbitrary spacing/colors, and decorative motion without purpose.

## Foundations

- Define semantic color, typography, spacing, radius, elevation, border, focus, and motion tokens before scaling page work.
- Components consume semantic tokens rather than hard-coded brand colors. Validate contrast in both themes and states.
- Establish a documented spacing scale and responsive breakpoint policy; component reviews check token use, keyboard behavior, both themes, narrow screens, and loading/empty/error/success states. Exact values are chosen during approved UI foundation work after brand review.
- Select readable typefaces and fluid, deliberate type scales; exact font choice is OPEN QUESTION pending licensing, performance, and brand review.
- Tailwind CSS is the styling foundation. Use shadcn/ui and Radix primitives selectively; Lucide icons provide consistent iconography. Review compatibility, accessibility, licensing, maintenance, and bundle cost before adding other component libraries.

## Components and interaction

Build reusable navigation, buttons, fields, cards, dialogs, menus, tables, status indicators, feedback, and form patterns. Include loading, empty, error, success, disabled, and permission-denied states. Use semantic HTML, labels, keyboard navigation, visible focus, sensible focus management, and touch-sized controls. Icons need accessible names when meaningful; decorative icons are hidden from assistive technology.

## Layout and motion

Mobile-first responsive layouts; test narrow screens, zoom, and long content. Navigation and dashboards should preserve clear hierarchy and avoid density overload. Motion should explain state or guide attention, remain brief, and respect `prefers-reduced-motion`; avoid essential information conveyed only by animation.

The PWA offline fallback uses the same semantic tokens and accessible system typography but remains a clear connectivity state, not a false success state. Push notifications must be concise and avoid exposing private customer or ticket details on lock screens.

## Quality targets

Aim for WCAG 2.2 AA pending confirmation of contractual target. Measure Core Web Vitals with an agreed field/lab method; product targets are LCP <= 2.5 s, INP <= 200 ms, CLS <= 0.1, not guarantees. Document component usage and accessible variants as the system is implemented. No visual components have been implemented in Phase 0.

## Open questions

Brand asset availability, font licensing, exact gold/neutral values, logo clear space, supported browsers, localization, and formal accessibility conformance ownership require review.
