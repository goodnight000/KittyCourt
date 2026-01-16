/**
 * Tests for llmRetryHandler.js
 *
 * Tests:
 * - Successful LLM calls
 * - Retry logic with exponential backoff
 * - JSON parsing with repair fallback
 * - Zod validation errors
 * - Max retry exhaustion
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callLLMWithRetry, retryLLMCall } from './llmRetryHandler.js';
import { z } from 'zod';

// Mock jsonRepair module
vi.mock('../jsonRepair.js', () => ({
    repairAndParseJSON: vi.fn((content) => {
        // Simple mock: if it starts with {, try to parse it
        if (content.startsWith('{')) {
            return JSON.parse(content);
        }
        throw new Error('Cannot repair JSON');
    }),
}));

import { repairAndParseJSON } from '../jsonRepair.js';

describe('llmRetryHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    describe('callLLMWithRetry - Success cases', () => {
        it('should return validated result on first attempt', async () => {
            const schema = z.object({
                message: z.string(),
                count: z.number(),
            });

            const mockResponse = {
                choices: [{
                    message: { content: JSON.stringify({ message: 'test', count: 42 }) },
                    finish_reason: 'stop',
                }],
            };

            const llmFunction = vi.fn().mockResolvedValue(mockResponse);

            const result = await callLLMWithRetry(
                { llmFunction, schema },
                { operationName: 'Test call' }
            );

            // Result includes metadata fields from model fallback feature
            expect(result.message).toBe('test');
            expect(result.count).toBe(42);
            expect(result._modelUsed).toBeDefined();
            expect(result._usedFallback).toBe(false);
            expect(llmFunction).toHaveBeenCalledTimes(1);
        });

        it('should handle JSON repair when direct parse fails', async () => {
            // Use real timers for this test since we don't need fake timers
            vi.useRealTimers();

            const schema = z.object({ data: z.string() });

            // Use JSON that is broken but can be repaired by the real jsonRepair module
            // The real module can handle trailing commas and unquoted keys
            const repairableJson = '{"data": "repaired value",}'; // Trailing comma is repairable
            const mockResponse = {
                choices: [{
                    message: { content: repairableJson },
                    finish_reason: 'stop',
                }],
            };

            const llmFunction = vi.fn().mockResolvedValue(mockResponse);
            const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await callLLMWithRetry(
                { llmFunction, schema },
                { operationName: 'Test repair', maxRetries: 1 }
            );

            expect(result.data).toBe('repaired value');
            // Check the console log message which proves the repair path was taken
            expect(consoleLog).toHaveBeenCalledWith(
                expect.stringContaining('direct parse failed, attempting repair')
            );

            // Restore fake timers for subsequent tests
            vi.useFakeTimers();
        });

        it('should warn on truncated response but still return result', async () => {
            const schema = z.object({ message: z.string() });

            const mockResponse = {
                choices: [{
                    message: { content: JSON.stringify({ message: 'truncated' }) },
                    finish_reason: 'length', // Indicates truncation
                }],
            };

            const llmFunction = vi.fn().mockResolvedValue(mockResponse);
            const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

            const result = await callLLMWithRetry(
                { llmFunction, schema },
                { operationName: 'Test truncation' }
            );

            expect(result.message).toBe('truncated');
            expect(consoleWarn).toHaveBeenCalledWith(
                expect.stringContaining('response was truncated')
            );
        });

        it('should call onSuccess callback when provided', async () => {
            const schema = z.object({ value: z.number() });
            const mockResponse = {
                choices: [{
                    message: { content: JSON.stringify({ value: 100 }) },
                    finish_reason: 'stop',
                }],
            };

            const llmFunction = vi.fn().mockResolvedValue(mockResponse);
            const onSuccess = vi.fn();

            await callLLMWithRetry(
                { llmFunction, schema },
                { onSuccess }
            );

            // onSuccess receives validated result (with metadata) and model used
            expect(onSuccess).toHaveBeenCalled();
            const [successResult] = onSuccess.mock.calls[0];
            expect(successResult.value).toBe(100);
        });
    });

    describe('callLLMWithRetry - Retry logic', () => {
        it('should retry on failure with exponential backoff', async () => {
            const schema = z.object({ data: z.string() });

            const llmFunction = vi.fn()
                .mockRejectedValueOnce(new Error('Network error'))
                .mockRejectedValueOnce(new Error('Timeout'))
                .mockResolvedValueOnce({
                    choices: [{
                        message: { content: JSON.stringify({ data: 'success' }) },
                        finish_reason: 'stop',
                    }],
                });

            const promise = callLLMWithRetry(
                { llmFunction, schema },
                { maxRetries: 3, baseDelayMs: 1000, operationName: 'Test retry' }
            );

            // First attempt fails immediately
            await vi.advanceTimersByTimeAsync(0);

            // Wait for first retry (2^0 * 1000 = 1000ms)
            await vi.advanceTimersByTimeAsync(1000);

            // Second attempt fails
            await vi.advanceTimersByTimeAsync(0);

            // Wait for second retry (2^1 * 1000 = 2000ms) - EXPONENTIAL!
            await vi.advanceTimersByTimeAsync(2000);

            // Third attempt succeeds
            const result = await promise;

            expect(result.data).toBe('success');
            expect(llmFunction).toHaveBeenCalledTimes(3);
        });

        it('should use correct exponential backoff delays', async () => {
            const schema = z.object({ data: z.string() });

            const llmFunction = vi.fn()
                .mockRejectedValueOnce(new Error('Fail 1'))
                .mockRejectedValueOnce(new Error('Fail 2'))
                .mockRejectedValueOnce(new Error('Fail 3'))
                .mockResolvedValueOnce({
                    choices: [{
                        message: { content: JSON.stringify({ data: 'success' }) },
                        finish_reason: 'stop',
                    }],
                });

            const baseDelayMs = 500;
            const promise = callLLMWithRetry(
                { llmFunction, schema },
                { maxRetries: 4, baseDelayMs, operationName: 'Backoff test' }
            );

            // Attempt 1 fails
            await vi.advanceTimersByTimeAsync(0);

            // Delay before retry 2: 500 * 2^0 = 500ms
            await vi.advanceTimersByTimeAsync(500);

            // Attempt 2 fails
            await vi.advanceTimersByTimeAsync(0);

            // Delay before retry 3: 500 * 2^1 = 1000ms
            await vi.advanceTimersByTimeAsync(1000);

            // Attempt 3 fails
            await vi.advanceTimersByTimeAsync(0);

            // Delay before retry 4: 500 * 2^2 = 2000ms
            await vi.advanceTimersByTimeAsync(2000);

            // Attempt 4 succeeds
            const result = await promise;

            expect(result.data).toBe('success');
            expect(llmFunction).toHaveBeenCalledTimes(4);
        });

        it('should call onRetry callback before each retry', async () => {
            const schema = z.object({ data: z.string() });

            const llmFunction = vi.fn()
                .mockRejectedValueOnce(new Error('Fail'))
                .mockResolvedValueOnce({
                    choices: [{
                        message: { content: JSON.stringify({ data: 'success' }) },
                        finish_reason: 'stop',
                    }],
                });

            const onRetry = vi.fn();

            const promise = callLLMWithRetry(
                { llmFunction, schema },
                { maxRetries: 2, baseDelayMs: 100, onRetry }
            );

            await vi.advanceTimersByTimeAsync(0);
            await vi.advanceTimersByTimeAsync(100);

            await promise;

            // onRetry should be called for attempt 2 (not attempt 1)
            expect(onRetry).toHaveBeenCalledTimes(1);
            expect(onRetry).toHaveBeenCalledWith(2);
        });

        it('should call onError callback on each failure', async () => {
            const schema = z.object({ data: z.string() });

            const error1 = new Error('Error 1');
            const error2 = new Error('Error 2');

            const llmFunction = vi.fn()
                .mockRejectedValueOnce(error1)
                .mockRejectedValueOnce(error2)
                .mockResolvedValueOnce({
                    choices: [{
                        message: { content: JSON.stringify({ data: 'success' }) },
                        finish_reason: 'stop',
                    }],
                });

            const onError = vi.fn();

            const promise = callLLMWithRetry(
                { llmFunction, schema },
                { maxRetries: 3, baseDelayMs: 100, onError }
            );

            await vi.advanceTimersByTimeAsync(0);
            await vi.advanceTimersByTimeAsync(100);
            await vi.advanceTimersByTimeAsync(0);
            await vi.advanceTimersByTimeAsync(200);

            await promise;

            expect(onError).toHaveBeenCalledTimes(2);
            expect(onError).toHaveBeenNthCalledWith(1, error1, 1);
            expect(onError).toHaveBeenNthCalledWith(2, error2, 2);
        });
    });

    describe('callLLMWithRetry - Validation errors', () => {
        it('should throw on Zod validation failure', async () => {
            // Use real timers with short delays for this test
            vi.useRealTimers();

            const schema = z.object({
                requiredField: z.string(),
                numberField: z.number(),
            });

            const mockResponse = {
                choices: [{
                    message: { content: JSON.stringify({ requiredField: 'test' }) }, // Missing numberField
                    finish_reason: 'stop',
                }],
            };

            const llmFunction = vi.fn().mockResolvedValue(mockResponse);

            await expect(
                callLLMWithRetry(
                    { llmFunction, schema },
                    { maxRetries: 2, baseDelayMs: 10 } // Use very short delay
                )
            ).rejects.toThrow();

            expect(llmFunction).toHaveBeenCalledTimes(2); // Should retry on validation errors

            // Restore fake timers
            vi.useFakeTimers();
        });

        it('should retry on JSON parse failures', async () => {
            const schema = z.object({ data: z.string() });

            const llmFunction = vi.fn()
                .mockResolvedValueOnce({
                    choices: [{
                        message: { content: 'invalid json' },
                        finish_reason: 'stop',
                    }],
                })
                .mockResolvedValueOnce({
                    choices: [{
                        message: { content: JSON.stringify({ data: 'valid' }) },
                        finish_reason: 'stop',
                    }],
                });

            // Mock repair to fail on first attempt
            repairAndParseJSON.mockImplementationOnce(() => {
                throw new Error('Cannot repair');
            });

            const promise = callLLMWithRetry(
                { llmFunction, schema },
                { maxRetries: 2, baseDelayMs: 100 }
            );

            await vi.advanceTimersByTimeAsync(0);
            await vi.advanceTimersByTimeAsync(100);

            const result = await promise;

            expect(result.data).toBe('valid');
            expect(llmFunction).toHaveBeenCalledTimes(2);
        });
    });

    describe('callLLMWithRetry - Max retries exhausted', () => {
        it('should throw after max retries with last error message', async () => {
            // Use real timers with short delays
            vi.useRealTimers();

            const schema = z.object({ data: z.string() });

            const llmFunction = vi.fn()
                .mockRejectedValueOnce(new Error('Error 1'))
                .mockRejectedValueOnce(new Error('Error 2'))
                .mockRejectedValueOnce(new Error('Final error'));

            await expect(
                callLLMWithRetry(
                    { llmFunction, schema },
                    { maxRetries: 3, baseDelayMs: 10, operationName: 'Test operation' }
                )
            ).rejects.toThrow('Test operation failed after 3 attempts: Final error');

            expect(llmFunction).toHaveBeenCalledTimes(3);

            // Restore fake timers
            vi.useFakeTimers();
        });

        it('should not delay after final attempt', async () => {
            // Use real timers for this test
            vi.useRealTimers();

            const schema = z.object({ data: z.string() });

            const llmFunction = vi.fn()
                .mockRejectedValue(new Error('Always fails'));

            const startTime = Date.now();

            await expect(
                callLLMWithRetry(
                    { llmFunction, schema },
                    { maxRetries: 2, baseDelayMs: 50 }
                )
            ).rejects.toThrow();

            const elapsedTime = Date.now() - startTime;

            // Should take approximately: 50ms (first delay) + execution time
            // Should NOT take 50ms + 100ms (second delay would be skipped after final attempt)
            expect(elapsedTime).toBeLessThan(200);
            expect(llmFunction).toHaveBeenCalledTimes(2);

            // Restore fake timers
            vi.useFakeTimers();
        });
    });

    describe('callLLMWithRetry - Edge cases', () => {
        it('should handle missing content in response', async () => {
            const schema = z.object({ data: z.string() });

            const mockResponse = {
                choices: [{
                    message: {}, // No content
                    finish_reason: 'stop',
                }],
            };

            const llmFunction = vi.fn().mockResolvedValue(mockResponse);

            const promise = callLLMWithRetry(
                { llmFunction, schema },
                { maxRetries: 1 }
            );

            await expect(promise).rejects.toThrow('No content in LLM response');
        });

        it('should handle empty choices array', async () => {
            const schema = z.object({ data: z.string() });

            const mockResponse = {
                choices: [], // Empty
            };

            const llmFunction = vi.fn().mockResolvedValue(mockResponse);

            const promise = callLLMWithRetry(
                { llmFunction, schema },
                { maxRetries: 1 }
            );

            await expect(promise).rejects.toThrow();
        });

        it('should use default options when not provided', async () => {
            const schema = z.object({ data: z.string() });

            const mockResponse = {
                choices: [{
                    message: { content: JSON.stringify({ data: 'test' }) },
                    finish_reason: 'stop',
                }],
            };

            const llmFunction = vi.fn().mockResolvedValue(mockResponse);

            // No options provided - should use defaults
            const result = await callLLMWithRetry({ llmFunction, schema });

            expect(result.data).toBe('test');
        });
    });

    describe('retryLLMCall wrapper', () => {
        it('should work as simplified wrapper', async () => {
            const schema = z.object({ message: z.string() });

            const mockResponse = {
                choices: [{
                    message: { content: JSON.stringify({ message: 'wrapper test' }) },
                    finish_reason: 'stop',
                }],
            };

            const createChatCompletion = vi.fn().mockResolvedValue(mockResponse);

            const llmConfig = {
                model: 'test-model',
                messages: [{ role: 'user', content: 'test' }],
            };

            const result = await retryLLMCall(
                createChatCompletion,
                llmConfig,
                schema,
                { operationName: 'Wrapper test' }
            );

            // Result includes metadata from model fallback feature
            expect(result.message).toBe('wrapper test');
            expect(result._modelUsed).toBe('test-model');
            expect(result._usedFallback).toBe(false);
            expect(createChatCompletion).toHaveBeenCalledWith(llmConfig);
        });

        it('should pass all options through wrapper', async () => {
            const schema = z.object({ value: z.number() });

            const createChatCompletion = vi.fn()
                .mockRejectedValueOnce(new Error('Fail'))
                .mockResolvedValueOnce({
                    choices: [{
                        message: { content: JSON.stringify({ value: 42 }) },
                        finish_reason: 'stop',
                    }],
                });

            const onRetry = vi.fn();

            const promise = retryLLMCall(
                createChatCompletion,
                { model: 'test' },
                schema,
                { maxRetries: 2, baseDelayMs: 500, onRetry }
            );

            await vi.advanceTimersByTimeAsync(0);
            await vi.advanceTimersByTimeAsync(500);

            const result = await promise;

            // Result includes metadata from model fallback feature
            expect(result.value).toBe(42);
            expect(result._modelUsed).toBeDefined();
            expect(onRetry).toHaveBeenCalled();
        });
    });
});
