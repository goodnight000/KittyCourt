/**
 * Tests for asyncHandler middleware
 */

import { describe, it, expect, vi } from 'vitest';
import { asyncHandler } from './asyncHandler.js';

describe('asyncHandler middleware', () => {
  it('should call the async function and resolve successfully', async () => {
    const mockReq = {};
    const mockRes = {
      json: vi.fn(),
    };
    const mockNext = vi.fn();

    const asyncFn = vi.fn().mockResolvedValue({ data: 'test' });
    const handler = asyncHandler(asyncFn);

    await handler(mockReq, mockRes, mockNext);

    expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should catch async errors and pass them to next', async () => {
    const mockReq = {};
    const mockRes = {};
    const mockNext = vi.fn();

    const error = new Error('Async operation failed');
    const asyncFn = vi.fn().mockRejectedValue(error);
    const handler = asyncHandler(asyncFn);

    await handler(mockReq, mockRes, mockNext);

    expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(error);
  });

  it('should handle synchronous errors by catching them as rejected promises', async () => {
    const mockReq = {};
    const mockRes = {};
    const mockNext = vi.fn();

    const error = new Error('Sync error');
    const asyncFn = vi.fn().mockImplementation(() => {
      throw error;
    });
    const handler = asyncHandler(asyncFn);

    await handler(mockReq, mockRes, mockNext);

    expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(error);
  });

  it('should preserve error statusCode when passing to next', async () => {
    const mockReq = {};
    const mockRes = {};
    const mockNext = vi.fn();

    const error = new Error('Not found');
    error.statusCode = 404;
    const asyncFn = vi.fn().mockRejectedValue(error);
    const handler = asyncHandler(asyncFn);

    await handler(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
    expect(mockNext.mock.calls[0][0].statusCode).toBe(404);
  });

  it('should work with functions that call res methods directly', async () => {
    const mockReq = {};
    const mockRes = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    };
    const mockNext = vi.fn();

    const asyncFn = async (req, res) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      res.json({ success: true });
    };
    const handler = asyncHandler(asyncFn);

    await handler(mockReq, mockRes, mockNext);

    expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    expect(mockNext).not.toHaveBeenCalled();
  });
});
