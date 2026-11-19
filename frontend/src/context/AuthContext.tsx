import React, { createContext, useContext, useState, useEffect } from 'react';

export type Role = 'admin' | 'gestor' | 'supervisor' | 'tecnico';

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: Role;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const defaultAdminUser: User = {
  id: 'admin',
  username: 'operador',
  email: 'operador@evad.local',
  fullName: 'Operador EVAD',
  role: 'admin',
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(defaultAdminUser);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setUser(defaultAdminUser);
    setLoading(false);
  }, []);

  const login = async () => {
    setUser(defaultAdminUser);
  };

  const logout = async () => {
    setUser(defaultAdminUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
