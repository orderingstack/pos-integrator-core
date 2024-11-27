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

class AuthService {
  private readonly service = 'OrderingStack';
  private readonly refreshAccount = 'refreshToken';
  private accessToken: string | null = null;
  private accessTokenExpiresAt: number | null = null;
  private baseUrl: string | null = null;
  private tenantId: string | null = null;
  private basicAuth: string | null = null;
  private username: string | null = null;
  private moduleId: string | null = null;

  private internalCredentials = {
    user: null as string | null,
    password: null as string | null,
  };

  initialize(
    baseUrl: string,
    tenantId: string,
    basicAuthPass: string,
    username: string,
    moduleId?: string,
  ) {
    this.baseUrl = baseUrl;
    this.tenantId = tenantId;
    this.basicAuth = basicAuthPass;
    this.username = username;
    this.moduleId = moduleId || null;
  }

  async authorize(
    baseUrl: string,
    tenantId: string,
    basicAuthPass: string,
    username: string,
    moduleId?: string,
  ): Promise<{ authData?: AuthData; err?: any; errMsg?: string }> {
    this.baseUrl = baseUrl;
    this.tenantId = tenantId;
    this.basicAuth = basicAuthPass;
    this.username = username;
    this.moduleId = moduleId || null;
    if (moduleId) {
      logger.info(`Authorization with device code for module: ${moduleId}...`);
      const { data, error } = await this.authorizeWithDeviceCode(
        baseUrl,
        tenantId,
        basicAuthPass,
        moduleId,
      );
      if (error) return { err: error, errMsg: error.message };
      this.accessToken = data?.access_token;
      this.accessTokenExpiresAt = Date.now() + data?.expires_in * 1000;
      return { authData: data };
    } else {
      const res = await this.authorizeWithPassword(
        baseUrl,
        tenantId,
        basicAuthPass,
        username,
      );
      if (res.authData) {
        this.accessToken = res.authData.access_token;
        this.accessTokenExpiresAt = Date.now() + res.authData.expires_in * 1000;
      }

      return res;
    }
  }

  async getAccessToken(): Promise<string> {
    const now = Date.now();
    const isTokenValid =
      this.accessToken &&
      this.accessTokenExpiresAt &&
      this.accessTokenExpiresAt - now > 5 * 60 * 1000;

    if (isTokenValid) {
      return this.accessToken!;
    }

    logger.info('Token expired or near expiry. Re-authorizing...');
    const isInitialized = this.baseUrl && this.tenantId && this.basicAuth;
    if (!isInitialized) {
      throw new Error('Authorization not initialized');
    }
    await this.authorize(
      this.baseUrl!,
      this.tenantId!,
      this.basicAuth!,
      this.username!,
      this.moduleId!,
    );
    return this.accessToken!;
  }

