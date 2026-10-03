const scannerAgentUrl = (process.env.NEXT_PUBLIC_SCANNER_AGENT_URL ?? 'http://127.0.0.1:17654').replace(/\/$/, '');

export interface ScannerAgentHealth {
  ready: boolean;
  provider: 'NAPS2';
  version: string;
  license: string;
  drivers: string[];
}

export interface LocalScannerDevice {
  id: string;
  name: string;
  driver: 'WIA' | 'TWAIN' | 'ESCL';
  nativeId: string;
}

export async function getScannerAgentHealth(): Promise<ScannerAgentHealth> {
  const response = await fetch(`${scannerAgentUrl}/health`, { signal: AbortSignal.timeout(2500) });
  if (!response.ok) throw new Error('El agente gratuito NAPS2 no está disponible.');
  return response.json() as Promise<ScannerAgentHealth>;
}

export async function listScannerDevices(): Promise<LocalScannerDevice[]> {
  const response = await fetch(`${scannerAgentUrl}/devices`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('No se pudieron consultar los escáneres conectados.');
  return response.json() as Promise<LocalScannerDevice[]>;
}

export async function acquireFromScanner(input: {
  deviceId: string;
  resolutionDpi: number;
  colorMode: string;
  duplex: boolean;
  useFeeder: boolean;
}): Promise<File> {
  const response = await fetch(`${scannerAgentUrl}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const problem = await response.json().catch(() => null) as { detail?: string; message?: string } | null;
    throw new Error(problem?.detail ?? problem?.message ?? 'El escáner no pudo adquirir el documento.');
  }
  const blob = await response.blob();
  const fileName = response.headers.get('X-Scan-Filename') ?? `escaneo-${Date.now()}.pdf`;
  return new File([blob], fileName, { type: 'application/pdf' });
}
