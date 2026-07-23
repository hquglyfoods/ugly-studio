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
   - `supabase_brandbook.sql`  (brand book reading jobs)
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
- `VAPID_PRIVATE_KEY`    single-line key from VAPID_PRIVATE_KEY.txt (no newlines): BPgJMFS8TBBtVUe4JB6UL40v8OdUBoMuYe3mLdAzmMs
- `VAPID_SUBJECT`        mailto:hq@uglydonutsncorndogs.com (optional)

VAPID_PUBLIC_KEY value:
BO4lvbB4leneMHIHksK-DrXUt4-b0b6PzEwhbijDAeC30LLvEiLAz5CT49S0boNto0GpcgE6NuyzOcx3RqeGCr8

Redeploy so the functions pick up the keys. Do not ever change the VAPID keys once devices subscribe.

## The crew
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
- Notifications: turn on from the rail, send a test to confirm delivery.


## Two brands: Ugly and Umma
The studio runs both Ugly Donuts and Umma's Recipe. Switch with the toggle at the top of the left
rail. Each brand keeps its own Brand DNA, Library, Learnings, and creations, and the whole app
re-themes to that brand's palette. Umma starts from a sensible placeholder DNA, edit it and upload
the real logo in Brand DNA.

## Uploads
Library accepts images, PDFs, and HTML with no picker limit. On the way in the studio shrinks
images (down to 2000px JPEG) and renders a PDF's first page as a thumbnail, so storage stays light
while the original is kept. HTML is analyzed as text. Study any item to have Claude read it.
Note: very large original PDFs are still stored full size; if needed, raise the per-file limit in
Supabase (Storage settings).


## Reference images in the Studio
Under the brief there is a Reference images row. Add any images you want the director to consider
(a mood shot, a competitor piece, a photo of the product). Claude studies them for mood, composition
and styling and folds them into the concept and the image prompt, while staying in the brand voice.

## Brand book in Brand DNA
Brand DNA has a Brand book card. Upload the existing brand book (PDF or image). It is kept on record
per brand. Press Read and draft DNA and Claude reads the book and fills in the DNA fields (philosophy,
voice, palette, typography) for you to review and Save. Nothing is saved until you press Save.


## Library categories
Categories include poster, photo, logo, store design, interior, menu, packaging, signage, deck,
render and other. When uploading, leave the selector on Auto (guesses by file type: image is a
poster, PDF is a deck, HTML is other) or pick a category to apply to that upload. Every item also
has a category dropdown on its tile, so you can reclassify anything later, for example marking a
photo as store design or interior.


## Making images in the Studio
It is a two-step flow. Type your brief, then press Direct it. Claude writes the concept, copy and
art direction. A Render with GPT button then appears in the direction card. Press it to generate the
the Studio tab does.) Image generation needs OPENAI_API_KEY set in Netlify. It uses gpt-image-1 and
automatically falls back to dall-e-3 if your OpenAI org is not verified, so images still generate.

## Library auto-study, delete, category
Uploads are studied automatically now, no need to press Study with Claude (that button stays as a
manual re-run). Each tile shows Studying while it works. Every tile has Re-study and Delete, and a
category dropdown to reclassify at any time.


## Brand DNA holds a full brand book
Brand DNA is structured like a real style guide, not a summary: story layers (mission, the one feeling,
founder memory and words, heritage, cultural gesture, story order and positioning rules, brand pillars),
the complete color system (every color with hex, Pantone, what it is for and what it must never be used
for, plus color rules), the typography system (every typeface with role, weights and its key rule),
voice (tone, named traits, sound like and never sound like, and per-context examples), all official
lines and naming conventions, the logo system (marks, clear space, misuse rules), illustration,
photography direction with the full shoot spec, and signage. The crew reads all of it on every job.

## Brand DNA is your files, nothing else
The Brand DNA tab holds the files you upload and nothing invented. Upload the brand book, the menu
book, a signage spec, anything the studio should know by heart. PDF or HTML, several at once. Each
file is read word for word and used on every job, and tapping a file opens it. If no file has been
uploaded, the crew says so rather than guessing at rules. Anything you type into the optional notes
is carried too, marked as a note, so the files always outrank it.


## Library keeps your original files
Images are stored exactly as uploaded, at full resolution and in their original format. A small
preview copy is generated only to keep the grid fast, and tiles display every image at its own
aspect ratio, never cropped. Click through to the original at any time.

## Choosing size and shape in the Studio
Under the brief there is a Size and shape row: Square (1:1), Portrait (2:3) and Landscape (3:2).
Each task starts on a sensible default (posters portrait, storefronts landscape, social square) and
you can change it before directing. The director composes for the shape you picked.




## Viewing a document
View opens the document inside the studio. HTML brand books render as the real page rather than as
source code, PDFs open in the reader, and images display directly. There is also Open in new tab.
Files are stored with a correct content type even when the phone reports a blank one, which is what
made an HTML book appear as raw code before.


## Navigation
On a phone the studio uses a bottom tab bar (Brand DNA, Library, Studio, Learnings, More), sized for
thumbs and clear of the home indicator. More holds the account items: install, notifications, test
notification and sign out. On a desktop the left rail stays as it was. The brand toggle sits at the
top right on every screen, one tap to move between Ugly and Umma.


## Running heavier work
Image rendering runs in a background function and the app polls for the finished image, so a slow
render can never hit a request limit. Transient overload or rate limiting is retried automatically
with a backoff. Your documents live in their own table, so one upload writes one row and opening the
app stays light. The documents card shows how much of your memory budget is in use and marks any file
that does not fully fit, instead of quietly dropping it. Learnings are capped to the strongest rules
so they cannot crowd out the documents. A scanned book longer than 40 pages is read in several
passes. Routine jobs (studying a file, chat) run on a lighter model, while art direction and brand
book reading stay on the most accurate one.

## SQL to run
Run these in the Supabase SQL editor, in order. All are safe to re-run.
supabase_schema.sql, supabase_learnings.sql, supabase_push.sql, supabase_brandbook.sql, supabase_scale.sql


## Logos
A brand usually has several marks: a wordmark, a plain icon, character art, an avocado oil seal.
Upload as many as you like in Brand DNA, several at once. Tap a name to rename it so the crew can
refer to the right one, and pick which mark the app itself shows. The crew is told which marks exist
by name and is told never to describe one you do not have.

## Files
- `index.html` .............. the whole app
- `netlify/functions/` ...... ai-text, ai-image, ai-vision, push-notify, lib/push (all zero npm deps)
- `supabase_*.sql` .......... database, learnings, push (run in that order)
- `tools/validate.js` ....... run `node tools/validate.js` to re-check the build
- `icons/` .................. app icons and the wordmark (never rebuilt as text)
