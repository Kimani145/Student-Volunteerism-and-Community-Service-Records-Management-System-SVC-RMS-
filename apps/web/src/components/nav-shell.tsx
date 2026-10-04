'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserRole } from '@svc-rms/shared';
import { useAuth } from '@/lib/auth';

type NavItem = { href: string; label: string };

const publicNav: NavItem[] = [
  { href: '/verify', label: 'Verify Certificate' },
];

const roleNav: Record<UserRole, NavItem[]> = {
  [UserRole.STUDENT]: [
    { href: '/activities', label: 'Activities' },
    { href: '/my/history', label: 'My History' },
    { href: '/my/certificates', label: 'My Certificates' },
    { href: '/check-in', label: 'Check-In' },
  ],
  [UserRole.STAFF]: [
    { href: '/staff/activities', label: 'Activities Console' },
    { href: '/staff/certificates', label: 'Certificates' },
    { href: '/staff/records', label: 'Records Archive' },
    { href: '/staff/reports', label: 'Reports' },
    { href: '/staff/partners', label: 'Partners' },
  ],
  [UserRole.MANAGEMENT]: [
    { href: '/management', label: 'Strategic Dashboard' },
    { href: '/staff/reports', label: 'Reports' },
  ],
  [UserRole.ADMIN]: [
    { href: '/admin/users', label: 'User Directory' },
    { href: '/admin/audit', label: 'Audit Trail' },
  ],
};

export function NavShell({ role: initialRole }: { role?: UserRole }): React.JSX.Element {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();

  const activeRole: UserRole | undefined = user?.role || initialRole;
  const items = activeRole ? (roleNav[activeRole] || publicNav) : publicNav;

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-md shadow-indigo-200 group-hover:bg-indigo-700 transition">
                S
              </div>
              <div>
                <span className="font-extrabold text-slate-900 tracking-tight text-lg">SVC-RMS</span>
                <span className="hidden sm:inline-block ml-2 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">Volunteer Portal</span>
              </div>
            </Link>

            <nav className="hidden md:flex gap-1">
              {items.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition ${
                      isActive
                        ? 'text-indigo-600 bg-indigo-50 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {loading ? (
              <div className="w-20 h-8 bg-slate-100 rounded animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-semibold text-slate-900">{user.email}</span>
                  <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">{user.role}</span>
                </div>
                <button
                  onClick={() => logout()}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-red-700 hover:bg-red-50 rounded-lg border border-slate-200 transition"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 transition"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="px-3.5 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
