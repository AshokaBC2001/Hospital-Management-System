import React from 'react';

export function Field({ label, required, error, children, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600" role="alert">{error}</p>}
    </div>
  );
}

export function Input({ label, required, error, className = '', ...props }) {
  return (
    <Field label={label} required={required} error={error} className={className}>
      <input
        className={`input-field ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
        aria-invalid={!!error}
        {...props}
      />
    </Field>
  );
}

export function Select({ label, required, error, children, className = '', ...props }) {
  return (
    <Field label={label} required={required} error={error} className={className}>
      <select
        className={`input-field cursor-pointer ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
        aria-invalid={!!error}
        {...props}
      >
        {children}
      </select>
    </Field>
  );
}

export function Textarea({ label, required, error, className = '', rows = 3, ...props }) {
  return (
    <Field label={label} required={required} error={error} className={className}>
      <textarea
        rows={rows}
        className={`input-field resize-y ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
        aria-invalid={!!error}
        {...props}
      />
    </Field>
  );
}
