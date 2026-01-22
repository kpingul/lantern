import { NextRequest, NextResponse } from 'next/server';
import { getDB, getAll } from '@/lib/db/client';

interface ProtocolRow {
  protocol: string;
  count: number;
}

interface PortRow {
  port: number;
  protocol: string;
  count: number;
}

interface TalkerRow {
  ip: string;
  bytes_sent: number;
  bytes_received: number;
  packets_sent: number;
  packets_received: number;
}

interface DNSRow {
  domain: string;
  query_count: number;
}

interface DestRow {
  address: string;
  connection_count: number;
  bytes_total: number;
}

// Port to category mapping
const portCategories: Record<number, { category: string; service: string }> = {
  // Web
  80: { category: 'Web', service: 'HTTP' },
  443: { category: 'Web', service: 'HTTPS' },
  8080: { category: 'Web', service: 'HTTP Proxy' },
  8443: { category: 'Web', service: 'HTTPS Alt' },
  3000: { category: 'Web', service: 'Dev Server' },
  5000: { category: 'Web', service: 'Dev Server' },

  // Database
  3306: { category: 'Database', service: 'MySQL' },
  5432: { category: 'Database', service: 'PostgreSQL' },
  27017: { category: 'Database', service: 'MongoDB' },
  6379: { category: 'Database', service: 'Redis' },
  1433: { category: 'Database', service: 'SQL Server' },
  1521: { category: 'Database', service: 'Oracle' },

  // Email
  25: { category: 'Email', service: 'SMTP' },
  465: { category: 'Email', service: 'SMTPS' },
  587: { category: 'Email', service: 'SMTP Submission' },
  110: { category: 'Email', service: 'POP3' },
  995: { category: 'Email', service: 'POP3S' },
  143: { category: 'Email', service: 'IMAP' },
  993: { category: 'Email', service: 'IMAPS' },

  // File Sharing
  21: { category: 'File Sharing', service: 'FTP' },
  22: { category: 'Remote Access', service: 'SSH' },
  445: { category: 'File Sharing', service: 'SMB' },
  139: { category: 'File Sharing', service: 'NetBIOS' },
  2049: { category: 'File Sharing', service: 'NFS' },

  // DNS & Network
  53: { category: 'DNS', service: 'DNS' },
  67: { category: 'Network', service: 'DHCP Server' },
  68: { category: 'Network', service: 'DHCP Client' },
  123: { category: 'Network', service: 'NTP' },
  161: { category: 'Network', service: 'SNMP' },

  // Streaming & Media
  554: { category: 'Streaming', service: 'RTSP' },
  1935: { category: 'Streaming', service: 'RTMP' },
  5004: { category: 'Streaming', service: 'RTP' },
  5005: { category: 'Streaming', service: 'RTP' },

  // Messaging & VoIP
  5060: { category: 'VoIP', service: 'SIP' },
  5061: { category: 'VoIP', service: 'SIP TLS' },
  3478: { category: 'VoIP', service: 'STUN' },
  5222: { category: 'Messaging', service: 'XMPP' },

  // Remote Access
  23: { category: 'Remote Access', service: 'Telnet' },
  3389: { category: 'Remote Access', service: 'RDP' },
  5900: { category: 'Remote Access', service: 'VNC' },

  // Discovery
  5353: { category: 'Discovery', service: 'mDNS' },
  1900: { category: 'Discovery', service: 'SSDP/UPnP' },
  5355: { category: 'Discovery', service: 'LLMNR' },
  137: { category: 'Discovery', service: 'NetBIOS NS' },
  138: { category: 'Discovery', service: 'NetBIOS DG' },
};

function categorizePort(port: number): { category: string; service: string } {
  if (portCategories[port]) {
    return portCategories[port];
  }

  // Heuristics for unknown ports
  if (port >= 1024 && port <= 49151) {
    return { category: 'Application', service: `Port ${port}` };
  }
  if (port >= 49152) {
    return { category: 'Ephemeral', service: `Port ${port}` };
  }
  return { category: 'Other', service: `Port ${port}` };
}

