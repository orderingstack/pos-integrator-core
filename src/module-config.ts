import axios from 'axios';
import { logger } from './logger';
import { ModuleConfig } from './types';

const DEBUG = process.env.AUTH_DEBUG === 'true';
const DEFAULT_HTTP_TIMEOUT = 10000; // 10 seconds

let cachedConfig: ModuleConfig | null = null;
let lastFetchTime = 0;
let refreshInterval: NodeJS.Timeout | null = null;

async function fetchModuleConfig(
  baseUrl: string,
  accessToken: string,
): Promise<{ data?: ModuleConfig; error?: any }> {
  DEBUG && logger.debug('fetchModuleConfig called');

  try {
    const response = await axios.get<ModuleConfig>(
      `${baseUrl}/auth-api/api/module-config`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: DEFAULT_HTTP_TIMEOUT,
      },
    );

    cachedConfig = response.data;
    lastFetchTime = Date.now();

    DEBUG &&
      logger.debug('fetchModuleConfig successful', {
        id: response.data?.id,
        type: response.data?.type,
      });

    return { data: response.data };
  } catch (error: any) {
    DEBUG &&
      logger.debug('fetchModuleConfig error', {
        status: error?.response?.status,
        error: error?.message,
      });

    return { error };
  }
}

export function startModuleConfigPolling(
  baseUrl: string,
  getAccessToken: () => Promise<string>,
) {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }

  const intervalMs =
    Number(process.env.MODULE_CONFIG_FETCHING_INTERVAL_SEC || '600') * 1000;
  DEBUG && logger.debug('Starting module config polling', { intervalMs });

  refreshInterval = setInterval(async () => {
    try {
      const accessToken = await getAccessToken();
      await fetchModuleConfig(baseUrl, accessToken);
    } catch (error) {
      logger.warn('Module config polling failed:', error);
    }
  }, intervalMs);

  // Initial fetch
  setTimeout(async () => {
    try {
      const accessToken = await getAccessToken();
      await fetchModuleConfig(baseUrl, accessToken);
    } catch (error) {
      logger.warn('Initial module config fetch failed:', error);
    }
  }, 1000);
}

export function stopModuleConfigPolling() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    DEBUG && logger.debug('Module config polling stopped');
  }
}

export function getModuleConfig(): ModuleConfig | null {
  return cachedConfig;
}

export function clearModuleConfig() {
  cachedConfig = null;
  lastFetchTime = 0;
  stopModuleConfigPolling();
}
