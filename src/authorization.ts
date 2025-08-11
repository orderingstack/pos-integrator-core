import axios from 'axios';
import keytar from 'keytar';
import inquirer from 'inquirer';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';
import {
  GetDeviceCodeResponse,
  PollForTokenResponse,
  PollForTokenResponseSuccess,
  AuthData,
} from './types';
import {
  getModuleConfig as getModuleConfigFromCache,
  startModuleConfigPolling,
  stopModuleConfigPolling as stopPolling,
} from './module-config';

const DEBUG = process.env.AUTH_DEBUG === 'true';
const DEFAULT_HTTP_TIMEOUT = 10000; // 10 seconds

export const authorize = async (
  baseUrl: string,
  tenant: string,
  basicAuthPass: string,
  username: string,
  moduleId?: string,
) => {
  DEBUG &&
    logger.debug('authorize() called', {
      baseUrl: baseUrl?.substring(0, 50),
      tenant,
      username,
      moduleId,
      useDeviceCode: !!moduleId,
    });

  if (moduleId) {
    logger.info(`Authorization with device code for module: ${moduleId}`);
    return authorizeWithDeviceCode(baseUrl, tenant, basicAuthPass, moduleId);
  }

  const password = await getPassword(username);
  if (!password) {
    const error = new Error('No password available for user');
    DEBUG && logger.error('No password available', { username });
    return { authData: null, err: error, errMsg: error.message };
  }

  try {
    const response = await axios({
      method: 'post',
      url: `${baseUrl}/auth-oauth2/oauth/token`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        Authorization: `Basic ${basicAuthPass}`,
        'X-Tenant': tenant,
      },
      data: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&grant_type=password&scope=read`,
      timeout: DEFAULT_HTTP_TIMEOUT,
    });

    DEBUG &&
      logger.debug('Authorization successful', {
        //@ts-ignore
        expires_in: response?.data?.expires_in,
      });
    return {
      authData: response.data,
      err: null,
    };
  } catch (error: any) {
    const errorMessage =
      error?.response?.data?.error_description || 'unknown error';
    const statusCode = error?.response?.status;

    DEBUG &&
      logger.error('Authorization failed', {
        status: statusCode,
        error: errorMessage,
        username,
      });
    logger.error(`Authorization error: ${errorMessage}`);

    return {
      authData: null,
      err: error.response ? error.response.status : error,
      errMsg: error.response
        ? error.response.statusText + ' ' + error.response.status
        : errorMessage,
    };
  }
};

// Device code flow functions
function writeDeviceCodeStatus(content: string): void {
  const dataDir = path.join(process.cwd(), 'data');
  const filePath = path.join(dataDir, 'device-code-auth.txt');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
  }
  fs.writeFileSync(filePath, content, 'utf8');
  DEBUG && logger.debug('Device code status written to file', { content });
}

async function getDeviceCode(
  baseUrl: string,
  tenant: string,
  basicAuth: string,
  moduleId: string,
): Promise<{ data?: GetDeviceCodeResponse; error?: any }> {
  try {
    const response = await axios.post<GetDeviceCodeResponse>(
      `${baseUrl}/auth-oauth2/oauth/device`,
      { module: moduleId },
      {
        headers: {
          Accept: 'application/json',
          'X-Tenant': tenant,
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basicAuth}`,
        },
        timeout: DEFAULT_HTTP_TIMEOUT,
      },
    );

    DEBUG &&
      logger.debug('Device code obtained', {
        user_code: response.data.user_code,
        expires_in: response.data.expires_in,
      });

    return { data: response.data };
  } catch (error: any) {
    logger.error('Failed to get device code', {
      status: error?.response?.status,
      error: error?.response?.data?.error || error.message,
    });
    return { error };
  }
}