  async authorizeWithPassword(
    baseUrl: string,
    tenantId: string,
    basicAuthPass: string,
    username: string,
  ): Promise<{ authData?: AuthData; err?: any; errMsg?: string }> {
    const password = await this.getPassword(username);
    try {
      const response = await axios.post(
        `${baseUrl}/auth-oauth2/oauth/token`,
        null,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            Authorization: `Basic ${basicAuthPass}`,
            'X-Tenant': tenantId,
          },
          data: `username=${encodeURIComponent(
            username,
          )}&password=${encodeURIComponent(
            password!,
          )}&grant_type=password&scope=read`,
        },
      );
      return { authData: response.data as AuthData, err: null };
    } catch (error: any) {
      const errMsg = error?.response?.statusText || 'unknown error';
      logger.error(`Authorization error: ${errMsg}`);
      return {
        err: error.response?.status || error,
        errMsg: error.response ? `${errMsg} ${error.response.status}` : '',
      };
    }
  }

  setInternalCredentials(user: string, password: string) {
    this.internalCredentials = { user, password };
  }

  async savePasswordForUser(user: string, password: string) {
    await keytar.setPassword(this.service, user, password);
  }

  private async getPassword(user: string) {
    if (this.internalCredentials.user === user)
      return this.internalCredentials.password;
    return keytar.getPassword(this.service, user);
  }

  async checkAndOptionallyAskForCredentials(
    username: string,
    authCallback: () => Promise<any>,
  ) {
    let token = null;
    do {
      logger.info(`Authorization with user: ${username}...`);
      const authResult = await authCallback();
      const accessToken = authResult?.access_token;
      if (!accessToken) {
        logger.warn('Authorization failed.');
        const { secret } = await inquirer.prompt([
          {
            type: 'password',
            name: 'secret',
            message: `Enter password for [${username}]:`,
          },
        ]);
        if (secret) await this.savePasswordForUser(username, secret);
      } else {
        token = accessToken;
        logger.info('Auth OK');
      }
    } while (!token);
    return token;
  }

  private async getRefreshToken() {
    return keytar.getPassword(this.service, this.refreshAccount);
  }

  private async setRefreshToken(token: string) {
    await keytar.setPassword(this.service, this.refreshAccount, token);
  }

  private async clearRefreshToken() {
    await keytar.deletePassword(this.service, this.refreshAccount);
  }

  private async getDeviceCode(
    baseUrl: string,
    basicAuth: string,
    tenantId: string,
    moduleId: string,
  ) {
    const response = await axios.post<GetDeviceCodeResponse>(
      `${baseUrl}/auth-oauth2/oauth/device`,
      { module: moduleId },
      {
        headers: {
          Accept: 'application/json',
          'X-Tenant': tenantId,
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basicAuth}`,
        },
      },
    );
    return response.data;
  }

  private async pollForToken(
    baseUrl: string,
    basicAuth: string,
    tenantId: string,
    deviceCode: string,
    expiresIn: number,
    interval: number,
  ) {
    const expiry = Date.now() + expiresIn * 1000;
    while (Date.now() < expiry - 2000) {
      try {
        const response = await axios.post<PollForTokenResponse>(
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
          },
        );

        if ('access_token' in response.data) {
          await this.setRefreshToken(response.data.refresh_token);
          return response.data;
        }

        if (response.data.error === 'slow_down') {
          await this.delay(interval * 2 * 1000);
        } else if (response.data.error === 'authorization_pending') {
          await this.delay(interval * 1000);
        }
      } catch {
        await this.delay(interval * 1000);
      }
    }
    return null;
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async getModuleConfig(baseUrl: string, accessToken: string) {
    const response = await axios.get<ModuleConfig>(
      `${baseUrl}/auth-api/api/module-config`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    return response.data;
  }

  async deviceCodeAuthFlow(
    baseUrl: string,
    basicAuth: string,
    tenantId: string,
    moduleId: string,
  ) {
    const deviceCodeData = await this.getDeviceCode(
      baseUrl,
      basicAuth,
      tenantId,
      moduleId,
    );
    if (!deviceCodeData)
      return { data: null, error: new Error('Device code auth flow failed') };

    console.log(
      `Please authorize: ${deviceCodeData.verification_uri_complete}`,
    );
    const tokenData = await this.pollForToken(
      baseUrl,
      basicAuth,
      tenantId,
      deviceCodeData.device_code,
      deviceCodeData.expires_in,
      deviceCodeData.interval,
    );

    if (!tokenData?.access_token)
      return { data: null, error: new Error('Authorization failed') };

    const moduleConfig = await this.getModuleConfig(
      baseUrl,
      tokenData.access_token,
    );
    console.log('Module config:', moduleConfig);
    return { data: tokenData, error: null };
  }

  async authorizeWithDeviceCode(
    baseUrl: string,
    tenantId: string,
    basicAuthPass: string,
    moduleId: string,
  ) {
    const refreshToken = await this.getRefreshToken();
    if (refreshToken) {
      const authData = await this.refreshToken(
        baseUrl,
        basicAuthPass,
        tenantId,
        refreshToken,
      );
      if (authData) {
        await this.setRefreshToken(authData.refresh_token);
        return { data: authData, error: null };
      }
    }
    return this.deviceCodeAuthFlow(baseUrl, basicAuthPass, tenantId, moduleId);
  }

  private async refreshToken(
    baseUrl: string,
    basicAuth: string,
    tenantId: string,
    refreshToken: string,
  ) {
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
    } catch {
      return undefined;
    }
  }
}

export const authService = new AuthService();
export const authorize = authService.authorize.bind(authService);
