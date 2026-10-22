// StatusLog: a disclosure holding a monospace log. Lives in shared/components until promoted into shared/ui.
//   StatusLog({ label = 'Details', open = false })
//   log.add('success' | 'message' | 'warning' | 'error', text)     log.clear()
// Colour is never the only signal: success, warning and error lines carry a spoken prefix for screen readers.
window.ArenaToolkit.StatusLog = function StatusLog({ label = 'Details', open = false } = {}) {
  const h = window.ArenaToolkit._el;
  const SPOKEN = { success: 'Success: ', warning: 'Warning: ', error: 'Error: ' };   // 'message' has none
  const body = h('div', { className: 'atk-log__body', role: 'log' });
  const root = h('details', { className: 'atk-log', open }, [h('summary', { className: 'atk-log__summary' }, label), body]);
  root.add = (tone, text) => {
    const line = h('div', { className: 'atk-log__line is-' + tone });
    if (SPOKEN[tone]) line.appendChild(h('span', { className: 'atk-sr' }, SPOKEN[tone]));
    line.appendChild(document.createTextNode(text));
    body.appendChild(line);
    body.scrollTop = body.scrollHeight;
  };
  root.clear = () => body.replaceChildren();
  return root;
};