async function pollForToken(
  baseUrl: string,
  tenant: string,
  basicAuth: string,
  deviceCode: string,
  interval: number,
  expiresIn: number,
): Promise<{ data?: PollForTokenResponseSuccess; error?: any }> {
  const expiry = Date.now() + expiresIn * 1000;

  while (Date.now() < expiry - 2000) {
    try {
      DEBUG &&
        logger.debug('Polling for token', {
          deviceCode: deviceCode.substring(0, 10) + '...',
        });

      const response = await axios.post<PollForTokenResponse>(
        `${baseUrl}/auth-oauth2/oauth/token`,
        {
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        },
        {
          headers: {
            Accept: 'application/json',
            'X-Tenant': tenant,
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${basicAuth}`,
          },
          timeout: DEFAULT_HTTP_TIMEOUT,
          validateStatus: (status) => status < 500,
        },
      );

      if ('access_token' in response.data) {
        DEBUG && logger.debug('Token obtained successfully');
        return { data: response.data };
      }

      const errorType = (response.data as any)?.error;
      if (errorType === 'slow_down') {
        DEBUG && logger.debug('Server requested slow down');
        await new Promise((resolve) =>
          setTimeout(resolve, interval * 1000 * 2),
        );
      } else if (errorType === 'authorization_pending') {
        await new Promise((resolve) => setTimeout(resolve, interval * 1000));
      } else {
        logger.error('Token polling error', { error: errorType });
        return { error: new Error(`Token polling failed: ${errorType}`) };
      }
    } catch (error: any) {
      logger.error('Token polling request failed', {
        status: error?.response?.status,
        error: error?.response?.data?.error || error.message,
      });
      await new Promise((resolve) => setTimeout(resolve, interval * 1000));
    }
  }

  return { error: new Error('Device code authorization timeout') };
}

async function authorizeWithDeviceCode(
  baseUrl: string,
  tenant: string,
  basicAuth: string,
  moduleId: string,
): Promise<{ authData?: AuthData; err?: any; errMsg?: string }> {
  try {
    writeDeviceCodeStatus(
      `${new Date().toISOString()} Starting device code authorization for ${moduleId}`,
    );

    const deviceCodeResult = await getDeviceCode(
      baseUrl,
      tenant,
      basicAuth,
      moduleId,
    );
    if (!deviceCodeResult.data || deviceCodeResult.error) {
      const errorMsg = 'Failed to get device code';
      writeDeviceCodeStatus(`${new Date().toISOString()} ${errorMsg}`);
      return { err: deviceCodeResult.error, errMsg: errorMsg };
    }

    const deviceCodeData = deviceCodeResult.data;
    writeDeviceCodeStatus(
      `${new Date().toISOString()} Please authorize using this URL: ${deviceCodeData.verification_uri_complete}`,
    );

    logger.info(
      'Device code obtained. Please visit:',
      deviceCodeData.verification_uri_complete,
    );
    logger.info('User code:', deviceCodeData.user_code);

    const tokenResult = await pollForToken(
      baseUrl,
      tenant,
      basicAuth,
      deviceCodeData.device_code,
      deviceCodeData.interval,
      deviceCodeData.expires_in,
    );

    if (!tokenResult.data || tokenResult.error) {
      const errorMsg = 'Authorization failed or timed out';
      writeDeviceCodeStatus(`${new Date().toISOString()} ${errorMsg}`);
      return { err: tokenResult.error, errMsg: errorMsg };
    }

    writeDeviceCodeStatus(
      `${new Date().toISOString()} Authorization successful`,
    );
    logger.info('Device code authorization successful');

    const authData = tokenResult.data;
    const getAccessTokenForModule = async () => authData.access_token;
    startModuleConfigPolling(baseUrl, getAccessTokenForModule);

    return { authData: tokenResult.data, err: null };
  } catch (error: any) {
    const errorMsg = `Device code authorization error: ${error.message}`;
    writeDeviceCodeStatus(`${new Date().toISOString()} ${errorMsg}`);
    logger.error(errorMsg, error);
    return { err: error, errMsg: errorMsg };
  }
}

let _internalCredentials: { user: string | null; password: string | null } = {
  user: null,
  password: null,
};

export function setInternalCredentials(user: string, password: string) {
  _internalCredentials = { user, password };
  DEBUG && logger.debug('Internal credentials set', { user });
}

export async function savePasswordForUser(user: string, password: string) {
  await keytar.setPassword('OrderingStack', user, password);
  DEBUG && logger.debug('Password saved for user', { user });
}

async function getPassword(user: string) {
  if (_internalCredentials.user === user) {
    return _internalCredentials.password;
  }
  const password = await keytar.getPassword('OrderingStack', user);
  return password;
}

export async function checkAndOptionallyAskForCredentials(
  userName: string,
  _authDataProviderCallbackAsync: () => Promise<any>,
) {
  let token = null;
  do {
    logger.info(`Authorization with user: ${userName}...`);
    const authResult = await _authDataProviderCallbackAsync();
    const access_token = authResult ? authResult.access_token : null;
    if (!access_token) {
      logger.warn('Authorization failed.');
      const r = await inquirer.prompt([
        {
          type: 'password',
          name: 'secret',
          message: `Enter password for [${userName}]:`,
        },
      ]);
      if (r.secret) {
        await savePasswordForUser(userName, r.secret);
      }
    } else {
      token = access_token;
      logger.info('Auth OK');
    }
  } while (!token);
  return token;
}

export const getModuleConfig = () => {
  return getModuleConfigFromCache();
};

export const stopModuleConfigPolling = () => {
  stopPolling();
};

export const cleanup = () => {
  stopPolling();
  DEBUG && logger.debug('Authorization cleanup called');
};
