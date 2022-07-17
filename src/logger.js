let logger = {
   debug:(...args)=> {console.log('debug: '+args[0])},
   info:(...args)=> {console.log('info: '+args[0])},
   warn:(...args)=> {console.log('warn: '+args[0])},
   error:(...args)=> {console.error('error: '+args[0])},
}

function setLogger(newLogger) {
  //console.log('--- setting new logger:  '+newLogger);
  logger.debug = (...args)=>{newLogger.debug(...args)}  
  logger.info = (...args)=>{newLogger.info(...args)}  
  logger.warn = (...args)=>{newLogger.debug(...args)}  
  logger.error = (...args)=>{newLogger.error(...args)}  
}

module.exports = {
  logger,
  setLogger
}