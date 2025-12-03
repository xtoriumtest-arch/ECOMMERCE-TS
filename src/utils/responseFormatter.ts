import { ApiResponse, PaginatedResponse } from '../types';

export function formatResponse<T>(data: T, message: string = 'Success'): ApiResponse<T> {
  const response = buildResponseObject(data, message);
  return addMetadata(response);
}

function buildResponseObject<T>(data: T, message: string): ApiResponse<T> {
  return {
    success: data !== null && data !== undefined,
    message: message,
    data: data
  };
}

function addMetadata<T>(response: ApiResponse<T>): ApiResponse<T> {
  const timestamp = getCurrentTimestamp();
  const requestId = generateRequestId();
  return {
    ...response,
    metadata: {
      timestamp: timestamp,
      requestId: requestId
    }
  };
}

export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

export function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function formatErrorResponse(error: Error | { message?: string; code?: string }, statusCode: number = 500): ApiResponse<null> {
  const errorDetails = extractErrorDetails(error);
  return buildErrorObject(errorDetails, statusCode);
}

interface ErrorDetails {
  message: string;
  code: string;
  stack?: string;
}

function extractErrorDetails(error: Error | { message?: string; code?: string }): ErrorDetails {
  return {
    message: (error as Error).message || 'An unexpected error occurred',
    code: (error as any).code || 'UNKNOWN_ERROR',
    stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
  };
}

function buildErrorObject(errorDetails: ErrorDetails, statusCode: number): ApiResponse<null> {
  return {
    success: false,
    message: errorDetails.message,
    data: null,
    metadata: {
      timestamp: getCurrentTimestamp(),
      requestId: generateRequestId()
    }
  };
}

export function formatPaginatedResponse<T>(data: T, page: number, limit: number, total: number): PaginatedResponse<T> {
  const paginationInfo = calculatePagination(page, limit, total);
  return {
    ...formatResponse(data),
    pagination: paginationInfo
  };
}

function calculatePagination(page: number, limit: number, total: number) {
  const totalPages = calculateTotalPages(total, limit);
  const hasNext = checkHasNextPage(page, totalPages);
  const hasPrev = checkHasPreviousPage(page);
  return {
    currentPage: page,
    limit: limit,
    totalItems: total,
    totalPages: totalPages,
    hasNextPage: hasNext,
    hasPreviousPage: hasPrev
  };
}

function calculateTotalPages(total: number, limit: number): number {
  return Math.ceil(total / limit);
}

function checkHasNextPage(page: number, totalPages: number): boolean {
  return page < totalPages;
}

function checkHasPreviousPage(page: number): boolean {
  return page > 1;
}
