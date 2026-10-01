import { UserRole } from '@svc-rms/shared';

type NavItem = { href: string; label: string };

const publicNav: NavItem[] = [
  { href: '/login', label: 'Login' },
  { href: '/verify/[cvid]', label: 'Verify' },
];

const roleNav: Record<UserRole, NavItem[]> = {
  [UserRole.STUDENT]: [
    { href: '/activities', label: 'Activities' },
    { href: '/my/history', label: 'My history' },
    { href: '/my/certificates', label: 'My certificates' },
    { href: '/check-in', label: 'Check in' },
  ],
  [UserRole.STAFF]: [
    { href: '/staff/activities', label: 'Staff activities' },
    { href: '/staff/certificates', label: 'Certificates' },
    { href: '/staff/records', label: 'Records' },
    { href: '/staff/reports', label: 'Reports' },
  ],
  [UserRole.MANAGEMENT]: [{ href: '/management/dashboard', label: 'Dashboard' }],
  [UserRole.ADMIN]: [
    { href: '/admin/users', label: 'Users' },
    { href: '/admin/audit', label: 'Audit' },
  ],
};

export function NavShell({ role }: { role?: UserRole }): React.JSX.Element {
  const items = role ? roleNav[role] : publicNav;

  return (
    <nav className="border-b border-gray-200 p-4">
      <ul className="flex flex-wrap gap-4 text-sm">
        {items.map((item) => (
          <li key={item.href}>
            <a href={item.href} className="text-blue-700 hover:underline">
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
