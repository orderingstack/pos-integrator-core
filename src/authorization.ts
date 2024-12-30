import axios from 'axios';
import keytar from 'keytar';
import * as fs from 'fs';
import * as path from 'path';
import inquirer from 'inquirer';
import { logger } from './logger';

import {
  AuthData,
  GetDeviceCodeResponse,
  ModuleConfig,
  PollForTokenResponse,
  PollForTokenResponseSuccess,
} from './types';

interface ModuleData {
  moduleId: string;
  eventHandlerCallback?: (
    event:
      | { type: 'AUTHORIZATION_NEED'; data: GetDeviceCodeResponse }
      | { type: 'AUTHORIZATION_SUCCESS'; data: AuthData }
      | { type: 'AUTHORIZATION_FAILED'; data: any },
  ) => void;
}

class AuthService {
  private readonly service = 'OrderingStack';
  private refreshAccount = '';
  private accessToken: string | null = null;
  private accessTokenExpiresAt: number | null = null;
  private baseUrl: string | null = null;
  private tenantId: string | null = null;
  private basicAuth: string | null = null;
  private username: string | null = null;
  private moduleData: ModuleData | null = null;
  private moduleConfig: ModuleConfig | null = null;
  private fetchModuleConfigIntervalId: NodeJS.Timeout | null = null;

  private internalCredentials = {
    user: null as string | null,
    password: null as string | null,
  };

  initialize(
    baseUrl: string,
    tenantId: string,
    basicAuthPass: string,
    username: string,
    moduleData?: ModuleData,
  ) {
    this.baseUrl = baseUrl;
    this.tenantId = tenantId;
    this.basicAuth = basicAuthPass;
    this.username = username;
    this.moduleData = moduleData || null;
    const moduleId = moduleData?.moduleId;
    if (moduleId) this.refreshAccount = `${moduleId}-refresh-token`;
  }

  async authorize(
    baseUrl: string,
    tenantId: string,
    basicAuthPass: string,
    username: string,
    moduleData?: ModuleData,
  ): Promise<{ authData?: AuthData; err?: any; errMsg?: string }> {
    this.initialize(baseUrl, tenantId, basicAuthPass, username, moduleData);
    if (moduleData) {
      logger.info(
        `Authorization with device code for module: ${moduleData.moduleId}...`,
      );
      const { data, error } = await this.authorizeWithDeviceCode();
      if (error) return { err: error, errMsg: error.message };
      this.accessToken = data?.access_token;
      this.accessTokenExpiresAt = Date.now() + data?.expires_in * 1000;
      await this.startModuleConfigPolling();
      return { authData: data };
    } else {
      const res = await this.authorizeWithPassword();
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
      this.moduleData!,
    );
    return this.accessToken!;
  }

