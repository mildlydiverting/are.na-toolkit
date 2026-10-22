// StatGrid: a row of labelled counts that wraps on narrow screens. Lives in shared/components until promoted into shared/ui.
//   StatGrid({ items: [{ key, label, value = 0 }] })
//   grid.update({ added: 3, failed: 0 })   changes the named counts in place
window.ArenaToolkit.StatGrid = function StatGrid({ items = [] } = {}) {
  const h = window.ArenaToolkit._el;
  const values = {};
  const root = h('div', { className: 'atk-stats' });
  items.forEach(({ key, label, value = 0 }) => {
    values[key] = h('span', { className: 'atk-stat__value' }, String(value));
    root.appendChild(h('div', { className: 'atk-stat' }, [values[key], h('span', { className: 'atk-stat__label' }, label)]));
  });
  root.update = (next = {}) => {
    Object.keys(next).forEach(k => { if (values[k]) values[k].textContent = String(next[k]); });
  };
  return root;
};
