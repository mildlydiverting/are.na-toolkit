// image-cache.js: load each image once; asking again for the same URL gives the same element.

// load(url) returns a promise of the loaded image. A failed load is forgotten, so a retry tries again.
export function createImageCache(load) {
  const entries = new Map();
  return {
    get(url) {
      if (!entries.has(url)) {
        entries.set(url, load(url).catch(err => { entries.delete(url); throw err; }));
      }
      return entries.get(url);
    },
    has: url => entries.has(url),
    clear: () => entries.clear(),
  };
}

// Browser loader: cross-origin anonymous, so the canvas can read it for extraction.
export function loadImageElement(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}
