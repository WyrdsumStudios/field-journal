# Field Record – rebuild notes

Rebuilt from https://journal-freestyle.grok.me/, which is a React/TanStack app built with Tailwind ("A private experiment log for meditation practice").

The screenshots of that app use a different theme. The default look is still paper: serif type, background `#f3efe6`, surface `#fbf8f2`, ink `#1c1914`, muted `#6e675c`, line `#e2dacb`, accent `#2f5d45`, 1rem rounded cards. Look swaps in Wood, Vine, 90s Retro, Earth, or Water, or a custom skin.

## Structure
- `index.html`: the page shell. Home has the header ("Field journal" label, "Name this day" input with placeholder "New Day", date, Look button), the categories grid, the calendar card and the Days card. A category screen replaces that view while a category is open. Look is only on the home header. A lightbox sits over the page for entry images.
- `styles.css`: palette as CSS variables. Max width 64rem (the category screen is a 40rem column). Tap targets stay around 2.75rem.
- `app.js`: vanilla JS with no build step. Journal state is saved to localStorage under `field-record-v2`. Image bytes, including an uploaded theme background, live in IndexedDB (`field-record-images`, object store `blobs`), referenced by id, so a photo does not have to fit in localStorage. A running stopwatch is a separate key, `field-record-watch`.

### Record shape
`{look, skin, themes, typing, categories:[{id,name,type,tags}], entries:[{id,categoryId,date,title,note,tags,images,createdAt,timerStart,timerEnd,durationMinutes,sleepStart,sleepEnd,dreams}], dayTitles:{'YYYY-MM-DD': title}}`

- Missing `type` becomes `notes`. Missing `tags` or `images` become `[]`. Missing or unknown `look` becomes `paper`. A `theme:` id that is not in `themes` becomes `paper` too. Older records stay on the same key; extra fields are left in place.
- `look` is `paper`, `wood`, `vine`, `retro`, `earth`, `water`, `custom`, or `theme:<id>`. A preset is applied with `data-look` and `skin` null. A custom skin sets `data-look="custom"` plus `data-border`, `data-font`, and inline colour variables.
- `skin` is `{scene, uploadId, border, font, page, card, ink, accent, line}` or null. `themes` is a list of `{id, name, skin}`.
- `typing` is `{enabled, voice, volume}`. It starts off. `voice` is `key`, `type`, or `pop`.
- `tags` on a category are the watched words. `tags` on an entry are the words chosen for that entry.
- `images` is a list of ids. The blob is a JPEG or WebP downscaled so the long edge is at most about 1600px. An uploaded background uses the same store, with an id prefixed `bg-`.
- Category `type` picks a form from the `TYPES` registry (`notes`, `timer`). A new type is another entry in that registry: blank draft, read from an entry, write back, form fields, and card body. An old `sleep` category is stored as `timer`. `sleepStart` / `sleepEnd` are copied to `timerStart` / `timerEnd` when those are empty, and a save mirrors the timer times back onto the sleep fields. `dreams` stays its own field.

### Behaviour
- Earlier / Later move the selected day by ±1 and Today jumps back to today. The chevrons change the month shown.
- Clicking the month/year heading opens a picker: Jan–Dec, plus year arrows and a year field. Choosing a month jumps the calendar there. Calendar days with content are outlined, the selected day is filled with the accent colour, and today is underlined.
- A new category asks for a name and a type, Notes or Timer.
- A category card lists that day's entries. Under each title, tags render as `Tag · Tag` in the accent colour. Opening the card shows Back (top-left) and the selected date (top-right). There is no Look button on that screen. That day's entries sit below the form as cards. Clicking a card, or Edit, loads it into the form; Delete removes it and its image blobs.
- Notes form: Title, Note, watched tags, Add images, Save entry.
- Timer form: Title, a stopwatch (Start, then Pause or Resume, and Stop & save), or a start and end time, or hours and minutes when the times are empty. Then watched tags, Notes, Add images, Save entry. Stop & save writes the clock's start and end (it keeps running across reload and a background tab because it stores a start timestamp). If the end clock is earlier than the start clock, one midnight is assumed, so 11:15 PM to 7:00 AM is `7h 45m`. Cards show the title, duration, start–end, tags, notes, and images. An older sleep entry still shows its Dreams text in a Dreams block, and editing it keeps a Dreams field. A timer entry with no dream text has no Dreams block.
- Look opens a picker on the home screen. The choice covers the home screen, category screen, calendar, days list, and the picker. Each built-in look sets the page background, card fill, border, type, and button colours:
  - Paper: the default rounded paper cards, no picture frame.
  - Wood: warm grain (`assets/bg-wood.webp`), parchment cards, serif (Libre Baskerville). Frame is `assets/border-wood.webp` as a 9-slice `border-image`.
  - Vine: leafy ground (`assets/bg-vine.webp`), pale cards, Fraunces. Frame is `assets/border-vine.svg`, vines and leaves.
  - 90s Retro: pixel clouds (`assets/bg-retro.webp`) plus a faint pixel grid, chunky lime cards with a dark header bar and a bevel, Pixelify Sans. The frame is CSS, not a border image.
  - Earth: starfield and a planet (`assets/bg-earth.webp`), dark glass cards, Exo 2 with Orbitron headings. Frame is `assets/border-scifi.webp`.
  - Water: teal watercolor (`assets/bg-water.webp`), glassy cards, Source Serif 4 with Cormorant headings. Frame is `assets/border-water.svg`, gold and teal ripples.
- Customize, in the same picker, recolours the current look, including Paper. Background can be any built-in scene, a plain colour, or an uploaded image. Border can be Rounded, Square, Double line, Dashed, or Thick / shadowed, and those take the border colour, or a Wood, Vine, Earth, or Water frame. Colour pickers set the page, card, text, accent, and border. Font is Theme serif, EB Garamond, Inter, Caveat, Special Elite, or Pixelify Sans (Press Start 2P on the small eyebrow). Save theme stores a named copy in the picker, with Rename and Delete. Deleting the theme you are using returns to Paper.
- Typing sounds, in that same panel, are off until chosen: Keyboard, Typewriter, or Bubble, plus a volume slider. They are made with the Web Audio API (no audio files) and play while typing in a text field or textarea. The choice is saved on the record.
- Days rows use the look's frame. Expanding a day keeps that frame on the day and on each entry card, so the image frames stay stacked. Clicking a day expands it (click again to collapse) and lists every category: entry cards, or "Nothing written." Open day selects that day for the journal.
- Tags: "New word, kept in this category", Add tag, and Edit. Add tag stores the word on the category and attaches it to the entry being written. A chip click toggles that word. Edit turns the button into Done, shows an × on each chip, and a click on the chip text renames it inline. Renaming or deleting a watched tag updates entries in that category. Entry tags render as `Tag · Tag` in the accent colour.
- Add images accepts several `image/*` files. Thumbnails sit in the form with a remove ×, and on the card as a grid. A thumbnail opens a larger lightbox. If the browser cannot read or store a photo, the form says so and the rest of the entry is left as it was.

## Run
`python3 -m http.server 8080` from this folder, then open http://localhost:8080/

## Not rebuilt yet
- Other original looks (Plain, Marble, Neon, Sci-fi city, Green/Red wire).
- Changing a category's type after it is created, and categories that collapse or can be renamed.
- Export/import JSON, search, and a streak or summary view of the practice.
