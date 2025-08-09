import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

const logDir = path.join(process.cwd(), 'logs');

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    if (meta && Object.keys(meta).length > 0) {
      if (meta.stack) {
        logMessage += `\n${meta.stack}`;
      } else {
        logMessage += ` ${JSON.stringify(meta)}`;
      }
    }
    
    return logMessage;
  })
);

const fileRotateTransport = new DailyRotateFile({
  filename: path.join(logDir, 'server-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: logFormat
});

const errorFileRotateTransport = new DailyRotateFile({
  filename: path.join(logDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  level: 'error',
  format: logFormat
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    fileRotateTransport,
    errorFileRotateTransport,
    new winston.transports.File({
      filename: 'server.log',
      maxsize: 10485760,
      maxFiles: 5,
      format: logFormat
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let logMessage = `${timestamp} ${level}: ${message}`;
        if (meta && Object.keys(meta).length > 0 && !meta.stack) {
          logMessage += ` ${JSON.stringify(meta)}`;
        }
        if (meta.stack) {
          logMessage += `\n${meta.stack}`;
        }
        return logMessage;
      })
    )
  }));
}

export default logger;

export function logRequest(req: any, processingTime?: number) {
  const logData: any = {
    method: req.method,
    url: req.url,
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('user-agent')
  };
  
  if (processingTime !== undefined) {
    logData.processingTime = `${processingTime}ms`;
  }
  
  if (req.body && req.url === '/compress') {
    logData.format = req.body.format || 'mozjpeg';
    logData.hasResize = !!req.body.resize?.enabled;
    if (req.body.image) {
      logData.imageSize = `${(req.body.image.length * 0.75 / 1024).toFixed(2)}KB`;
    }
  }
  
  logger.info(`Request: ${req.method} ${req.url}`, logData);
}

export function logError(error: Error, context?: any) {
  logger.error(`Error: ${error.message}`, {
    stack: error.stack,
    ...context
  });
}

export function logPerformance(operation: string, duration: number, metadata?: any) {
  logger.info(`Performance: ${operation}`, {
    duration: `${duration}ms`,
    ...metadata
  });
}