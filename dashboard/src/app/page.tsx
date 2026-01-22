'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCapture } from '@/lib/capture-context';

interface Capture {
  id: number;
  sensor_hostname: string;
  interface_name: string;
  start_time: string;
  duration_seconds: number;
  packet_count: number;
  device_count: number;
}

interface TrafficCategory {
  category: string;
  count: number;
  ports: { port: number; service: string; count: number }[];
}

interface Talker {
  ip: string;
  bytes_sent: number;
  bytes_received: number;
  packets_sent: number;
  packets_received: number;
}

interface Protocol {
  protocol: string;
  count: number;
}

interface Device {
  id: number;
  mac: string;
  vendor: string | null;
  os_guess: string | null;
}

interface Stats {
  totalDevices: number;
  totalCaptures: number;
  totalDomains: number;
  totalPackets: number;
  totalBytes: number;
  externalDestinations: number;
  protocols: Protocol[];
  categories: TrafficCategory[];
  topTalkers: Talker[];
  devices: Device[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function HomePage() {
  const { captures, selectedCaptureId, loading: captureLoading } = useCapture();
  const [stats, setStats] = useState<Stats>({
    totalDevices: 0,
    totalCaptures: 0,
    totalDomains: 0,
    totalPackets: 0,
    totalBytes: 0,
    externalDestinations: 0,
    protocols: [],
    categories: [],
    topTalkers: [],
    devices: [],
  });
  const [loading, setLoading] = useState(true);

  const selectedCapture = captures.find(c => c.id === selectedCaptureId);

  useEffect(() => {
    async function fetchData() {
      if (!selectedCaptureId) {
        setLoading(false);
        return;
      }

      try {
        const [devicesRes, trafficRes] = await Promise.all([
          fetch(`/api/devices?captureId=${selectedCaptureId}`),
          fetch(`/api/traffic?captureId=${selectedCaptureId}`),
        ]);

        const devicesData = await devicesRes.json();
        const trafficData = await trafficRes.json();

        const totalBytes = Array.isArray(trafficData.talkers)
          ? trafficData.talkers.reduce((sum: number, t: Talker) => sum + t.bytes_sent + t.bytes_received, 0)
          : 0;

        setStats({
          totalDevices: Array.isArray(devicesData) ? devicesData.length : 0,
          totalCaptures: captures.length,
          totalDomains: Array.isArray(trafficData.dnsDomains) ? trafficData.dnsDomains.length : 0,
          totalPackets: selectedCapture?.packet_count || 0,
          totalBytes,
          externalDestinations: Array.isArray(trafficData.destinations) ? trafficData.destinations.length : 0,
          protocols: Array.isArray(trafficData.protocols) ? trafficData.protocols : [],
          categories: Array.isArray(trafficData.categories) ? trafficData.categories : [],
          topTalkers: Array.isArray(trafficData.talkers) ? trafficData.talkers.slice(0, 5) : [],
          devices: Array.isArray(devicesData) ? devicesData : [],
        });
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    }

    if (!captureLoading) {
      setLoading(true);
      fetchData();
    }
  }, [selectedCaptureId, captureLoading, captures.length, selectedCapture?.packet_count]);

  // Calculate OS breakdown
  const osBreakdown = stats.devices.reduce((acc, device) => {
    const os = device.os_guess || 'Unknown';
    acc[os] = (acc[os] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Calculate vendor breakdown
  const vendorBreakdown = stats.devices.reduce((acc, device) => {
    const vendor = device.vendor || 'Unknown';
    acc[vendor] = (acc[vendor] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Security-relevant categories
  const securityCategories = ['Remote Access', 'Database', 'File Sharing'];
  const securityServicesDetected = stats.categories
    .filter(c => securityCategories.includes(c.category))
    .flatMap(c => c.ports.map(p => p.service));

  const statCards = [
    {
      label: 'Devices Discovered',
      value: stats.totalDevices,
      subtext: `${Object.keys(vendorBreakdown).length} vendors`,
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      color: 'cyan',
    },
    {
      label: 'Total Traffic',
      value: formatBytes(stats.totalBytes),
      subtext: `${stats.totalPackets.toLocaleString()} packets`,
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      ),
      color: 'emerald',
    },
    {
      label: 'External Destinations',
      value: stats.externalDestinations,
      subtext: `${stats.totalDomains} DNS domains`,
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      ),
      color: 'amber',
    },
    {
      label: 'Service Categories',
      value: stats.categories.length,
      subtext: securityServicesDetected.length > 0 ? `${securityServicesDetected.length} security-relevant` : 'No remote access',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      color: 'rose',
    },
  ];

  const colorClasses: Record<string, { bg: string; text: string; glow: string }> = {
    cyan: {
      bg: 'bg-cyan-500/10',
      text: 'text-cyan-600',
      glow: 'shadow-cyan-500/20',
    },
    emerald: {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-600',
      glow: 'shadow-emerald-500/20',
    },
    amber: {
      bg: 'bg-amber-500/10',
      text: 'text-amber-600',
      glow: 'shadow-amber-500/20',
    },
    rose: {
      bg: 'bg-rose-500/10',
      text: 'text-rose-600',
      glow: 'shadow-rose-500/20',
    },
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-[rgb(var(--text-primary))] mb-2">
          Network Overview
        </h1>
        <p className="text-[rgb(var(--text-muted))]">
          Monitor your local network assets and traffic patterns
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => (
          <div key={stat.label} className="card p-5">
            <div className="flex items-start justify-between mb-4">
              <div className={`p-2.5 rounded-lg ${colorClasses[stat.color].bg} ${colorClasses[stat.color].text}`}>
                {stat.icon}
              </div>
              <span className="status-dot online"></span>
            </div>
            <div className="space-y-1">
              <p className="text-[rgb(var(--text-muted))] text-sm">{stat.label}</p>
              <p className={`text-2xl font-semibold mono stat-value ${colorClasses[stat.color].text}`}>
                {loading ? (
                  <span className="inline-block w-16 h-7 skeleton rounded"></span>
                ) : (
                  stat.value
                )}
              </p>
              {stat.subtext && (
                <p className="text-xs text-[rgb(var(--text-muted))]">
                  {loading ? '' : stat.subtext}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid - Row 1: Traffic Categories & Protocol Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Traffic by Category */}
        <div className="card">
          <div className="flex items-center justify-between p-5 border-b border-[rgb(var(--border-subtle))]">
            <h2 className="font-medium text-[rgb(var(--text-primary))]">Traffic by Category</h2>
            <Link href="/network" className="text-xs text-cyan-600 hover:text-cyan-700 transition-colors">
              Details →
            </Link>
          </div>
          <div className="p-5">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-8 skeleton rounded"></div>
                ))}
              </div>
            ) : stats.categories.length === 0 ? (
              <p className="text-center text-[rgb(var(--text-muted))] py-8">No traffic data</p>
            ) : (
              <div className="space-y-3">
                {stats.categories.slice(0, 6).map((category) => {
                  const totalCategoryTraffic = stats.categories.reduce((sum, c) => sum + c.count, 0);
                  const percentage = totalCategoryTraffic > 0 ? (category.count / totalCategoryTraffic) * 100 : 0;
                  const categoryColors: Record<string, string> = {
                    Web: 'bg-cyan-500',
                    Database: 'bg-violet-500',
                    'Remote Access': 'bg-rose-500',
                    DNS: 'bg-blue-500',
                    Network: 'bg-slate-500',
                    Discovery: 'bg-orange-500',
                    'File Sharing': 'bg-emerald-500',
                    Email: 'bg-amber-500',
                    Streaming: 'bg-pink-500',
                    VoIP: 'bg-indigo-500',
                    Messaging: 'bg-teal-500',
                    Application: 'bg-gray-500',
                    Ephemeral: 'bg-gray-400',
                  };
                  return (
                    <div key={category.category}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-sm ${categoryColors[category.category] || 'bg-gray-400'}`}></div>
                          <span className="text-sm text-[rgb(var(--text-secondary))]">{category.category}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="mono text-xs text-[rgb(var(--text-muted))]">
                            {category.count.toLocaleString()}
                          </span>
                          <span className="mono text-sm text-[rgb(var(--text-primary))] w-12 text-right">
                            {percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-[rgb(var(--bg-tertiary))] rounded-full overflow-hidden">
                        <div
                          className={`h-full ${categoryColors[category.category] || 'bg-gray-400'} rounded-full transition-all`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {stats.categories.length > 6 && (
                  <p className="text-xs text-[rgb(var(--text-muted))] text-center pt-2">
                    +{stats.categories.length - 6} more categories
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Protocol Distribution */}
        <div className="card">
          <div className="p-5 border-b border-[rgb(var(--border-subtle))]">
            <h2 className="font-medium text-[rgb(var(--text-primary))]">Protocol Distribution</h2>
          </div>
          <div className="p-5">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 skeleton rounded"></div>
                ))}
              </div>
            ) : stats.protocols.length === 0 ? (
              <p className="text-center text-[rgb(var(--text-muted))] py-8">No protocol data</p>
            ) : (
              <div className="space-y-4">
                {/* Bar chart */}
                <div className="h-8 flex rounded-lg overflow-hidden">
                  {stats.protocols.map((p) => {
                    const total = stats.protocols.reduce((sum, proto) => sum + proto.count, 0);
                    const percentage = (p.count / total) * 100;
                    const protocolColors: Record<string, string> = {
                      TCP: 'bg-cyan-500',
                      UDP: 'bg-amber-500',
                      ICMP: 'bg-emerald-500',
                      ARP: 'bg-rose-500',
                      Other: 'bg-slate-500',
                    };
                    return (
                      <div
                        key={p.protocol}
                        className={`${protocolColors[p.protocol] || protocolColors.Other} first:rounded-l-lg last:rounded-r-lg transition-all hover:opacity-80`}
                        style={{ width: `${percentage}%` }}
                        title={`${p.protocol}: ${percentage.toFixed(1)}%`}
                      />
                    );
                  })}
                </div>
                {/* Legend */}
                <div className="grid grid-cols-2 gap-2">
                  {stats.protocols.map((p) => {
                    const total = stats.protocols.reduce((sum, proto) => sum + proto.count, 0);
                    const percentage = (p.count / total) * 100;
                    const protocolColors: Record<string, string> = {
                      TCP: 'bg-cyan-500',
                      UDP: 'bg-amber-500',
                      ICMP: 'bg-emerald-500',
                      ARP: 'bg-rose-500',
                      Other: 'bg-slate-500',
                    };
                    return (
                      <div key={p.protocol} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded ${protocolColors[p.protocol] || protocolColors.Other}`}></div>
                          <span className="mono text-sm text-[rgb(var(--text-secondary))]">{p.protocol}</span>
                        </div>
                        <span className="mono text-sm text-[rgb(var(--text-primary))]">{percentage.toFixed(1)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Top Talkers & Device OS Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top Talkers */}
        <div className="card">
          <div className="flex items-center justify-between p-5 border-b border-[rgb(var(--border-subtle))]">
            <h2 className="font-medium text-[rgb(var(--text-primary))]">Top Talkers</h2>
            <Link href="/network" className="text-xs text-cyan-600 hover:text-cyan-700 transition-colors">
              View All →
            </Link>
          </div>
          <div className="p-5">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-10 skeleton rounded"></div>
                ))}
              </div>
            ) : stats.topTalkers.length === 0 ? (
              <p className="text-center text-[rgb(var(--text-muted))] py-8">No traffic data</p>
            ) : (
              <div className="space-y-3">
                {stats.topTalkers.map((talker, index) => {
                  const totalBytes = talker.bytes_sent + talker.bytes_received;
                  const maxBytes = stats.topTalkers[0].bytes_sent + stats.topTalkers[0].bytes_received;
                  const percentage = (totalBytes / maxBytes) * 100;
                  return (
                    <div key={talker.ip} className="flex items-center gap-3">
                      <span className="text-xs text-[rgb(var(--text-muted))] w-5">{index + 1}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="mono text-sm text-cyan-600">{talker.ip}</span>
                          <span className="mono text-xs text-[rgb(var(--text-muted))]">
                            {formatBytes(totalBytes)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-[rgb(var(--bg-tertiary))] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-1 text-[10px] text-[rgb(var(--text-muted))]">
                          <span className="text-emerald-600">↑ {formatBytes(talker.bytes_sent)}</span>
                          <span className="text-amber-600">↓ {formatBytes(talker.bytes_received)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Device OS Breakdown */}
        <div className="card">
          <div className="flex items-center justify-between p-5 border-b border-[rgb(var(--border-subtle))]">
            <h2 className="font-medium text-[rgb(var(--text-primary))]">Device Fingerprints</h2>
            <Link href="/assets" className="text-xs text-cyan-600 hover:text-cyan-700 transition-colors">
              View All →
            </Link>
          </div>
          <div className="p-5">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 skeleton rounded"></div>
                ))}
              </div>
            ) : Object.keys(osBreakdown).length === 0 ? (
              <p className="text-center text-[rgb(var(--text-muted))] py-8">No device data</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(osBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 5)
                  .map(([os, count]) => {
                    const percentage = (count / stats.totalDevices) * 100;
                    const osColors: Record<string, string> = {
                      Windows: 'bg-cyan-500',
                      macOS: 'bg-slate-500',
                      iOS: 'bg-slate-400',
                      Linux: 'bg-amber-500',
                      Android: 'bg-emerald-500',
                      Unknown: 'bg-gray-400',
                    };
                    const getOsColor = (osName: string) => {
                      for (const [key, color] of Object.entries(osColors)) {
                        if (osName.toLowerCase().includes(key.toLowerCase())) return color;
                      }
                      return osColors.Unknown;
                    };
                    return (
                      <div key={os}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-[rgb(var(--text-secondary))]">{os}</span>
                          <div className="flex items-center gap-2">
                            <span className="mono text-xs text-[rgb(var(--text-muted))]">{count} devices</span>
                            <span className="mono text-sm text-[rgb(var(--text-primary))] w-12 text-right">
                              {percentage.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-[rgb(var(--bg-tertiary))] rounded-full overflow-hidden">
                          <div
                            className={`h-full ${getOsColor(os)} rounded-full transition-all`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                {Object.keys(osBreakdown).length > 5 && (
                  <p className="text-xs text-[rgb(var(--text-muted))] text-center pt-2">
                    +{Object.keys(osBreakdown).length - 5} more OS types
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Security Services & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Security-Relevant Services */}
        <div className="lg:col-span-2 card">
          <div className="p-5 border-b border-[rgb(var(--border-subtle))]">
            <h2 className="font-medium text-[rgb(var(--text-primary))]">Security-Relevant Services Detected</h2>
            <p className="text-xs text-[rgb(var(--text-muted))] mt-1">Remote access, databases, and file sharing services on your network</p>
          </div>
          <div className="p-5">
            {loading ? (
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 skeleton rounded-lg"></div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {['Remote Access', 'Database', 'File Sharing'].map((categoryName) => {
                  const category = stats.categories.find(c => c.category === categoryName);
                  const categoryIcons: Record<string, string> = {
                    'Remote Access': '🖥️',
                    'Database': '🗄️',
                    'File Sharing': '📁',
                  };
                  const categoryStyles: Record<string, { bg: string; border: string }> = {
                    'Remote Access': { bg: 'bg-rose-50', border: 'border-rose-200' },
                    'Database': { bg: 'bg-violet-50', border: 'border-violet-200' },
                    'File Sharing': { bg: 'bg-emerald-50', border: 'border-emerald-200' },
                  };
                  const styles = categoryStyles[categoryName];
                  return (
                    <div key={categoryName} className={`p-4 rounded-lg ${styles.bg} border ${styles.border}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{categoryIcons[categoryName]}</span>
                        <span className="font-medium text-sm text-[rgb(var(--text-primary))]">{categoryName}</span>
                      </div>
                      {category ? (
                        <>
                          <div className="text-xl font-semibold mono text-[rgb(var(--text-primary))] mb-1">
                            {category.ports.length} service{category.ports.length !== 1 ? 's' : ''}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {category.ports.slice(0, 3).map((port) => (
                              <span key={port.port} className="text-[10px] px-1.5 py-0.5 rounded bg-white/60 text-[rgb(var(--text-secondary))] mono">
                                {port.service}
                              </span>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-[rgb(var(--text-muted))]">None detected</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card">
          <div className="p-5 border-b border-[rgb(var(--border-subtle))]">
            <h2 className="font-medium text-[rgb(var(--text-primary))]">Quick Actions</h2>
          </div>
          <div className="p-5 space-y-3">
            <Link
              href="/import"
              className="flex items-center gap-3 p-3 rounded-lg bg-[rgb(var(--bg-tertiary))] hover:bg-[rgb(var(--bg-elevated))] transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
                <svg className="w-5 h-5 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-[rgb(var(--text-primary))] text-sm">Import Capture</p>
                <p className="text-xs text-[rgb(var(--text-muted))]">Upload summary.json</p>
              </div>
            </Link>

            <Link
              href="/assets"
              className="flex items-center gap-3 p-3 rounded-lg bg-[rgb(var(--bg-tertiary))] hover:bg-[rgb(var(--bg-elevated))] transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-[rgb(var(--text-primary))] text-sm">View Assets</p>
                <p className="text-xs text-[rgb(var(--text-muted))]">Browse devices</p>
              </div>
            </Link>

            <Link
              href="/graph"
              className="flex items-center gap-3 p-3 rounded-lg bg-[rgb(var(--bg-tertiary))] hover:bg-[rgb(var(--bg-elevated))] transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-[rgb(var(--text-primary))] text-sm">Network Graph</p>
                <p className="text-xs text-[rgb(var(--text-muted))]">Visualize connections</p>
              </div>
            </Link>
          </div>

          {/* Capture Info */}
          <div className="p-5 border-t border-[rgb(var(--border-subtle))]">
            <h3 className="text-xs font-medium text-[rgb(var(--text-muted))] uppercase tracking-wider mb-3">
              Current Capture
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[rgb(var(--text-secondary))]">Captures</span>
                <span className="mono text-[rgb(var(--text-primary))]">{captures.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[rgb(var(--text-secondary))]">Last Import</span>
                <span className="text-[rgb(var(--text-muted))] mono text-xs">
                  {captures.length > 0
                    ? new Date(captures[0].start_time).toLocaleDateString()
                    : 'Never'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
