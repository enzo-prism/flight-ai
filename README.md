# Flight AI — preview site

Single-page marketing site for **Flight AI**, a fictional company whose AI agents
are specialized for customer support and sales. Clean, spacious,
Cursor/Apple/OpenAI-inspired design with subtle aviation theming and animated
Lordicon icons throughout.

## Stack

- Static HTML + CSS + JS — no build step, no dependencies
- Icons: [Lordicon](https://lordicon.com) animated icons via CDN
- Hosting: Vercel (static)

## Develop

Open `index.html` directly, or serve locally:

```sh
python3 -m http.server 8080
# → http://localhost:8080
```

## Deploy

```sh
vercel --prod
```

## Structure

| File         | Purpose                                    |
| ------------ | ------------------------------------------ |
| `index.html` | Page markup, copy, Lordicon embeds         |
| `styles.css` | Design system, layout, responsive, motion  |
| `app.js`     | Scroll reveals, metric count-up, nav state |
| `vercel.json`| Static hosting config                      |
