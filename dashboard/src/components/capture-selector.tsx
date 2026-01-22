'use client';

import { useCapture } from '@/lib/capture-context';

export function CaptureSelector() {
  const { captures, selectedCaptureId, setSelectedCaptureId, loading } = useCapture();

  if (loading) {
    return (
      <div className="px-4 py-3">
        <div className="h-9 skeleton rounded-lg"></div>
      </div>
    );
  }

  if (captures.length === 0) {
    return (
      <div className="px-4 py-3">
        <p className="text-xs text-[rgb(var(--text-muted))]">No captures yet</p>
      </div>
    );
  }

  const selectedCapture = captures.find(c => c.id === selectedCaptureId);

  return (
    <div className="px-4 py-3">
      <label className="block text-[10px] text-[rgb(var(--text-muted))] uppercase tracking-wider mb-2">
        Active Capture
      </label>
      <div className="relative">
        <select
          value={selectedCaptureId || ''}
          onChange={(e) => setSelectedCaptureId(Number(e.target.value))}
          className="w-full appearance-none bg-[rgb(var(--bg-tertiary))] border border-[rgb(var(--border-subtle))] rounded-lg px-3 py-2 pr-8 text-sm text-[rgb(var(--text-primary))] focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 cursor-pointer"
        >
          {captures.map((capture) => (
            <option key={capture.id} value={capture.id}>
              {new Date(capture.start_time).toLocaleDateString()} - {capture.device_count} devices
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <svg className="w-4 h-4 text-[rgb(var(--text-muted))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {selectedCapture && (
        <div className="mt-2 text-[10px] text-[rgb(var(--text-muted))] mono">
          {selectedCapture.sensor_hostname} • {selectedCapture.interface_name}
        </div>
      )}
    </div>
  );
}
