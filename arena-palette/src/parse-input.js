// parse-input.js: channel slug from a pasted are.na URL (pure).

// Extract slug from a full are.na URL, e.g. https://www.are.na/user/channel-slug → channel-slug
export function parseArenaSlug(val) {
  const match = val.match(/are\.na\/[^/?#\s]+\/([^/?#\s]+)/);
  return match ? match[1] : val;
}
