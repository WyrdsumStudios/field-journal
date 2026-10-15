# Field Record – rebuild notes

Rebuilt from https://journal-freestyle.grok.me/, which is a React/TanStack app built with Tailwind ("A private experiment log for meditation practice").

## Structure
- `index.html`: the page shell. It has the header ("Field journal" label, "Name this day" input with placeholder "New Day", date, Look button), the categories grid, the calendar card and the Days card.
- `styles.css`: the original's palette as CSS variables: bg #f3efe6, surface #fbf8f2, ink #1c1914, muted #6e675c, line #e2dacb, accent #2f5d45. Serif font, 1rem rounded cards, max width 64rem, 2.75rem tap targets.
- `app.js`: vanilla JS with no build step. State is saved to localStorage under `field-record-v2`, the same key the original uses: `{categories:[{id,name,tags}], entries:[{id,categoryId,date,title,note,tags,createdAt}], dayTitles:{'YYYY-MM-DD': title}}`.
  - Earlier / Later move the selected day by ±1 and Today jumps back to today. The chevrons change the month shown, and clicking the month label goes back to the selected day's month.
  - Calendar days with content are outlined, the selected day is filled with the accent colour, and today is underlined.
  - The Days list shows named days and days with entries, newest first. Clicking one selects that day.

## Run
`python3 -m http.server 8080` from this folder, then open http://localhost:8080/

## Future ideas (features the original's bundle has that aren't rebuilt yet)
- **Look/themes:** presets Plain, Earth, Marble, Neon, Retro, Sci-fi, Vine, Water, Wood, Green/Red wire; background/frame/ground options; font (serif/sans/mono); custom saved "looks" (`Name this look`).
- **Tags:** per-category watched words ("Tags you are watching", "New word, kept in this category", "Add tag"), and tag chips on entries.
- Editing entries (pencil/Edit), and categories that collapse or can be renamed.
- A month picker when you click the month label (the original has Jan…Dec labels).
- Export/import JSON, search, and a streak or summary view of the practice.
