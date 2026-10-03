'use client';
import { RoleGate } from '../../../lib/auth/index.js';

export default function UsersAdmin() {
  return <RoleGate roles={['ADMIN']}><div>Users Admin Panel</div></RoleGate>;
}
