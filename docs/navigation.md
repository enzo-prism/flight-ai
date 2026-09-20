# Shared website navigation

## Information architecture

Every marketing page uses the same header and footer from `scripts/site_chrome.py`. The header offers a Product disclosure with an overview and direct feature shortcuts; Integrations and Customers link to the existing homepage sections; Updates leads to the release index. Contact sales and Get Started remain available at every screen size. Get Started leads to the authenticated `/app`; sample links explicitly lead to `/sample`. Footer labels describe their actual destinations; placeholders for nonexistent documentation, pricing, help, and security pages have been removed.

The real product at `/app` begins with account creation/sign-in, connector authorization, then Sales/Support selection. Its workspace has Priorities, Overview, and Connections, with server-persisted state and sign-out. It contains no seeded sample conversations. See [product-onboarding.md](product-onboarding.md).

The separate fictional sample at `/sample` has its own three-destination workspace shell: Priorities, Overview, and Connections. Support and Sales share components and routes. Its logo and website link return to Product without erasing local progress. No sign-in or onboarding is required. See [focused-preview.md](focused-preview.md) for deep links, mobile detail behavior, and state continuity.

## Rendering and maintenance

`python3 scripts/build-product-pages.py` emits complete product/release pages and replaces shared header/footer regions in index.html and sales.html. Keep editing those pages' main content directly. Header/footer copies are checked by the existing `--check` command so changes cannot silently diverge.

`navigation.css` is independent of the old marketing `.nav` styles and the application's workspace shell. `navigation.js` owns all shared behavior; homepage animation/media and release filtering stay in their separate scripts.

## Interaction behavior

- Product disclosure is native `<details>`/`<summary>`, with normal links and Tab order, not application-menu roles.
- Escape closes the product disclosure first, returning focus to its summary; a second Escape closes an open mobile menu and returns focus to its toggle.
- Outside click, keyboard focus leaving the header, and crossing the 900px breakpoint close transient menus.
- Mobile navigation has a viewport-bounded scroll area, retains the toggle above it, and never traps users in a modal focus loop.
- Same-page header shortcuts update the native fragment/history, close the menu, focus the destination, and scroll below the sticky header. Clean production paths and local `.html` paths are treated equivalently.
- Links remain ordinary anchors, so modified clicks, new tabs, browser history, and reduced-motion preferences work normally.
- The homepage highlights Integrations or Customers while that section is in view. Product/Updates/Sales current states are generated; release articles mark Updates as the current location rather than the current page.
- Without JavaScript, links and the Product disclosure remain available; mobile navigation is expanded and the inert mobile toggle stays hidden.

## Release navigation

Breadcrumbs connect Product → Updates → Release notes, alongside adjacent-release links. Search and category selections are encoded in `q` and `type` query parameters and restored after refresh or browser navigation. Optional session storage remembers the current filtered updates URL for the release breadcrumb. Stored URLs must be same-origin and point to `/updates` or `/updates.html`; absent/blocked storage falls back to the normal index link.

## Verification checklist

Check homepage, Product, Updates, Sales, and a nested release at desktop, 901/900px breakpoints, tablet, and 390/320px mobile widths. Exercise product disclosure, Escape/focus, same-page shortcuts, cross-page anchors, outside click, Tab exit, resize reset, compact landscape scrolling, and no-JavaScript navigation. Verify article → breadcrumb restores both search and category, and that a direct/shared query URL restores filters. Check the sample exit at narrow widths without clearing sample state. Verify Get Started reaches real authentication, sample links remain separate, connector callbacks return to setup, and browser history never bypasses authenticated API checks.
