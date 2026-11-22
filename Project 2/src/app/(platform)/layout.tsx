import React from 'react';
import { AppShell } from '@/components/AppShell';
import { PlatformProvider } from '@/components/PlatformContext';

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlatformProvider>
      <AppShell>{children}</AppShell>
    </PlatformProvider>
  );
}
