'use client';
import { ApolloProvider } from '@apollo/client/react';
import { Toaster } from 'react-hot-toast';
import { apolloClient } from '@/lib/apolloClient';
import { AuthProvider } from '@/contexts/AuthContext';
import { ReownProvider } from '@/providers/ReownProvider';

interface ClientProvidersProps {
  children: React.ReactNode;
}

export const ClientProviders = ({ children }: ClientProvidersProps) => {
  return (
    <ApolloProvider client={apolloClient}>
      <ReownProvider>
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 5000,
              style: {
                background: '#1a1a1a',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '0.75rem',
                padding: '12px 16px',
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </AuthProvider>
      </ReownProvider>
    </ApolloProvider>
  );
};
