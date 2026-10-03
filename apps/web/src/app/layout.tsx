import type { Metadata } from 'next';
import { UserRole } from '@svc-rms/shared';
import { NavShell } from '@/components/nav-shell';
import { Providers } from '@/components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'SVC-RMS',
  description: 'Student Volunteerism and Community Service Records Management System',
};

const parseRole = (role: string | undefined): UserRole | undefined => {
  if (!role) {
    return undefined;
  }
  return Object.values(UserRole).includes(role as UserRole) ? (role as UserRole) : undefined;
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): Promise<React.JSX.Element> {
  const role = parseRole(process.env.NEXT_PUBLIC_DEMO_ROLE);

  return (
    <html lang="en">
      <body>
        <Providers>
          <NavShell role={role} />
          <main className="p-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
