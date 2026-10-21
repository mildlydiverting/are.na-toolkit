// Checkbox: a boolean control with an optional description. Tool-local until promoted into shared/ui.
// A native input sits inside the label, so keyboard, focus and screen readers behave as usual.
window.ArenaToolkit.Checkbox = function Checkbox({ label, description, checked = false, disabled = false, indeterminate = false, name, onChange } = {}) {
  const h = window.ArenaToolkit._el;
  const input = h('input', { type: 'checkbox', className: 'atk-checkbox-input', checked, disabled });
  if (name) input.name = name;
  input.indeterminate = indeterminate;
  if (onChange) input.addEventListener('change', () => onChange(input.checked));

  const box = h('span', { className: 'atk-checkbox-box', 'aria-hidden': 'true' });
  box.innerHTML = '<svg class="atk-checkbox-tick" viewBox="0 0 12 12" width="12" height="12"><path d="M2.5 6.5l2.5 2.5 4.5-5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="atk-checkbox-bar"></span>';

  const text = h('span', { className: 'atk-checkbox-text' }, [
    h('span', { className: 'atk-checkbox-label' }, label),
    description ? h('span', { className: 'atk-checkbox-desc' }, description) : null,
  ].filter(Boolean));

  return h('label', { className: 'atk-checkbox' }, [input, box, text]);
};