  async authorizeWithPassword(): Promise<{
    authData?: AuthData;
    err?: any;
    errMsg?: string;
  }> {
    const password = await this.getPassword(this.username!);
    try {
      const response = await axios.post(
        `${this.baseUrl}/auth-oauth2/oauth/token`,
        `username=${encodeURIComponent(
          this.username!,
        )}&password=${encodeURIComponent(
          password!,
        )}&grant_type=password&scope=read`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            Authorization: `Basic ${this.basicAuth}`,
            'X-Tenant': this.tenantId!,
          },
        },
      );
      return { authData: response.data as AuthData, err: null };
    } catch (error: any) {
      const errMsg = error?.response?.statusText || 'unknown error';
      console.error(`Authorization error`, error);
      logger.error(`Authorization error: ${errMsg}`);
      return {
        err: error.response?.status || error,
        errMsg: error.response ? `${errMsg} ${error.response.status}` : '',
      };
    }
  }

  async authorizeWithDeviceCode() {
    const refreshToken = await this.getRefreshToken();
    if (refreshToken) {
      const { data } = await this.refreshToken(refreshToken);
      if (data) {
        await this.setRefreshToken(data.refresh_token);
        return { data, error: null };
      }
      logger.error(`authorizeWithDeviceCode error refreshing token`);
    }
    return this.deviceCodeAuthFlow();
  }

  private async refreshToken(refreshToken: string) {
    try {
      const response = await axios.post<AuthData>(
        `${this.baseUrl}/auth-oauth2/oauth/token`,
        {
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            Authorization: `Basic ${this.basicAuth}`,
            'X-Tenant': this.tenantId!,
          },
        },
      );
      return { data: response.data };
    } catch (error) {
      return { error };
    }
  }

  async deviceCodeAuthFlow(): Promise<
    | {
        data: null;
        error: Error;
      }
    | {
        data: PollForTokenResponseSuccess;
        error: null;
      }
  > {
    const { data: getDeviceCodeData, error: getDeviceCodeError } =
      await this.getDeviceCode();
    if (!getDeviceCodeData || getDeviceCodeError) {
      console.error(
        'Device code auth flow failed, stage getDeviceCode',
        getDeviceCodeError,
      );
      this.moduleData?.eventHandlerCallback?.({
        type: 'AUTHORIZATION_FAILED',
        data: new Error('Authorization failed'),
      });
      if (!this.moduleData?.eventHandlerCallback)
        this.saveToDeviceCodeAuthFile(
          `${new Date().toISOString()} AUTHORIZATION_FAILED`,
        );
      return { data: null, error: new Error('Device code auth flow failed') };
    }
    logger.info('Device code auth flow getDeviceCodeData', getDeviceCodeData);
    this.moduleData?.eventHandlerCallback?.({
      type: 'AUTHORIZATION_NEED',
      data: getDeviceCodeData,
    });
    if (!this.moduleData?.eventHandlerCallback)
      this.saveToDeviceCodeAuthFile(
        `${new Date().toISOString()} Please authorize using this url: ${
          getDeviceCodeData.verification_uri_complete
        }`,
      );

    const { data: pollForTokenData, error: pollForTokenError } =
      await this.pollForToken(
        getDeviceCodeData.device_code,
        getDeviceCodeData.expires_in,
        getDeviceCodeData.interval,
      );
    if (pollForTokenError?.message === 'POLL_FOR_TOKEN_TIMEOUT') {
      logger.info('deviceCodeAuthFlow POLL_FOR_TOKEN_TIMEOUT, retrying...');
      return await this.deviceCodeAuthFlow();
    }

    if (!pollForTokenData?.access_token) {
      this.moduleData?.eventHandlerCallback?.({
        type: 'AUTHORIZATION_FAILED',
        data: new Error('Authorization failed'),
      });
      if (!this.moduleData?.eventHandlerCallback)
        this.saveToDeviceCodeAuthFile(
          `${new Date().toISOString()} AUTHORIZATION_FAILED`,
        );
      return { data: null, error: new Error('Authorization failed') };
    }

    this.moduleData?.eventHandlerCallback?.({
      type: 'AUTHORIZATION_SUCCESS',
      data: pollForTokenData,
    });
    if (!this.moduleData?.eventHandlerCallback)
      this.saveToDeviceCodeAuthFile(
        `${new Date().toISOString()} AUTHORIZATION_SUCCESS`,
      );

    return { data: pollForTokenData, error: null };
  }

  private async getDeviceCode() {
    try {
      const response = await axios.post<GetDeviceCodeResponse>(
        `${this.baseUrl}/auth-oauth2/oauth/device`,
        { module: this.moduleData?.moduleId },
        {
          headers: {
            Accept: 'application/json',
            'X-Tenant': this.tenantId!,
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${this.basicAuth}`,
          },
        },
      );
      return { data: response.data };
    } catch (error) {
      return { error };
    }
  }

  private async pollForToken(
    deviceCode: string,
    expiresIn: number,
    interval: number,
  ) {
    const expiry = Date.now() + expiresIn * 1000;
    while (Date.now() < expiry - 2000) {
      try {
        const response = await axios.post<PollForTokenResponse>(
          `${this.baseUrl}/auth-oauth2/oauth/token`,
          {
            device_code: deviceCode,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          },
          {
            headers: {
              Accept: 'application/json',
              'X-Tenant': this.tenantId!,
              'Content-Type': 'application/x-www-form-urlencoded',
              Authorization: `Basic ${this.basicAuth}`,
            },
          },
        );

        if ('access_token' in response.data) {
          await this.setRefreshToken(response.data.refresh_token);
          return { data: response.data };
        }
      } catch (error: any) {
        if (error?.response?.data.error === 'slow_down') {
          logger.info('pollForToken slow_down', error?.response?.data);
          await this.delay(interval * 1000);
        } else if (error?.response?.data.error === 'authorization_pending') {
          /* do nothing */
        } else {
          console.error('pollForToken error', error?.response?.data);
        }
        await this.delay(interval * 1000);
      }
    }
    return { error: new Error('POLL_FOR_TOKEN_TIMEOUT') };
  }

  async fetchModuleConfig() {
    try {
      const accessToken = await this.getAccessToken();
      const response = await axios.get<ModuleConfig>(
        `${this.baseUrl}/auth-api/api/module-config`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      this.moduleConfig = response.data;
      return { data: this.moduleConfig };
    } catch (error) {
      logger.error('Failed to get module config', error);
      return { error };
    }
  }

  async startModuleConfigPolling() {
    if (!this.baseUrl || !this.accessToken || !this.moduleData) {
      return;
    }
    if (this.fetchModuleConfigIntervalId) {
      return;
    }
    this.fetchModuleConfigIntervalId = setInterval(
      () => {
        this.fetchModuleConfig();
      },
      Number(process.env.MODULE_CONFIG_FETCHING_INTERVAL_SEC || '300') * 1000,
    );

    await this.fetchModuleConfig();
  }

  getModuleConfig() {
    return this.moduleConfig;
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

  private saveToDeviceCodeAuthFile = (content: string): void => {
    const dataDir = path.join(process.cwd(), 'data');
    const filePath = path.join(dataDir, 'device-code-auth.txt');
    console.log(`saveToDeviceCodeAuthFile ${filePath} ${content}`);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir);
    }
    fs.writeFileSync(filePath, content, 'utf8');
  };
}

export const authService = new AuthService();
export const authorize = authService.authorize.bind(authService);
export const getAccessToken = authService.getAccessToken.bind(authService);
export const getModuleConfig = authService.getModuleConfig.bind(authService);
export const setInternalCredentials =
  authService.setInternalCredentials.bind(authService);
export const checkAndOptionallyAskForCredentials =
  authService.checkAndOptionallyAskForCredentials.bind(authService);
