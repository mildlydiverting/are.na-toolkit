// Footer: the shared "About" block for every tool. Lives in shared/components until promoted into shared/ui.
//   Footer({ toolNote })   toolNote: optional string or node, shown first under the heading (what this tool does with your data, say).
// Put <footer id="footer"></footer> in the page and call document.getElementById('footer').replaceWith(ArenaToolkit.Footer({...})).
window.ArenaToolkit.Footer = function Footer({ toolNote = null } = {}) {
  const h = window.ArenaToolkit._el;
  const a = (href, text) => h('a', { href, target: '_blank', rel: 'noopener' }, text);
  const REPO = 'https://github.com/mildlydiverting/are.na-toolkit';
  return h('footer', { className: 'atk-footer' }, [
    h('h2', { className: 'atk-footer__title' }, 'About'),
    toolNote ? h('p', null, toolNote) : null,
    h('p', null, ['Runs locally in your browser. Your data is only sent to ', a('https://www.are.na/developers', h('code', null, 'api.are.na')), '.']),
    h('p', null, [
      'Part of a collection of ', h('a', { href: '../index.html' }, 'Are.na Tools and Toys'),
      ' built on the ', a('https://www.are.na/developers', 'are.na API'), ' by ', a('https://www.mildlydiverting.com', 'Kim Plowright'),
      '. Not affiliated with or endorsed by ', a('https://www.are.na', 'are.na'), '.',
    ]),
    h('p', null, [
      h('em', null, 'Vibe-coded.'),
      " This tool was built with an AI assistant (and a slight sheepish sense of guilt). It works for me and is tested, but no guarantees the robot and I haven't fucked it up somehow: try it on something unimportant first, and use the dry run options to check it does what you expect. Source on ",
      a(REPO, 'GitHub'), ' under the ', a(`${REPO}/blob/main/LICENSE`, 'MIT license'), '. Found a bug? Let me know in ',
      a(`${REPO}/issues`, 'GitHub issues'), '. Be kind, I am a gentle soul.',
    ]),
    h('p', null, [
      'Want to know more? Find me on ', a('https://www.are.na/kim-plowright', 'Are.na'), ', ',
      a('https://www.instagram.com/mildlydiverting/', 'Instagram'), ', ',
      a('https://bsky.app/profile/mildlydiverting.bsky.social', 'Bluesky'), ', get my ',
      a('https://www.mildlydiverting.com/newsletter', 'newsletter'), ' or ',
      a('https://www.mildlydiverting.com/classes-workshops-teaching', 'come to my drawing classes in Canterbury or Ramsgate, UK'), '.',
    ]),
  ].filter(Boolean));
};
