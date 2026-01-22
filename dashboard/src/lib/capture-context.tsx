'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Capture {
  id: number;
  sensor_hostname: string;
  interface_name: string;
  start_time: string;
  duration_seconds: number;
  packet_count: number;
  device_count: number;
}

interface CaptureContextType {
  captures: Capture[];
  selectedCaptureId: number | null;
  setSelectedCaptureId: (id: number | null) => void;
  loading: boolean;
}

const CaptureContext = createContext<CaptureContextType | undefined>(undefined);

export function CaptureProvider({ children }: { children: ReactNode }) {
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [selectedCaptureId, setSelectedCaptureId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCaptures() {
      try {
        const res = await fetch('/api/captures');
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setCaptures(data);
          // Default to most recent capture
          setSelectedCaptureId(data[0].id);
        }
      } catch (error) {
        console.error('Failed to fetch captures:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchCaptures();
  }, []);

  return (
    <CaptureContext.Provider value={{ captures, selectedCaptureId, setSelectedCaptureId, loading }}>
      {children}
    </CaptureContext.Provider>
  );
}

export function useCapture() {
  const context = useContext(CaptureContext);
  if (context === undefined) {
    throw new Error('useCapture must be used within a CaptureProvider');
  }
  return context;
}
