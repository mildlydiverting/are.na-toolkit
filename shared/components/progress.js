// Progress: a thin bar with a label row. Lives in shared/components until promoted into shared/ui.
// Finite (value and max > 0) or indeterminate (no value, or no usable max): update() can switch between them at any time.
//   Progress({ value, max, label, detail, variant })   variant: 'default' | 'success' | 'alert'
//   bar.update({ value, max, label, detail, variant })  changes only the keys you pass
// detail is text or a node. aria-valuetext is built from label + detail, so a screen reader says
// "Dry run: merging, 16 of 20" rather than just "80%".

// Pure: what the bar should show for a value and a max.
export function progressModel({ value = null, max = 100 } = {}) {
  const finite = value != null && Number.isFinite(value) && Number.isFinite(max) && max > 0;
  if (!finite) return { indeterminate: true, pct: null, now: null, max: null };
  const now = Math.min(max, Math.max(0, value));
  return { indeterminate: false, pct: (now / max) * 100, now, max };
}

// Pure: the text a node or string contributes to a spoken description.
export function plainText(x) {
  if (x == null) return '';
  return typeof x === 'string' ? x : String(x.textContent ?? '');
}

// Pure: "label, detail" for aria-valuetext.
export function spokenProgress({ label = '', detail = '' } = {}) {
  return [plainText(label), plainText(detail)].filter(Boolean).join(', ');
}

if (typeof window !== 'undefined' && window.ArenaToolkit) {
  window.ArenaToolkit.Progress = function Progress(initial = {}) {
    const h = window.ArenaToolkit._el;
    const state = { value: null, max: 100, label: '', detail: '', variant: 'default', ...initial };
    const labelEl = h('span', { className: 'atk-progress-label' });
    const detailEl = h('span', { className: 'atk-progress-detail' });
    const fill = h('div', { className: 'atk-progress-fill' });
    const track = h('div', { className: 'atk-progress-track', role: 'progressbar', 'aria-valuemin': '0' }, fill);
    const root = h('div', { className: 'atk-progress' }, [
      h('div', { className: 'atk-progress-row' }, [labelEl, detailEl]),
      track,
    ]);

    function render() {
      const m = progressModel(state);
      root.className = `atk-progress atk-progress--${state.variant}${m.indeterminate ? ' is-indeterminate' : ''}`;
      labelEl.textContent = state.label;
      if (typeof state.detail === 'string' || state.detail == null) detailEl.textContent = state.detail ?? '';
      else detailEl.replaceChildren(state.detail);
      if (m.indeterminate) {
        track.removeAttribute('aria-valuenow');
        track.removeAttribute('aria-valuemax');
        fill.style.width = '';
      } else {
        track.setAttribute('aria-valuemax', String(m.max));
        track.setAttribute('aria-valuenow', String(m.now));
        fill.style.width = `${m.pct}%`;
      }
      track.setAttribute('aria-label', plainText(state.label) || 'Progress');
      const spoken = spokenProgress(state);
      if (spoken) track.setAttribute('aria-valuetext', spoken); else track.removeAttribute('aria-valuetext');
    }

    root.update = function update(next = {}) {
      for (const k of ['value', 'max', 'label', 'detail', 'variant']) if (k in next) state[k] = next[k];
      render();
    };
    render();
    return root;
  };
}
