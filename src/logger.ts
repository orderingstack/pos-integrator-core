import { Logger } from 'winston';

export let logger = {
  debug: (...args: any[]) => {
    console.log('debug: ' + args[0]);
  },
  info: (...args: any[]) => {
    console.log('info: ' + args[0]);
  },
  warn: (...args: any[]) => {
    console.log('warn: ' + args[0]);
  },
  error: (...args: any[]) => {
    console.error('error: ' + args[0]);
  },
  child: (attrs: any) => {
    return logger;
  },
  trackMetric: (...args: any[]) => {},
  trackEvent: (...args: any[]) => {},
};

export function setLogger(
  newLogger: Logger & {
    trackMetric?: (...args: any[]) => {};
    trackEvent?: (...args: any[]) => {};
    child?: (attrs: any) => {};
  },
) {
  //console.log('--- setting new logger:  '+newLogger);
  // @ts-ignore
  logger.debug = (...args) => newLogger.debug(...args);
  // @ts-ignore
  logger.info = (...args) => newLogger.info(...args);
  // @ts-ignore
  logger.warn = (...args) => newLogger.warn(...args);
  // @ts-ignore
  logger.error = (...args) => newLogger.error(...args);
  if (
    newLogger.child &&
    typeof newLogger.child === 'function' &&
    logger != newLogger
  ) {
    // @ts-ignore
    logger.child = (arg: any) => {
      return newLogger.child(arg);
    };
  }
  if (
    newLogger.trackMetric &&
    typeof newLogger.trackMetric === 'function' &&
    logger != newLogger
  ) {
    // @ts-ignore
    logger.trackMetric = (...args) => newLogger.trackMetric(...args);
  }
  if (typeof newLogger.trackEvent === 'function' && logger != newLogger) {
    // @ts-ignore
    logger.trackEvent = (...args) => newLogger.trackEvent(...args);
  }
}
