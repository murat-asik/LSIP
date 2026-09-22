import os from 'os';
import net from 'net';
import { exec } from 'child_process';
import { NetworkInterfaceInfo, AssetPortInfo } from '../../../../shared/types/asset.types';
import { createModuleLogger } from '../../../core/logger';
import { runPowerShell } from '../../../core/powershell';
import { subnetFor } from './network-scope';

const log = createModuleLogger('net-scanner');

export class NetworkScanner {
  /**
   * Retrieves active IPv4 network interfaces and subnets.
   */
  public static async getInterfaces(): Promise<NetworkInterfaceInfo[]> {
    const interfaces = os.networkInterfaces();
    const result: NetworkInterfaceInfo[] = [];

    // Fetch deep Windows configuration via WMI
    const wmiData = await this.getWmiNicConfig();

    for (const name of Object.keys(interfaces)) {
      const list = interfaces[name];
      if (!list) continue;

      const ipv4Info = list.find((i) => i.family === 'IPv4' && !i.internal);
      const ipv6Info = list.find((i) => i.family === 'IPv6' && !i.internal);

      if (ipv4Info) {
        const subnet = subnetFor(ipv4Info.address, ipv4Info.netmask);

        // Attempt to correlate with WMI data via MAC address
        const wmiEntry = wmiData.find(w => w.mac === ipv4Info.mac);

        result.push({
          name,
          ipAddress: ipv4Info.address,
          ipv6Address: ipv6Info?.address,
          netmask: ipv4Info.netmask,
          macAddress: ipv4Info.mac,
          subnet,
          gateway: wmiEntry?.gateway,
          dnsServers: wmiEntry?.dns,
          dhcpServer: wmiEntry?.dhcp,
          domain: wmiEntry?.domain,
          status: 'Up',
        });
      }
    }
    return result;
  }

  private static getWmiNicConfig(): Promise<Array<{mac:string;gateway:string;dhcp:string;domain:string;dns:string[]}>> {
    return new Promise(resolve=>runPowerShell('Get-CimInstance Win32_NetworkAdapterConfiguration -Filter "IPEnabled=True" | Select-Object MACAddress,DefaultIPGateway,DNSServerSearchOrder,DHCPServer,DNSDomain | ConvertTo-Json -Compress', (error,stdout)=>{
      if(error){log.warn('Network adapter details unavailable',{error:error.message});resolve([]);return;}
      try{const parsed=stdout.trim()?JSON.parse(stdout):[];resolve((Array.isArray(parsed)?parsed:[parsed]).filter(Boolean).map(item=>({mac:String(item.MACAddress||'').toLowerCase().replace(/-/g,':'),gateway:item.DefaultIPGateway?.[0],dhcp:item.DHCPServer,domain:item.DNSDomain,dns:item.DNSServerSearchOrder||[]})));}
      catch{resolve([]);}
    }));
  }

  /**
   * Passive discovery: Query and parse local Windows ARP cache.
   */
  public static getArpTable(): Promise<{ ip: string; mac: string }[]> {
    return new Promise((resolve) => {
      exec('arp -a', (err, stdout) => {
        if (err) {
          log.error('Failed to execute arp -a', { error: err.message });
          return resolve([]);
        }

        const lines = stdout.split('\n');
        const results: { ip: string; mac: string }[] = [];
        
        // Match IP and MAC regex pattern
        const arpRegex = /^\s*([0-9.]+)\s+([0-9a-f:-]{17})\s/i;

        for (const line of lines) {
          const match = line.match(arpRegex);
          if (match) {
            const ip = match[1];
            const mac = match[2].toLowerCase().replace(/-/g, ':');
            
            // Ignore broadcast/multicast IPs
            if (net.isIPv4(ip) && Number(ip.split('.')[0]) < 224 && (parseInt(mac.slice(0,2),16)&1) === 0 && mac!=='00:00:00:00:00:00' && !results.some(item=>item.ip===ip)) {
              results.push({ ip, mac });
            }
          }
        }
        resolve(results);
      });
    });
  }

