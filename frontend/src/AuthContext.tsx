import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  name: string | null;
  login: (token: string, refreshToken: string, name: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    Boolean(localStorage.getItem('token')),
  );
  const [name, setName] = useState<string | null>(
    localStorage.getItem('username'),
  );

  useEffect(() => {
    const onStorageChange = () => {
      setIsAuthenticated(Boolean(localStorage.getItem('token')));
      setName(localStorage.getItem('username'));
    };
    window.addEventListener('storage', onStorageChange);
    return () => window.removeEventListener('storage', onStorageChange);
  }, []);

  const login = (token: string, refreshToken: string, name: string) => {
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('username', name);
    setIsAuthenticated(true);
    setName(name);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('username');
    setIsAuthenticated(false);
    setName(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, name, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
