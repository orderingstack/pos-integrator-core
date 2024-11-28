import { getModuleConfig } from './authorization';

export const getConfigValue = (key: string) => {
  const { config } = getModuleConfig() || {};
  return config?.[key] || process.env[key];
};
