import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

let logDir = '';
try {
  logDir = path.join(app.getPath('userData'), 'logs');
} catch {
  // Fallback for non-electron environment (e.g. testing or scripting outside Electron main)
  logDir = path.join(process.cwd(), 'logs');
}

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: logFormat,
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, module, ...meta }) => {
          const modStr = module ? `[${module}] ` : '';
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} [${level}] ${modStr}${message}${metaStr}`;
        })
      ),
    })
  );
}

export function createModuleLogger(moduleName: string) {
  return {
    info: (msg: string, meta?: any) => logger.info(msg, { module: moduleName, ...meta }),
    warn: (msg: string, meta?: any) => logger.warn(msg, { module: moduleName, ...meta }),
    error: (msg: string, meta?: any) => logger.error(msg, { module: moduleName, ...meta }),
    debug: (msg: string, meta?: any) => logger.debug(msg, { module: moduleName, ...meta }),
  };
}
