let backendHealthPromise: Promise<boolean> | null = null;
const REQUIRED_BACKEND_API_VERSION = 2;

export async function isBackendApiAvailable(): Promise<boolean> {
  if (!backendHealthPromise) {
    backendHealthPromise = fetch('/api/health', { method: 'GET' })
      .then(async (response) => {
        if (!response.ok) return false;

        const payload = await response.json().catch(() => null) as { apiVersion?: number } | null;
        return payload?.apiVersion === REQUIRED_BACKEND_API_VERSION;
      })
      .catch(() => false);
  }

  return backendHealthPromise;
}
