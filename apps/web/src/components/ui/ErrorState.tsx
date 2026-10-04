import React from 'react';
import { ApiError } from '@/lib/api-client';

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const isApiError = error instanceof ApiError;
  const message = isApiError ? error.detail : (error as Error)?.message || 'An unexpected error occurred.';
  const code = isApiError ? error.code : 'UNKNOWN_ERROR';

  return (
    <div className="flex flex-col items-center justify-center p-12 bg-rose-50 border border-rose-100 rounded-xl min-h-[50vh]">
      <div className="w-16 h-16 bg-white text-rose-500 rounded-full flex items-center justify-center mb-4 text-3xl shadow-sm border border-rose-100">
        !
      </div>
      <h3 className="text-lg font-bold text-rose-900 mb-1">Something went wrong</h3>
      <p className="text-sm text-rose-700 mb-2 text-center max-w-md">{message}</p>
      {code && <span className="text-xs font-mono text-rose-400 bg-white px-2 py-1 rounded border border-rose-100 mb-6">{code}</span>}
      
      {onRetry && (
        <button onClick={onRetry} className="px-5 py-2.5 bg-white text-rose-700 border border-rose-200 text-sm font-bold rounded-lg hover:bg-rose-50 transition shadow-sm">
          Try Again
        </button>
      )}
    </div>
  );
}
