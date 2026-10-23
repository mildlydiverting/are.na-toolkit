Footer — the shared "About" block at the foot of every tool: what it does with your data, what it is built on, who made it, the "vibe-coded" note, licence and issues link, and where to find Kim.

Pass `toolNote` (text or a node) for a line about this tool; it appears first under the heading. `homeHref` is the link to the collection's index page (default `../index.html`). Put `<footer id="footer"></footer>` in the page and swap it: `document.getElementById('footer').replaceWith(ArenaToolkit.Footer({ toolNote: '…' }))`.

The wording is Kim's and the links point at her accounts and this repo, so a tool that is not hers should not use it as it stands.
