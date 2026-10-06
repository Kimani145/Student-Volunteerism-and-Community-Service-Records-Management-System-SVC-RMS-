import React from 'react';
import Link from 'next/link';

export function Empty({ message = 'No items found', actionText, actionHref, onAction }: { message?: string; actionText?: string; actionHref?: string; onAction?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-slate-500 bg-white border border-slate-200 rounded-xl min-h-[50vh]">
      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-2xl">
        📭
      </div>
      <h3 className="text-lg font-bold text-slate-800 mb-1">Nothing here</h3>
      <p className="text-sm mb-6 text-center max-w-sm">{message}</p>
      
      {actionHref && (
        <Link href={actionHref} className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition shadow-sm">
          {actionText || 'Create New'}
        </Link>
      )}
      
      {!actionHref && onAction && (
        <button onClick={onAction} className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition shadow-sm">
          {actionText || 'Create New'}
        </button>
      )}
    </div>
  );
}
