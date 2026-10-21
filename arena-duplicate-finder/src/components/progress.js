// Progress: a thin bar with a label row. Indeterminate when value is omitted. Tool-local until promoted into shared/ui.
// The returned element has update({ value, max, label, detail }) so a running scan can change it in place.
window.ArenaToolkit.Progress = function Progress({ value = null, max = 100, label = '', detail = '', variant = 'default' } = {}) {
  const h = window.ArenaToolkit._el;
  const labelEl = h('span', { className: 'atk-progress-label' }, label);
  const detailEl = h('span', { className: 'atk-progress-detail' }, detail);
  const fill = h('div', { className: 'atk-progress-fill' });
  const track = h('div', { className: 'atk-progress-track', role: 'progressbar', 'aria-valuemin': '0' }, fill);
  const root = h('div', { className: `atk-progress atk-progress--${variant}` }, [
    h('div', { className: 'atk-progress-row' }, [labelEl, detailEl]),
    track,
  ]);

  root.update = function update(next = {}) {
    if ('label' in next) labelEl.textContent = next.label;
    if ('detail' in next) detailEl.textContent = next.detail;
    const v = 'value' in next ? next.value : value;
    const m = 'max' in next ? next.max : max;
    value = v;
    max = m;
    const indeterminate = v == null;
    root.classList.toggle('is-indeterminate', indeterminate);
    if (indeterminate) {
      track.removeAttribute('aria-valuenow');
      fill.style.width = '';
    } else {
      const pct = m > 0 ? Math.min(100, Math.max(0, (v / m) * 100)) : 0;
      track.setAttribute('aria-valuemax', String(m));
      track.setAttribute('aria-valuenow', String(v));
      fill.style.width = `${pct}%`;
    }
    track.setAttribute('aria-label', labelEl.textContent || 'Progress');
  };
  root.update({});
  return root;
};