  /**
   * Ping a single host to verify online status and measure latency.
   */
  public static pingHost(ip:string,timeoutMs=400):Promise<number|null> {
    if(!net.isIP(ip))return Promise.reject(new Error('Invalid IP address'));
    return new Promise(resolve=>{
      const pingScript = "$p=[System.Net.NetworkInformation.Ping]::new(); try { $r=$p.Send('"+ip+"',"+Math.max(1,Math.min(5000,Math.trunc(timeoutMs)))+"); if($r.Status -eq 'Success') { $r.RoundtripTime } } finally { $p.Dispose() }";
      runPowerShell(pingScript,(error,stdout)=>resolve(!error&&/^\d+$/.test(stdout.trim())?Number(stdout.trim()):null));
    });
  }

  /**
   * Perform highly optimized async TCP port scan on a target host.
   */
  public static scanHostPorts(
    ip: string,
    ports: number[],
    timeoutMs = 500
  ): Promise<AssetPortInfo[]> {
    const scanPromises = ports.map((port) => this.checkPort(ip, port, timeoutMs));
    return Promise.all(scanPromises);
  }

  private static checkPort(ip: string, port: number, timeoutMs: number): Promise<AssetPortInfo> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let status: 'open' | 'closed' | 'filtered' = 'filtered';
      const start = Date.now();

      socket.setTimeout(timeoutMs);

      socket.on('connect', () => {
        status = 'open';
        socket.destroy();
      });

      socket.on('timeout', () => {
        socket.destroy();
      });

      socket.on('error', (error:NodeJS.ErrnoException) => {
        if(error.code==='ECONNREFUSED')status='closed';
        socket.destroy();
      });

      socket.on('close', async () => {
        if (status === 'open') {
          // Attempt a fast banner grab for HTTP/SSH
          const banner = await this.grabBanner(ip, port).catch(() => undefined);
          resolve({
            port,
            protocol: 'tcp',
            state: 'open',
            service: this.guessService(port, banner),
            banner,
            lastSeen: Date.now(),
          });
        } else {
          resolve({
            port,
            protocol: 'tcp',
            state: status,
            lastSeen: Date.now(),
          });
        }
      });

      socket.connect(port, ip);
    });
  }

  /**
   * Connects to open port and grabs initial greetings/headers
   */
  private static grabBanner(ip: string, port: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let buffer = '';
      
      socket.setTimeout(1500);

      socket.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        // If we get data, let's close and resolve
        socket.destroy();
      });

      socket.on('connect', () => {
        // Send basic probe for HTTP ports
        if (port === 80 || port === 8080) {
          socket.write("HEAD / HTTP/1.1\r\nHost: " + ip + "\r\nConnection: close\r\n\r\n");
        } else if (port === 443) {
          // HTTPS banner grab will typically show SSL handshake, but can try
          socket.write("HEAD / HTTP/1.1\r\nHost: " + ip + "\r\nConnection: close\r\n\r\n");
        }
      });

      socket.on('timeout', () => socket.destroy());
      socket.on('error', (err) => reject(err));
      socket.on('close', () => {
        const cleanBanner = buffer.trim().substring(0, 300);
        resolve(cleanBanner);
      });

      socket.connect(port, ip);
    });
  }

  private static guessService(port: number, banner?: string): string {
    if (banner) {
      if (banner.toLowerCase().includes('ssh')) return 'ssh';
      if (banner.toLowerCase().includes('http') || banner.toLowerCase().includes('server:')) return 'http';
      if (banner.toLowerCase().includes('ftp')) return 'ftp';
    }

    const mapping: Record<number, string> = {
      21: 'ftp',
      22: 'ssh',
      23: 'telnet',
      25: 'smtp',
      53: 'dns',
      80: 'http',
      110: 'pop3',
      135: 'msrpc',
      139: 'netbios',
      443: 'https',
      445: 'microsoft-ds', // SMB
      1433: 'mssql',
      3306: 'mysql',
      3389: 'ms-wbt-server', // RDP
      8080: 'http-proxy',
    };

    return mapping[port] || 'unknown';
  }
}
