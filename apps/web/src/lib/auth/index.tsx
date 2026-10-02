import React, { createContext, useContext, ReactNode } from 'react';
import { UserRole } from '@svc-rms/shared';

export const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  return <AuthContext.Provider value={{}}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

export const RoleGate = ({ allowedRoles, children }: { allowedRoles: UserRole[], children: ReactNode }) => {
  return <>{children}</>;
};
