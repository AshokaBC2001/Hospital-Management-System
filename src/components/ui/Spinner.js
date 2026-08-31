import React from 'react';
import { Loader2 } from 'lucide-react';

function Spinner({ label = 'Loading...', className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-16 ${className}`} role="status">
      <Loader2 className="w-8 h-8 text-blue-600 animate-spin" aria-hidden="true" />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

export default Spinner;
