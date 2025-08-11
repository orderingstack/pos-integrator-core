import { getModuleConfig } from './authorization';
import { logger } from './logger';

export const getConfigValue = (key: string) => {
  //@ts-ignore
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
