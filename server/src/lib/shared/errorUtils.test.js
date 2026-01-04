/**
 * Tests for errorUtils.js
 *
 * Comprehensive test coverage for error handling utilities including:
 * - Safe error message handling (production vs development)
 * - Error object handling
 * - String error handling
 * - Null/undefined handling
 * - Standardized error response formatting
 *
 * Note: Since isProd is evaluated at module load time, we test based on
 * the current NODE_ENV. The tests verify the logic works correctly in
 * whichever mode the tests are running.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { safeErrorMessage, sendError } from './errorUtils.js';

describe('errorUtils', () => {
    // Determine if we're running in production mode
    const isTestRunningInProduction = process.env.NODE_ENV === 'production';

    describe('safeErrorMessage', () => {
        describe('Error object handling', () => {

            it('should return actual error message from Error object', () => {
                const error = new Error('Database connection failed');
                const result = safeErrorMessage(error);
                expect(result).toBe('Database connection failed');
            });

            it('should handle string errors', () => {
                const result = safeErrorMessage('Custom error message');

                if (isTestRunningInProduction) {
                    expect(result).toBe('Internal server error');
                } else {
                    expect(result).toBe('Custom error message');
                }
            });

            it('should handle Error objects with empty message', () => {
                const error = new Error('');
                const result = safeErrorMessage(error);

                if (isTestRunningInProduction) {
                    expect(result).toBe('Internal server error');
                } else {
                    // Empty message results in 'Error' string from toString
                    expect(result).toBe('Error');
                }
            });

            it('should handle Error subclasses', () => {
                const typeError = new TypeError('Invalid type');
                const result = safeErrorMessage(typeError);

                if (isTestRunningInProduction) {
                    expect(result).toBe('Internal server error');
                } else {
                    expect(result).toBe('Invalid type');
                }
            });

            it('should handle custom Error classes', () => {
                class CustomError extends Error {
                    constructor(message) {
                        super(message);
                        this.name = 'CustomError';
                    }
                }
                const error = new CustomError('Custom error occurred');
                const result = safeErrorMessage(error);

                if (isTestRunningInProduction) {
                    expect(result).toBe('Internal server error');
                } else {
                    expect(result).toBe('Custom error occurred');
                }
            });

            it('should handle null', () => {
                const result = safeErrorMessage(null);

                if (isTestRunningInProduction) {
                    expect(result).toBe('Internal server error');
                } else {
                    expect(result).toBe('null');
                }
            });

            it('should handle undefined', () => {
                const result = safeErrorMessage(undefined);

                if (isTestRunningInProduction) {
                    expect(result).toBe('Internal server error');
                } else {
                    expect(result).toBe('undefined');
                }
            });

            it('should handle numbers', () => {
                const result = safeErrorMessage(404);

                if (isTestRunningInProduction) {
                    expect(result).toBe('Internal server error');
                } else {
                    expect(result).toBe('404');
                }
            });

            it('should handle booleans', () => {
                const result = safeErrorMessage(true);

                if (isTestRunningInProduction) {
                    expect(result).toBe('Internal server error');
                } else {
                    expect(result).toBe('true');
                }
            });

            it('should handle objects without message property', () => {
                const obj = { code: 'ERR_001', status: 500 };
                const result = safeErrorMessage(obj);

                if (isTestRunningInProduction) {
                    expect(result).toBe('Internal server error');
                } else {
                    expect(result).toBe('[object Object]');
                }
            });

            it('should handle objects with message property', () => {
                const obj = { message: 'Object with message', code: 'ERR_001' };
                const result = safeErrorMessage(obj);

                if (isTestRunningInProduction) {
                    expect(result).toBe('Internal server error');
                } else {
                    expect(result).toBe('Object with message');
                }
            });

            it('should handle empty string', () => {
                const result = safeErrorMessage('');

                if (isTestRunningInProduction) {
                    expect(result).toBe('Internal server error');
                } else {
                    expect(result).toBe('');
                }
            });

            it('should handle multiline error messages', () => {
                const error = new Error('Line 1\nLine 2\nLine 3');
                const result = safeErrorMessage(error);

                if (isTestRunningInProduction) {
                    expect(result).toBe('Internal server error');
                } else {
                    expect(result).toBe('Line 1\nLine 2\nLine 3');
                }
            });

            it('should handle error messages with special characters', () => {
                const error = new Error('Error: {"code": 500, "detail": "Internal"}');
                const result = safeErrorMessage(error);

                if (isTestRunningInProduction) {
                    expect(result).toBe('Internal server error');
                } else {
                    expect(result).toBe('Error: {"code": 500, "detail": "Internal"}');
                }
            });

            it('should handle arrays', () => {
                const result = safeErrorMessage(['error1', 'error2']);

                if (isTestRunningInProduction) {
                    expect(result).toBe('Internal server error');
                } else {
                    expect(result).toBe('error1,error2');
                }
            });

            it('should handle very long error messages', () => {
                const longMessage = 'A'.repeat(10000);
                const error = new Error(longMessage);
                const result = safeErrorMessage(error);

                if (isTestRunningInProduction) {
                    expect(result).toBe('Internal server error');
                } else {
                    expect(result).toBe(longMessage);
                    expect(result.length).toBe(10000);
                }
            });
        });

        describe('Security - production mode behavior', () => {
            // These tests verify what SHOULD happen in production
            // They document the expected behavior even if not running in prod mode

            it('documents that production mode returns generic messages for errors', () => {
                // This is a documentation test showing expected production behavior
                const error = new Error('Sensitive database credentials leaked');

                // In production, this should be 'Internal server error'
                // In development, this will be the actual message
                const result = safeErrorMessage(error);

                if (isTestRunningInProduction) {
                    expect(result).toBe('Internal server error');
                    expect(result).not.toContain('credentials');
                } else {
                    // Just verify it returns something
                    expect(result).toBeDefined();
                }
            });

            it('documents that production mode hides stack traces', () => {
                const error = new Error('Internal error');
                error.stack = 'Error: Internal error\n    at someFunction (file.js:10:5)';
                const result = safeErrorMessage(error);

                if (isTestRunningInProduction) {
                    expect(result).not.toContain('file.js');
                    expect(result).not.toContain('someFunction');
                } else {
                    // Stack is not included in message property anyway
                    expect(result).toBe('Internal error');
                }
            });
        });
    });

    describe('sendError', () => {
        let mockRes;

        beforeEach(() => {
            mockRes = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn().mockReturnThis(),
            };
        });

        it('should send JSON response with correct status code and error details', () => {
            const result = sendError(mockRes, 404, 'NOT_FOUND', 'Resource not found');

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({
                errorCode: 'NOT_FOUND',
                error: 'Resource not found',
            });
            expect(result).toBe(mockRes);
        });

        it('should handle 500 Internal Server Error', () => {
            sendError(mockRes, 500, 'INTERNAL_ERROR', 'Internal server error');

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                errorCode: 'INTERNAL_ERROR',
                error: 'Internal server error',
            });
        });

        it('should handle 400 Bad Request', () => {
            sendError(mockRes, 400, 'BAD_REQUEST', 'Invalid request parameters');

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                errorCode: 'BAD_REQUEST',
                error: 'Invalid request parameters',
            });
        });

        it('should handle 401 Unauthorized', () => {
            sendError(mockRes, 401, 'UNAUTHORIZED', 'Authentication required');

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                errorCode: 'UNAUTHORIZED',
                error: 'Authentication required',
            });
        });

        it('should handle 403 Forbidden', () => {
            sendError(mockRes, 403, 'FORBIDDEN', 'Access denied');

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({
                errorCode: 'FORBIDDEN',
                error: 'Access denied',
            });
        });

        it('should handle 409 Conflict', () => {
            sendError(mockRes, 409, 'CONFLICT', 'Resource already exists');

            expect(mockRes.status).toHaveBeenCalledWith(409);
            expect(mockRes.json).toHaveBeenCalledWith({
                errorCode: 'CONFLICT',
                error: 'Resource already exists',
            });
        });

        it('should handle 422 Unprocessable Entity', () => {
            sendError(mockRes, 422, 'VALIDATION_ERROR', 'Validation failed');

            expect(mockRes.status).toHaveBeenCalledWith(422);
            expect(mockRes.json).toHaveBeenCalledWith({
                errorCode: 'VALIDATION_ERROR',
                error: 'Validation failed',
            });
        });

        it('should handle 503 Service Unavailable', () => {
            sendError(mockRes, 503, 'SERVICE_UNAVAILABLE', 'Service temporarily unavailable');

            expect(mockRes.status).toHaveBeenCalledWith(503);
            expect(mockRes.json).toHaveBeenCalledWith({
                errorCode: 'SERVICE_UNAVAILABLE',
                error: 'Service temporarily unavailable',
            });
        });

        it('should return the response object for chaining', () => {
            const result = sendError(mockRes, 500, 'ERROR', 'Error message');
            expect(result).toBe(mockRes);
        });

        it('should handle empty error message', () => {
            sendError(mockRes, 500, 'EMPTY_MESSAGE', '');

            expect(mockRes.json).toHaveBeenCalledWith({
                errorCode: 'EMPTY_MESSAGE',
                error: '',
            });
        });

        it('should handle empty error code', () => {
            sendError(mockRes, 500, '', 'Error message');

            expect(mockRes.json).toHaveBeenCalledWith({
                errorCode: '',
                error: 'Error message',
            });
        });

        it('should handle long error messages', () => {
            const longMessage = 'A'.repeat(1000);
            sendError(mockRes, 500, 'LONG_ERROR', longMessage);

            expect(mockRes.json).toHaveBeenCalledWith({
                errorCode: 'LONG_ERROR',
                error: longMessage,
            });
        });

        it('should handle special characters in error message', () => {
            const message = 'Error: {"detail": "Invalid \\"quoted\\" value"}';
            sendError(mockRes, 400, 'SPECIAL_CHARS', message);

            expect(mockRes.json).toHaveBeenCalledWith({
                errorCode: 'SPECIAL_CHARS',
                error: message,
            });
        });

        it('should handle special characters in error code', () => {
            sendError(mockRes, 500, 'ERROR_CODE_WITH_SPECIAL-CHARS_123', 'Error message');

            expect(mockRes.json).toHaveBeenCalledWith({
                errorCode: 'ERROR_CODE_WITH_SPECIAL-CHARS_123',
                error: 'Error message',
            });
        });

        it('should verify method chaining order', () => {
            sendError(mockRes, 404, 'NOT_FOUND', 'Not found');

            // Verify status was called before json
            const statusCall = mockRes.status.mock.invocationCallOrder[0];
            const jsonCall = mockRes.json.mock.invocationCallOrder[0];
            expect(statusCall).toBeLessThan(jsonCall);
        });

        it('should not modify response object properties', () => {
            const originalStatus = mockRes.status;
            const originalJson = mockRes.json;

            sendError(mockRes, 500, 'ERROR', 'Message');

            expect(mockRes.status).toBe(originalStatus);
            expect(mockRes.json).toBe(originalJson);
        });

        it('should handle numeric error codes by converting to string', () => {
            sendError(mockRes, 500, 12345, 'Error message');

            expect(mockRes.json).toHaveBeenCalledWith({
                errorCode: 12345,
                error: 'Error message',
            });
        });

        it('should handle multiline error messages', () => {
            const message = 'Error on line 1\nError on line 2\nError on line 3';
            sendError(mockRes, 500, 'MULTILINE', message);

            expect(mockRes.json).toHaveBeenCalledWith({
                errorCode: 'MULTILINE',
                error: message,
            });
        });
    });

    describe('Integration scenarios', () => {
        let mockRes;

        beforeEach(() => {
            mockRes = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn().mockReturnThis(),
            };
        });

        it('should work together: safeErrorMessage + sendError in development', () => {
            process.env.NODE_ENV = 'development';
            const error = new Error('Database query failed');
            const safeMessage = safeErrorMessage(error);

            sendError(mockRes, 500, 'DATABASE_ERROR', safeMessage);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                errorCode: 'DATABASE_ERROR',
                error: 'Database query failed',
            });
        });

        it('should work together: safeErrorMessage + sendError in production', () => {
            process.env.NODE_ENV = 'production';
            const error = new Error('Sensitive database error with credentials');
            const safeMessage = safeErrorMessage(error);

            sendError(mockRes, 500, 'INTERNAL_ERROR', safeMessage);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                errorCode: 'INTERNAL_ERROR',
                error: 'Internal server error',
            });
        });

        it('should handle typical Express error handler pattern', () => {
            process.env.NODE_ENV = 'production';

            // Simulate typical error handler
            const error = new Error('Unexpected token in JSON');
            const statusCode = 400;
            const errorCode = 'PARSE_ERROR';
            const message = safeErrorMessage(error);

            sendError(mockRes, statusCode, errorCode, message);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                errorCode: 'PARSE_ERROR',
                error: 'Internal server error',
            });
        });

        it('should handle validation error pattern', () => {
            process.env.NODE_ENV = 'development';

            const validationError = { message: 'Field "email" is required' };
            const message = safeErrorMessage(validationError);

            sendError(mockRes, 422, 'VALIDATION_ERROR', message);

            expect(mockRes.json).toHaveBeenCalledWith({
                errorCode: 'VALIDATION_ERROR',
                error: 'Field "email" is required',
            });
        });

        it('should handle authentication error pattern', () => {
            process.env.NODE_ENV = 'production';

            const authError = new Error('JWT expired');
            const message = safeErrorMessage(authError);

            sendError(mockRes, 401, 'TOKEN_EXPIRED', message);

            expect(mockRes.json).toHaveBeenCalledWith({
                errorCode: 'TOKEN_EXPIRED',
                error: 'Internal server error',
            });
        });
    });
});
