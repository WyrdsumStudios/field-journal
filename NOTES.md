# Field Record – rebuild notes

Rebuilt from https://journal-freestyle.grok.me/, which is a React/TanStack app built with Tailwind ("A private experiment log for meditation practice").

The screenshots of that app use a different theme. This rebuild keeps the paper look: serif type, background `#f3efe6`, surface `#fbf8f2`, ink `#1c1914`, muted `#6e675c`, line `#e2dacb`, accent `#2f5d45`, 1rem rounded cards.

## Structure
- `index.html`: the page shell. Home has the header ("Field journal" label, "Name this day" input with placeholder "New Day", date, Look button), the categories grid, the calendar card and the Days card. A category screen replaces that view while a category is open. A lightbox sits over the page for entry images.
- `styles.css`: palette as CSS variables. Max width 64rem (the category screen is a 40rem column). Tap targets stay around 2.75rem.
- `app.js`: vanilla JS with no build step. Journal state is saved to localStorage under `field-record-v2`. Image bytes live in IndexedDB (`field-record-images`, object store `blobs`), referenced by id from entries, so a photo does not have to fit in localStorage.

### Record shape
`{categories:[{id,name,type,tags}], entries:[{id,categoryId,date,title,note,tags,images,createdAt,sleepStart,sleepEnd,dreams}], dayTitles:{'YYYY-MM-DD': title}}`

- Missing `type` becomes `notes`. Missing `tags` or `images` become `[]`. Older records stay on the same key; extra fields are ignored by anything that only knew title, note, and tags.
- `tags` on a category are the watched words (Quality, on a sleep category). `tags` on an entry are the words chosen for that entry.
- `images` is a list of ids. The blob is a JPEG or WebP downscaled so the long edge is at most about 1600px.
- Category `type` picks a form from the `TYPES` registry (`notes`, `sleep`). A new type is another entry in that registry: blank draft, read from an entry, write back, form fields, and card body.

### Behaviour
- Earlier / Later move the selected day by ±1 and Today jumps back to today. The chevrons change the month shown.
- Clicking the month/year heading opens a picker: Jan–Dec, plus year arrows and a year field. Choosing a month jumps the calendar there. Calendar days with content are outlined, the selected day is filled with the accent colour, and today is underlined.
- A new category asks for a name and a type, Notes or Sleep.
- A category card opens a screen with Back (top-left), the selected date (top-right), and the category name. That day's entries sit below the form as cards. Clicking a card, or Edit, loads it into the form; Delete removes it and its image blobs.
- Notes form: Title, Note, watched tags, Add images, Save entry.
- Sleep form: Title, Sleep time and Awake time (defaults to the prior night, 11:00 PM, through 7:00 AM on the selected day), a duration such as `7h 45m` (if the awake clock is earlier than the sleep clock, one midnight is assumed), Quality chips, Dreams, Add images, Save entry. Cards show the sleep–wake times, duration, dreams, and quality tags.
- Tags: "New word, kept in this category", Add tag, and Edit. Add tag stores the word on the category and attaches it to the entry being written. A chip click toggles that word. Edit turns the button into Done, shows an × on each chip, and a click on the chip text renames it inline. Renaming or deleting a watched tag updates entries in that category. Entry tags render as `Tag · Tag` in the accent colour.
- Add images accepts several `image/*` files. Thumbnails sit in the form with a remove ×, and on the card as a grid. A thumbnail opens a larger lightbox. If the browser cannot read or store a photo, the form says so and the rest of the entry is left as it was.
- The Days list shows named days and days with entries, newest first. Clicking a day expands it (click again to collapse) and lists every category: entry cards, or "Nothing written." Open day selects that day for the journal.

## Run
`python3 -m http.server 8080` from this folder, then open http://localhost:8080/

## Not rebuilt yet
- **Look/themes:** presets Plain, Earth, Marble, Neon, Retro, Sci-fi, Vine, Water, Wood, Green/Red wire; background/frame/ground options; font (serif/sans/mono); custom saved "looks" (`Name this look`).
- Changing a category's type after it is created, and categories that collapse or can be renamed.
- Export/import JSON, search, and a streak or summary view of the practice.
