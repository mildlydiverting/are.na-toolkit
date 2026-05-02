/*
  arena-config.js
  ─────────────────────────────────────────────────────────────────
  Configuration for arena-picks.html.
  Copy this to arena-config.js and fill in your details
  Keep this file in the same folder as arena-picks.html.
  ─────────────────────────────────────────────────────────────────

  ARENA_TOKEN
    Get one at: https://www.are.na/settings/personal-access-tokens

  BOARDS
    Bare slug from the end of the board URL only.
    e.g. are.na/username/drawing-references → "drawing-references"
    Do NOT include the username prefix.

  ALLOWED_TYPES
    Which block types to show. Comment out types you don't want.
    Available: "Image", "Text", "Link", "Embed", "Attachment"

  MAX_RETRIES
    How many random picks to attempt per board before giving up,
    if the picked block keeps being an excluded type.
    Raise this if your boards contain mostly excluded types.
*/

const ARENA_CONFIG = {

  token: "PASTE_YOUR_TOKEN_HERE",

  boards: [
    "your-first-board-slug",
    "your-second-board-slug",
    "your-third-board-slug",
    "your-fourth-board-slug",
  ],

  allowedTypes: new Set([
    "Image",
    "Text",
    "Link",
    "Embed",
    /* "Attachment",*/
  ]),

  maxRetries: 8,

};
