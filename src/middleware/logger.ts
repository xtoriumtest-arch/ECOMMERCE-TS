import { Request, Response, NextFunction } from 'express';

interface RequestInfo {
  method: string;
  url: string;
  timestamp: string;
  headers: {
    userAgent?: string;
    contentType?: string;
    authorization?: string;
  };
}

interface ErrorInfo {
  message: string;
  stack?: string;
  code?: string;
}

export function logRequest(req: Request, res: Response, next: NextFunction): void {
  const requestInfo = extractRequestInfo(req);
  const logEntry = formatLogEntry(requestInfo);
  writeLog(logEntry);
  next();
}

function extractRequestInfo(req: Request): RequestInfo {
  const method = req.method;
  const url = req.url;
  const timestamp = getRequestTimestamp();
  const headers = extractRelevantHeaders(req.headers);
  return { method, url, timestamp, headers };
}

function getRequestTimestamp(): string {
  return new Date().toISOString();
}

function extractRelevantHeaders(headers: any): RequestInfo['headers'] {
  return {
    userAgent: headers['user-agent'],
    contentType: headers['content-type'],
    authorization: headers['authorization'] ? '[REDACTED]' : undefined
  };
}

function formatLogEntry(info: RequestInfo): string {
  const formattedMethod = formatMethod(info.method);
  const formattedUrl = formatUrl(info.url);
  return `[${info.timestamp}] ${formattedMethod} ${formattedUrl}`;
}

function formatMethod(method: string): string {
  return method.toUpperCase().padEnd(7);
}

function formatUrl(url: string): string {
  return url.length > 100 ? truncateUrl(url) : url;
}

function truncateUrl(url: string): string {
  return url.substring(0, 97) + '...';
}

export function writeLog(logEntry: string): void {
  console.log(logEntry);
  appendToLogBuffer(logEntry);
}

const logBuffer: string[] = [];

function appendToLogBuffer(entry: string): void {
  logBuffer.push(entry);
  if (logBuffer.length > 1000) {
    flushLogBuffer();
  }
}

function flushLogBuffer(): void {
  logBuffer.length = 0;
}

export function logError(error: Error, req: Request): void {
  const errorInfo = extractErrorInfo(error);
  const requestInfo = extractRequestInfo(req);
  const errorLog = formatErrorLog(errorInfo, requestInfo);
  writeLog(errorLog);
}

function extractErrorInfo(error: Error): ErrorInfo {
  return {
    message: error.message,
    stack: error.stack,
    code: (error as any).code
  };
}

function formatErrorLog(errorInfo: ErrorInfo, requestInfo: RequestInfo): string {
  return `[ERROR] ${requestInfo.timestamp} - ${requestInfo.method} ${requestInfo.url} - ${errorInfo.message}`;
}
