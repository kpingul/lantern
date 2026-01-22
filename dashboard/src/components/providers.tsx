'use client';

import { ReactNode } from 'react';
import { CaptureProvider } from '@/lib/capture-context';

export function Providers({ children }: { children: ReactNode }) {
  return <CaptureProvider>{children}</CaptureProvider>;
}
