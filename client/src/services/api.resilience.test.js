import { describe, expect, it } from 'vitest'
import {
  computeRetryDelayMs,
  isIdempotentMethod,
  normalizeApiError,
  shouldRetryApiRequest,
} from './api'

describe('api resilience helpers', () => {
  it('retries only idempotent methods', () => {
    expect(isIdempotentMethod('get')).toBe(true)
    expect(isIdempotentMethod('head')).toBe(true)
    expect(isIdempotentMethod('options')).toBe(true)
    expect(isIdempotentMethod('post')).toBe(false)
    expect(isIdempotentMethod('patch')).toBe(false)
  })

  it('retries GET requests on retryable failures', () => {
    const config = { method: 'get' }

    expect(shouldRetryApiRequest({ code: 'ERR_NETWORK' }, config)).toBe(true)
    expect(shouldRetryApiRequest({ code: 'ECONNABORTED' }, config)).toBe(true)
    expect(shouldRetryApiRequest({ response: { status: 503 } }, config)).toBe(true)
    expect(shouldRetryApiRequest({ response: { status: 429 } }, config)).toBe(true)
    expect(shouldRetryApiRequest({ response: { status: 400 } }, config)).toBe(false)
  })

  it('does not retry mutation methods', () => {
    const error = { code: 'ERR_NETWORK', response: { status: 503 } }
    expect(shouldRetryApiRequest(error, { method: 'post' })).toBe(false)
    expect(shouldRetryApiRequest(error, { method: 'put' })).toBe(false)
    expect(shouldRetryApiRequest(error, { method: 'patch' })).toBe(false)
    expect(shouldRetryApiRequest(error, { method: 'delete' })).toBe(false)
  })

  it('normalizes 503 errors into a user-safe message', () => {
    const normalized = normalizeApiError({
      response: {
        status: 503,
        statusText: 'Service Unavailable',
        data: { error: 'upstream failure' },
      },
      message: 'Request failed with status code 503',
    })

    expect(normalized.status).toBe(503)
    expect(normalized.isServerError).toBe(true)
    expect(normalized.message).toBe('Service temporarily unavailable. Please try again.')
  })

  it('uses bounded exponential retry delay', () => {
    const first = computeRetryDelayMs(1)
    const second = computeRetryDelayMs(2)
    const fifth = computeRetryDelayMs(5)

    expect(first).toBeGreaterThanOrEqual(300)
    expect(second).toBeGreaterThan(first)
    expect(fifth).toBeLessThanOrEqual(4000)
  })
})
