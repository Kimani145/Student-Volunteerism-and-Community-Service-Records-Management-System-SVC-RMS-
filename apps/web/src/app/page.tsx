'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';

export default function Home(): React.JSX.Element {
  const { user } = useAuth();

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white p-8 md:p-12 shadow-xl mb-12">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 mb-4">
            Official University Platform
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-4 leading-tight">
            Student Volunteerism & Community Service
          </h1>
          <p className="text-slate-300 text-base sm:text-lg mb-8 leading-relaxed">
            Record, verify, and celebrate meaningful impact. Register for student-led initiatives, check in on-site with tamper-proof tokens, and earn verifiable cryptographic credentials.
          </p>

          <div className="flex flex-wrap gap-4">
            {user ? (
              <Link
                href={user.role === 'STUDENT' ? '/activities' : user.role === 'STAFF' ? '/staff/activities' : '/management'}
                className="px-6 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 font-semibold text-white shadow-lg shadow-indigo-500/30 transition transform hover:-translate-y-0.5"
              >
                Go to {user.role === 'STUDENT' ? 'Activities' : 'Dashboard'} &rarr;
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="px-6 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 font-semibold text-white shadow-lg shadow-indigo-500/30 transition transform hover:-translate-y-0.5"
                >
                  Join as Student
                </Link>
                <Link
                  href="/login"
                  className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 font-semibold text-white border border-white/20 transition"
                >
                  Staff & Admin Sign In
                </Link>
              </>
            )}
            <Link
              href="/verify/00000000"
              className="px-6 py-3 rounded-xl bg-transparent hover:bg-white/5 font-semibold text-slate-300 hover:text-white border border-slate-700 transition"
            >
              Public Verification
            </Link>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xl mb-4">
            🌿
          </div>
          <h3 className="font-bold text-lg text-slate-900 mb-2">Verified Volunteering</h3>
          <p className="text-slate-600 text-sm leading-relaxed mb-4">
            Discover community initiatives including tree planting, fundraising, mentorship, and cleanups. Guaranteed capacity and scheduling checks prevent double-booking.
          </p>
          <Link href="/activities" className="text-indigo-600 hover:text-indigo-800 text-sm font-semibold">
            Browse Opportunities &rarr;
          </Link>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="w-12 h-12 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xl mb-4">
            ⏱️
          </div>
          <h3 className="font-bold text-lg text-slate-900 mb-2">Cryptographic Check-In</h3>
          <p className="text-slate-600 text-sm leading-relaxed mb-4">
            Attendance verification with rotating HMAC-SHA256 tokens. On-site QR scanning or fast manual 10-character code entry with real-time coordinator consoles.
          </p>
          <Link href="/check-in" className="text-indigo-600 hover:text-indigo-800 text-sm font-semibold">
            Check-In Terminal &rarr;
          </Link>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="w-12 h-12 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xl mb-4">
            📜
          </div>
          <h3 className="font-bold text-lg text-slate-900 mb-2">Ed25519 Certificates</h3>
          <p className="text-slate-600 text-sm leading-relaxed mb-4">
            Earn digitally signed PDF certificates with unique Crockford base32 CVIDs. Verifiable by employers and academic boards without leaking private student data.
          </p>
          <Link href="/my/certificates" className="text-indigo-600 hover:text-indigo-800 text-sm font-semibold">
            My Portfolio &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
