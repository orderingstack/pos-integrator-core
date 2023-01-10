let logger = {
   debug:(...args)=> {console.log('debug: '+args[0])},
   info:(...args)=> {console.log('info: '+args[0])},
   warn:(...args)=> {console.log('warn: '+args[0])},
   error:(...args)=> {console.error('error: '+args[0])},
   child:(attrs)=>{return logger;},
   trackMetric:(...args)=>{},
   trackEvent:(...args)=>{}
}

function setLogger(newLogger) {
  //console.log('--- setting new logger:  '+newLogger);
  logger.debug = (...args)=>{if (logger!=newLogger) newLogger.debug(...args)}  
  logger.info = (...args)=>{if (logger!=newLogger) newLogger.info(...args)}  
  logger.warn = (...args)=>{if (logger!=newLogger) newLogger.debug(...args)}  
  logger.error = (...args)=>{if (logger!=newLogger) newLogger.error(...args)}
  if (typeof newLogger.child === "function" && logger!=newLogger) {
    logger.child = (arg)=>{return newLogger.child(arg)}
  }    
  if (typeof newLogger.trackMetric === "function" && logger!=newLogger) {
    logger.trackMetric = (...args)=>{newLogger.trackMetric(...args)}
  }    
  if (typeof newLogger.trackEvent === "function" && logger!=newLogger) {
    logger.trackEvent = (...args)=>{newLogger.trackEvent(...args)}
  }    
}

module.exports = {
  logger,
  setLogger
}