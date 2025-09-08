import axios from 'axios';
import { getModuleConfig } from './authorization';
import { logger } from './logger';

export const getConfigValue = (key: string) => {
  const { config } = getModuleConfig() || {};
  return config?.[key] || process.env[key];
};

export const logError = (error: any) => {
  if (error.response) {
    const requestMethod = error.response.config.method.toUpperCase();
    const requestUrl = error.response.config.url;
    const requestData = error.response.config.data;
    const requestHeaders = error.response.config.headers;
    const responseStatus = error.response.status;
    const responseData = error.response.data;
    logger.error(
      `Error: ${error.message} ${responseStatus}, ${requestMethod} ${requestUrl}`,
      {
        requestMethod,
        requestUrl,
        requestData,
        requestHeaders,
        responseStatus,
        responseData,
      },
    );
  } else {
    logger.error(`Error: ${error.message}`, error);
  }
};

export const AlertSeverity = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  CRITICAL: 4,
} as const;

export type AlertSeverity = typeof AlertSeverity[keyof typeof AlertSeverity];

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
