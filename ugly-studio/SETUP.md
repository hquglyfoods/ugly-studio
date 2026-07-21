# Ugly Studio, setup

A branding workspace for Ugly Donuts. Set the Brand DNA once, keep every asset in the Library,
make new posters / store designs / packaging in the Studio (Claude directs, GPT renders), and the
app learns your taste over time. Installs as a mobile app.

Same stack as your other apps: single-file React + Babel 7, Supabase, Netlify. No em dashes anywhere.

## 1. Supabase
1. Create a new Supabase project.
2. SQL editor, run in order:
   - `supabase_schema.sql`     (brand DNA, library, creations, storage, RLS)
   - `supabase_learnings.sql`  (the taste memory)
   - `supabase_push.sql`       (push subscriptions)
3. Storage: confirm the `library` and `creations` buckets exist and are public.
4. Authentication: add one user, `hq@uglydonutsncorndogs.com`, with a password. That is the HQ login.
5. Project settings, API: copy the Project URL, the anon public key, and the service_role key.

## 2. index.html
Already wired to your project (no edits needed):
```
const SUPABASE_URL  = "https://kqnserohxtzpjolgvhrk.supabase.co";
const SUPABASE_ANON = "sb_publishable_6KTq8xbNOFzj1vSjYn-fWw_3MSqG0Yx";
```
The VAPID public key is already embedded too.

## 3. Netlify
Deploy this folder (drag the `ugly-studio` folder, or push to GitHub and connect), then set
Site settings, Environment variables:

Core AI
- `ANTHROPIC_API_KEY`   Claude: director, vision, chat
- `OPENAI_API_KEY`      GPT Image: rendering

Push notifications
- `SUPABASE_URL`         same project URL
- `SUPABASE_SERVICE_KEY` the service_role key (server only, never in the front end)
- `VAPID_PUBLIC_KEY`     see VAPID_PRIVATE_KEY.pem note below
- `VAPID_PRIVATE_KEY`    paste the full contents of VAPID_PRIVATE_KEY.pem
- `VAPID_SUBJECT`        mailto:hq@uglydonutsncorndogs.com (optional)

VAPID_PUBLIC_KEY value:
BO4lvbB4leneMHIHksK-DrXUt4-b0b6PzEwhbijDAeC30LLvEiLAz5CT49S0boNto0GpcgE6NuyzOcx3RqeGCr8

Redeploy so the functions pick up the keys. Do not ever change the VAPID keys once devices subscribe.

## The crew
- Claude = Brand Director. Concept, copy, art direction, studies Library uploads, answers in the Ask the studio chat.
- GPT Image = Designer. Renders the visual from the direction.
- Adding Gemini later is one more function plus a toggle. The pattern is in place.

## How the studio learns your taste
Every job runs through the Brand DNA plus everything the crew has learned. After any result in the
Studio, use Teach the crew to say what was off or what you loved. Claude files it under Learnings as a
dislike, an emphasis, or a repeat mistake. Say the same thing twice and its weight rises. At weight 3
it becomes a hard rule the crew treats as non-negotiable. The Learnings tab shows every rule with a
strength chart; mute or delete any of them.

## Mobile app
- Installs to the home screen (Add to Home Screen on iOS, Install on Android/desktop).
- Inputs are locked to 16px on mobile and the viewport is zoom-locked, so tapping a field never zooms.
- Boot splash, offline shell cache, safe-area padding, pull-to-refresh, and an error screen that offers a reload.
- Ask the studio: the floating button opens a chat with the Brand Director on any screen.
- Notifications: turn on from the rail, send a test to confirm delivery.

## Files
- `index.html` .............. the whole app
- `netlify/functions/` ...... ai-text, ai-image, ai-vision, push-notify, lib/push (all zero npm deps)
- `supabase_*.sql` .......... database, learnings, push (run in that order)
- `tools/validate.js` ....... run `node tools/validate.js` to re-check the build
- `icons/` .................. app icons and the wordmark (never rebuilt as text)