interface CategorySummary {
  category: string;
  count: number;
  ports: { port: number; service: string; count: number }[];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const captureId = searchParams.get('captureId');

    const db = await getDB();

    // Get protocol counts
    let protocolQuery = 'SELECT protocol, SUM(count) as count FROM protocol_counts';
    let protocolParams: number[] = [];

    if (captureId) {
      protocolQuery += ' WHERE capture_id = ?';
      protocolParams.push(parseInt(captureId));
    }
    protocolQuery += ' GROUP BY protocol ORDER BY count DESC';

    const protocols = getAll<ProtocolRow>(db, protocolQuery, protocolParams);

    // Get top ports
    let portsQuery = 'SELECT port, protocol, SUM(count) as count FROM top_ports';
    let portsParams: number[] = [];

    if (captureId) {
      portsQuery += ' WHERE capture_id = ?';
      portsParams.push(parseInt(captureId));
    }
    portsQuery += ' GROUP BY port, protocol ORDER BY count DESC LIMIT 20';

    const ports = getAll<PortRow>(db, portsQuery, portsParams);

    // Get top talkers
    let talkersQuery = `
      SELECT ip,
        SUM(bytes_sent) as bytes_sent,
        SUM(bytes_received) as bytes_received,
        SUM(packets_sent) as packets_sent,
        SUM(packets_received) as packets_received
      FROM top_talkers
    `;
    let talkersParams: number[] = [];

    if (captureId) {
      talkersQuery += ' WHERE capture_id = ?';
      talkersParams.push(parseInt(captureId));
    }
    talkersQuery += ' GROUP BY ip ORDER BY (bytes_sent + bytes_received) DESC LIMIT 20';

    const talkers = getAll<TalkerRow>(db, talkersQuery, talkersParams);

    // Get DNS domains
    let dnsQuery = `
      SELECT domain, SUM(query_count) as query_count
      FROM dns_domains
    `;
    let dnsParams: number[] = [];

    if (captureId) {
      dnsQuery += ' WHERE capture_id = ?';
      dnsParams.push(parseInt(captureId));
    }
    dnsQuery += ' GROUP BY domain ORDER BY query_count DESC LIMIT 50';

    const dnsDomains = getAll<DNSRow>(db, dnsQuery, dnsParams);

    // Get destinations
    let destQuery = `
      SELECT address, SUM(connection_count) as connection_count, SUM(bytes_total) as bytes_total
      FROM destinations
    `;
    let destParams: number[] = [];

    if (captureId) {
      destQuery += ' WHERE capture_id = ?';
      destParams.push(parseInt(captureId));
    }
    destQuery += ' GROUP BY address ORDER BY bytes_total DESC LIMIT 20';

    const destinations = getAll<DestRow>(db, destQuery, destParams);

    // Build traffic categories from ports
    const categoryMap = new Map<string, CategorySummary>();

    for (const port of ports) {
      const { category, service } = categorizePort(port.port);

      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          category,
          count: 0,
          ports: [],
        });
      }

      const cat = categoryMap.get(category)!;
      cat.count += port.count;
      cat.ports.push({
        port: port.port,
        service,
        count: port.count,
      });
    }

    // Sort categories by count and convert to array
    const categories = Array.from(categoryMap.values())
      .sort((a, b) => b.count - a.count)
      .map(cat => ({
        ...cat,
        ports: cat.ports.sort((a, b) => b.count - a.count).slice(0, 5), // Top 5 ports per category
      }));

    return NextResponse.json({
      protocols,
      ports,
      talkers,
      dnsDomains,
      destinations,
      categories,
    });
  } catch (error) {
    console.error('Traffic fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch traffic data' }, { status: 500 });
  }
}
