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
  logger.debug = newLogger.debug;
  logger.info = newLogger.info;

  logger.warn = newLogger.warn;
  logger.error = newLogger.error;
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
    logger.trackMetric = newLogger.trackMetric;
  }
  if (typeof newLogger.trackEvent === 'function' && logger != newLogger) {
    logger.trackEvent = newLogger.trackEvent;
  }
}
