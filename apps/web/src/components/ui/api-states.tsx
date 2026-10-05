import React from 'react';
import { ApiError } from '@/lib/api-client';

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      <p className="text-gray-500">{message}</p>
    </div>
  );
}

export function EmptyState({ title = 'No data found', message = 'There are no items to display at this time.' }: { title?: string; message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
      <h3 className="mt-2 text-sm font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500">{message}</p>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: ApiError | Error | null; onRetry?: () => void }) {
  const detail = error instanceof ApiError ? error.detail : error?.message;
  const title = 'An error occurred';
  const code = error instanceof ApiError ? error.code : null;

  return (
    <div className="rounded-md bg-red-50 p-6 border border-red-200">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">{title} {code && <span className="text-xs font-mono bg-red-100 px-1 py-0.5 ml-2 rounded text-red-600">{code}</span>}</h3>
          <div className="mt-2 text-sm text-red-700">
            <p>{detail || 'Something went wrong while fetching data.'}</p>
          </div>
          {onRetry && (
            <div className="mt-4">
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
