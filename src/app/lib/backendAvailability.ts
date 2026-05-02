let backendHealthPromise: Promise<boolean> | null = null;
const REQUIRED_BACKEND_API_VERSION = 2;

const HEALTH_ENDPOINTS = [
  '/api/health',
  'http://localhost:8787/api/health',
  'http://127.0.0.1:8787/api/health',
];

async function checkOne(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) return false;
    const payload = (await response.json().catch(() => null)) as { apiVersion?: number } | null;
    return payload?.apiVersion === REQUIRED_BACKEND_API_VERSION;
  } catch {
    return false;
  }
}

export async function isBackendApiAvailable(): Promise<boolean> {
  if (backendHealthPromise) return backendHealthPromise;
  backendHealthPromise = (async () => {
    for (const url of HEALTH_ENDPOINTS) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await checkOne(url);
      if (ok) return true;
    }
    return false;
  })();
  // If the first probe round failed, allow re-checking later (e.g. while API spins up).
  void backendHealthPromise.then((ok) => {
    if (!ok) {
      window.setTimeout(() => {
        backendHealthPromise = null;
      }, 1500);
    }
  });
  return backendHealthPromise;
}
