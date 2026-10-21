// Radio: one choice from a group, grouped by `name`. Tool-local until promoted into shared/ui.
// A native radio input sits inside the label, so arrow keys, focus and screen readers behave as usual.
window.ArenaToolkit.Radio = function Radio({ label, description, value, name, checked = false, disabled = false, onChange } = {}) {
  const h = window.ArenaToolkit._el;
  const input = h('input', { type: 'radio', className: 'atk-radio-input', checked, disabled, name, value });
  if (onChange) input.addEventListener('change', () => { if (input.checked) onChange(value); });

  const ring = h('span', { className: 'atk-radio-ring', 'aria-hidden': 'true' }, h('span', { className: 'atk-radio-dot' }));
  const text = h('span', { className: 'atk-radio-text' }, [
    h('span', { className: 'atk-radio-label' }, label),
    description ? h('span', { className: 'atk-radio-desc' }, description) : null,
  ].filter(Boolean));
  return h('label', { className: 'atk-radio' }, [input, ring, text]);
};
