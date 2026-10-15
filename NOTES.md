# Field Record – rebuild notes

Rebuilt from https://journal-freestyle.grok.me/, which is a React/TanStack app built with Tailwind ("A private experiment log for meditation practice").

The screenshots of that app use a different theme. This rebuild keeps the paper look: serif type, background `#f3efe6`, surface `#fbf8f2`, ink `#1c1914`, muted `#6e675c`, line `#e2dacb`, accent `#2f5d45`, 1rem rounded cards.

## Structure
- `index.html`: the page shell. Home has the header ("Field journal" label, "Name this day" input with placeholder "New Day", date, Look button), the categories grid, the calendar card and the Days card. A category screen replaces that view while a category is open.
- `styles.css`: palette as CSS variables. Max width 64rem (the category screen is a 40rem column). Tap targets stay around 2.75rem.
- `app.js`: vanilla JS with no build step. State is saved to localStorage under `field-record-v2`: `{categories:[{id,name,tags}], entries:[{id,categoryId,date,title,note,tags,createdAt}], dayTitles:{'YYYY-MM-DD': title}}`.
  - `tags` on a category are the watched words. `tags` on an entry are the words chosen for that entry. Older records that omit `tags` are treated as `[]` and stay on the same key.
  - Earlier / Later move the selected day by ±1 and Today jumps back to today. The chevrons change the month shown.
  - Clicking the month/year heading opens a picker: Jan–Dec, plus year arrows and a year field. Choosing a month jumps the calendar there. Calendar days with content are outlined, the selected day is filled with the accent colour, and today is underlined.
  - A category card opens a screen with Back (top-left), the selected date (top-right), the category name, a Title / Note form, the watched tags, and Save entry. That day's entries for the category sit below as cards (title, date, note, tags). Clicking a card, or Edit, loads it into the form; Delete removes it.
  - Tags: "New word, kept in this category", Add tag, and Edit. A chip click toggles that word onto the entry being written. Edit turns the button into Done, shows an × on each chip, and a click on the chip text renames it inline. Renaming or deleting a watched tag updates entries in that category. Entry tags render as `Tag · Tag` in the accent colour.
  - The Days list shows named days and days with entries, newest first. Clicking a day expands it (click again to collapse) and lists every category: entry cards, or "Nothing written." Open day selects that day for the journal.

## Run
`python3 -m http.server 8080` from this folder, then open http://localhost:8080/

## Not rebuilt yet
- **Look/themes:** presets Plain, Earth, Marble, Neon, Retro, Sci-fi, Vine, Water, Wood, Green/Red wire; background/frame/ground options; font (serif/sans/mono); custom saved "looks" (`Name this look`).
- Categories that collapse or can be renamed.
- Export/import JSON, search, and a streak or summary view of the practice.
