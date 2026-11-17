# ChitDrop

A polished shared-room chit picker. Creators sign in with an email magic link, create a room, and share its unique URL. Participants enter a name and pick one crumpled-paper chit. A successful pick is committed atomically in PostgreSQL and removed from the remaining pool.

## Stack
- Static HTML, CSS and JavaScript on GitHub Pages
- Supabase Auth for creator accounts (email magic link)
- Supabase Postgres RPCs for room management and atomic one-time picks
- Browser local storage for participant name/session continuity

## Supabase
Project: `ycxtyyayiwbwfqxqwqej` in Mumbai (`ap-south-1`). The public project URL and publishable key are configured in `config.js`. Never put a service-role or secret key in the static site.

The schema is applied to the live project. RLS is enabled; direct anonymous table reads are revoked. Participants use narrowly scoped RPCs. Chit bodies are returned only to the successful picker session. A conditional database update and a unique `(room_id, participant_session)` index enforce one pick per browser session under concurrent requests.

## GitHub Pages
1. In repository Settings → Pages, select **GitHub Actions** as the deployment source.
2. The included workflow deploys the repository root on every push to `main`.
3. In Supabase Authentication → URL Configuration, set Site URL to `https://balakamal.github.io/ChitDrop/` and add it to Redirect URLs.
4. Enable email magic-link sign-in. Configure production SMTP for reliable email delivery.

## Behaviour and limitations
- Each share token identifies an independent room.
- Refreshing the same browser preserves its participant name, session and own pick.
- Other participants' picks disappear on the next poll (4.2 seconds).
- Anonymous name-based participation enforces one pick per browser session, not one pick per human. Clearing browser storage or using another device creates another session.
- Creator management requires an email magic-link session.
- Picked chits are immutable; unopened chits can be edited or deleted. New chits can be added. Reset is an explicit owner action.
- Anyone with the share link can participate.

## Local preview
Run `python -m http.server 8080` from the repository root and open `http://localhost:8080`.
