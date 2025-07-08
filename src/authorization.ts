import axios from 'axios';
import keytar from 'keytar';
import inquirer from 'inquirer';
import { logger } from './logger';

export const authorize = async (
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
    return {
      authData: response.data,
      err: null,
    };
  } catch (error: any) {
    const errorMessage =
      error?.response?.data?.error_description || 'unknown error';
    logger.error(`Authorization error: ${errorMessage}`);
    //logger.error(error.response)
    return {
      authData: {},
      err: error.response ? error.response.status : error,
      errMsg: error.response
        ? error.response.statusText + ' ' + error.response.status
        : '',
    };
  }
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

/*async function getInfoAboutLoggedUser(baseUrl, tenant, accessToken) => {
    const    response = await axios({
            method: 'get',
            url: `${baseUrl}/auth-api/api/me`,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            }
        });
        return response.data,
} */

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

export enum AlertSeverity {
  DEBUG,
  INFO,
  WARN,
  ERROR,
  CRITICAL,
}

export async function sendAlertMessage(
  accessToken: string,
  message: {
    source: string;
    eventName: string;
    severity: AlertSeverity;
    dateTime?: string;
    user?: string;
    tenant?: string;
    orderId?: string;
    venues?: string[];
    params?: Record<string, string>;
  },
) {
  if (!message.dateTime) message.dateTime = new Date().toISOString();
  try {
    const response = await axios.post(
      `${process.env.BASE_URL}/alert-service/message`,
      message,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    return { data: response.data };
  } catch (error) {
    return {
      data: null,
      error: error,
    };
  }
}
