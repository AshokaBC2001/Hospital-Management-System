import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Field } from './FormField';

// Searchable dropdown for choosing one item from a list.
// options: [{ value, label, hint? }]
function SearchableSelect({
  label,
  required,
  error,
  value,
  onChange,
  options,
  placeholder = 'Select...',
  emptyMessage = 'No matches found',
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const term = query.trim().toLowerCase();
  const filtered = options.filter(
    (o) =>
      !term ||
      o.label.toLowerCase().includes(term) ||
      (o.hint || '').toLowerCase().includes(term)
  );

  const choose = (val) => {
    onChange(val);
    setOpen(false);
    setQuery('');
  };

  return (
    <Field label={label} required={required} error={error} className={className}>
      <div ref={wrapRef}>
        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o);
            setQuery('');
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={`input-field flex items-center justify-between gap-2 text-left cursor-pointer ${
            error ? 'border-red-400' : ''
          }`}
        >
          <span className={`truncate ${selected ? 'text-slate-900' : 'text-slate-400'}`}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>

        {open && (
          <div className="mt-1 bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <div className="p-2 border-b border-slate-100">
              <input
                autoFocus
                type="search"
                className="input-field"
                placeholder="Type to search..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.stopPropagation();
                    setOpen(false);
                  }
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filtered.length > 0) choose(filtered[0].value);
                  }
                }}
                aria-label={`Search ${label}`}
              />
            </div>
            <ul role="listbox" aria-label={label} className="max-h-44 overflow-y-auto">
              {filtered.length === 0 ? (
                <li className="px-3 py-2.5 text-sm text-slate-400">{emptyMessage}</li>
              ) : (
                filtered.map((o) => (
                  <li key={o.value} role="option" aria-selected={o.value === value}>
                    <button
                      type="button"
                      onClick={() => choose(o.value)}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer hover:bg-blue-50 ${
                        o.value === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                      }`}
                    >
                      <span className="block truncate">{o.label}</span>
                      {o.hint && <span className="block text-xs text-slate-400 truncate">{o.hint}</span>}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
    </Field>
  );
}

export default SearchableSelect;
