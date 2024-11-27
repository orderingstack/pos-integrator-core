import axios from 'axios';
import keytar from 'keytar';
import inquirer from 'inquirer';
import { logger } from './logger';
import {
  AuthData,
  GetDeviceCodeResponse,
  ModuleConfig,
  PollForTokenResponse,
} from './types';

export const authorizeWithPassword = async (
  baseUrl: string,
  tenant: string,
  basicAuthPass: string,
  username: string,
) => {
  const password = await getPassword(username);
  let response = null;
  try {
    response = await axios({
      method: 'post',
      url: `${baseUrl}/auth-oauth2/oauth/token`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        Authorization: `Basic ${basicAuthPass}`,
        'X-Tenant': tenant,
      },
      data: `username=${encodeURIComponent(
        username,
      )}&password=${encodeURIComponent(
        password!,
      )}&grant_type=password&scope=read`,
    });
    //@ts-ignore
    const authData: AuthData = response.data;
    return {
      authData,
      err: null,
    };
  } catch (error: any) {
    const errorMessage =
      error?.response?.data?.error_description || 'unknown error';
    logger.error(`Authorization error: ${errorMessage}`);
    //logger.error(error.response)
    return {
      err: error.response ? error.response.status : error,
      errMsg: error.response
        ? error.response.statusText + ' ' + error.response.status
        : '',
    };
  }
};

export const authorize = async (
  baseUrl: string,
  tenant: string,
  basicAuthPass: string,
  username: string,
  moduleId?: string,
): Promise<{ authData?: AuthData; err?: any; errMsg?: string }> => {
  if (moduleId) {
    const { data, error } = await authorizeWithDeviceCode(
      baseUrl,
      tenant,
      basicAuthPass,
      moduleId,
    );
    if (error || !data) {
      return { err: error, errMsg: error.message };
    }
    return { authData: data };
  }
  const res = await authorizeWithPassword(
    baseUrl,
    tenant,
    basicAuthPass,
    username,
  );
  return res;
};

let _internalCredentials: { user: string | null; password: string | null } = {
  user: null,
  password: null,
};
export function setInternalCredentials(user: string, password: string) {
  _internalCredentials = {
    user,
    password,
  };
}

export async function savePasswordForUser(user: string, password: string) {
  await keytar.setPassword('OrderingStack', user, password);
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
        savePasswordForUser(userName, r.secret);
      }
    } else {
      //getInfoAboutLoggedUser()
      token = access_token;
      logger.info('Auth OK');
    }
  } while (!token);
  return token;
}

const refreshStorageHandler = {
  SERVICE: 'OrderingStack',
  ACCOUNT: 'refreshToken',
  getRefreshToken: () =>
    keytar.getPassword(
      refreshStorageHandler.SERVICE,
      refreshStorageHandler.ACCOUNT,
    ),
  setRefreshToken: (token: string) => {
    keytar.setPassword(
      refreshStorageHandler.SERVICE,
      refreshStorageHandler.ACCOUNT,
      token,
    );
  },
  clearRefreshToken: () => {
    keytar.deletePassword(
      refreshStorageHandler.SERVICE,
      refreshStorageHandler.ACCOUNT,
    );
  },
};

async function getDeviceCode(
  baseUrl: string,
  basicAuth: string,
  tenantId: string,
  moduleId: string,
) {
  try {
    const response = await axios.post(
      `${baseUrl}/auth-oauth2/oauth/device`,
      {
        module: moduleId,
      },
      {
        headers: {
          Accept: 'application/json',
          'X-Tenant': tenantId,
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basicAuth}`,
        },
      },
    );
    return response.data as GetDeviceCodeResponse;
  } catch (error) {
    console.error('Failed to get device code:', error);
  }
}

async function pollForToken(
  baseUrl: string,
  basicAuth: string,
  tenantId: string,
  deviceCode: string,
  expiresIn: number,
  interval: number,
) {
  const exp = Date.now() + expiresIn * 1000;

  while (Date.now() < exp - 2000) {
    try {
      const response = await axios.post(
        `${baseUrl}/auth-oauth2/oauth/token`,
        {
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        },
        {
          headers: {
            Accept: 'application/json',
            'X-Tenant': tenantId,
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${basicAuth}`,
          },
          validateStatus: (status) => status < 500,
        },
      );

      const tokenData = response.data as PollForTokenResponse;
      console.log('pollForToken response', tokenData);

      if ('access_token' in tokenData) {
        refreshStorageHandler.setRefreshToken(tokenData.refresh_token);
        return tokenData;
      } else if (tokenData.error === 'slow_down') {
        await new Promise((resolve) =>
          setTimeout(resolve, interval * 2 * 1000),
        );
      } else if (tokenData.error === 'authorization_pending') {
        await new Promise((resolve) => setTimeout(resolve, interval * 1000));
      }
    } catch (error) {
      console.error('Token polling error, retrying...', error);
      await new Promise((resolve) => setTimeout(resolve, interval * 1000));
    }
  }

  console.log('Authorization timed out or failed.');
  return null;
}

async function getModuleConfig(baseUrl: string, accessToken: string) {
  try {
    const response = await axios.get(`${baseUrl}/auth-api/api/module-config`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.data as ModuleConfig;
  } catch (error) {
    console.warn('Failed to get module config:', error);
  }
  return null;
}

export async function deviceCodeAuthFlow(
  baseUrl: string,
  basicAuth: string,
  tenantId: string,
  moduleId: string,
) {
  try {
    const deviceCodeData = await getDeviceCode(
      baseUrl,
      basicAuth,
      tenantId,
      moduleId,
    );
    console.log('Device code data:', deviceCodeData);
    if (deviceCodeData) {
      console.log(
        `Please authorize: ${deviceCodeData.verification_uri_complete}`,
      );

      const tokenData = await pollForToken(
        baseUrl,
        basicAuth,
        tenantId,
        deviceCodeData.device_code,
        deviceCodeData.expires_in,
        deviceCodeData.interval,
      );

      if (tokenData && tokenData.access_token) {
        console.log('Authentication successful!');
        const moduleConfig = await getModuleConfig(
          baseUrl,
          tokenData.access_token,
        );
        console.log('Module config:', moduleConfig);
        return { error: null, data: tokenData };
      } else {
        console.log('Authorization timed out or failed.');
      }
    }
    return { data: null, error: new Error('Device code auth flow failed') };
  } catch (error: any) {
    console.error('Device code auth flow error:', error);
    return { data: null, error };
  }
}

export const authorizeWithDeviceCode = async (
  baseUrl: string,
  tenant: string,
  basicAuthPass: string,
  moduleId: string,
) => {
  const refreshToken = await refreshStorageHandler.getRefreshToken();
  console.log('Refresh token:', refreshToken);
  if (refreshToken) {
    const authData = await refreshTokenF(
      baseUrl,
      basicAuthPass,
      tenant,
      refreshToken,
    );
    if (authData) {
      refreshStorageHandler.setRefreshToken(authData.refresh_token);
      return { data: authData, error: null };
    }
  }
  return await deviceCodeAuthFlow(baseUrl, basicAuthPass, tenant, moduleId);
};

async function refreshTokenF(
  baseUrl: string,
  basicAuth: string,
  tenantId: string,
  refreshToken: string,
): Promise<AuthData | undefined> {
  try {
    const response = await axios.post<AuthData>(
      `${baseUrl}/auth-oauth2/oauth/token`,
      {
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          Authorization: `Basic ${basicAuth}`,
          'X-Tenant': tenantId,
        },
      },
    );
    return response.data;
  } catch (error) {
    console.error('Failed to refresh token:', error);
    return undefined;
  }
}
