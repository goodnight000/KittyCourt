/**
 * Tests for requirePartner middleware
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mock functions
const mockRequireAuthUserId = vi.fn();
const mockGetPartnerIdForUser = vi.fn();
const mockRequireSupabase = vi.fn();

// Mock the auth module
vi.mock('../lib/auth.js', () => ({
  requireAuthUserId: mockRequireAuthUserId,
  getPartnerIdForUser: mockGetPartnerIdForUser,
  requireSupabase: mockRequireSupabase,
}));

// Import after mocking
const { requirePartner } = await import('./requirePartner.js');

describe('requirePartner middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;
  let mockSupabase;

  beforeEach(() => {
    mockReq = {
      headers: {}
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
    mockSupabase = { /* mock supabase client */ };

    vi.clearAllMocks();
  });

  it('should attach userId, partnerId, supabase, and coupleIds to request when partner exists', async () => {
    const userId = 'user-123';
    const partnerId = 'partner-456';

    mockRequireAuthUserId.mockResolvedValue(userId);
    mockRequireSupabase.mockReturnValue(mockSupabase);
    mockGetPartnerIdForUser.mockResolvedValue(partnerId);

    await requirePartner(mockReq, mockRes, mockNext);

    expect(mockRequireAuthUserId).toHaveBeenCalledWith(mockReq);
    expect(mockRequireSupabase).toHaveBeenCalled();
    expect(mockGetPartnerIdForUser).toHaveBeenCalledWith(mockSupabase, userId);

    expect(mockReq.userId).toBe(userId);
    expect(mockReq.partnerId).toBe(partnerId);
    expect(mockReq.supabase).toBe(mockSupabase);
    expect(mockReq.coupleIds).toEqual([partnerId, userId]); // Sorted
    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should return 400 NO_PARTNER error when user has no connected partner', async () => {
    const userId = 'user-123';

    mockRequireAuthUserId.mockResolvedValue(userId);
    mockRequireSupabase.mockReturnValue(mockSupabase);
    mockGetPartnerIdForUser.mockResolvedValue(null); // No partner

    await requirePartner(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      errorCode: 'NO_PARTNER',
      error: 'No partner connected. Please connect with a partner first.'
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 error when authentication fails', async () => {
    const authError = new Error('Missing Authorization bearer token');
    authError.statusCode = 401;

    mockRequireAuthUserId.mockRejectedValue(authError);

    await requirePartner(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Missing Authorization bearer token'
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 503 error when Supabase is not configured', async () => {
    const userId = 'user-123';
    const supabaseError = new Error('Supabase is not configured');
    supabaseError.statusCode = 503;

    mockRequireAuthUserId.mockResolvedValue(userId);
    mockRequireSupabase.mockImplementation(() => {
      throw supabaseError;
    });

    await requirePartner(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(503);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Supabase is not configured'
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 500 error for unexpected errors without statusCode', async () => {
    const userId = 'user-123';
    const unexpectedError = new Error('Database connection failed');

    mockRequireAuthUserId.mockResolvedValue(userId);
    mockRequireSupabase.mockReturnValue(mockSupabase);
    mockGetPartnerIdForUser.mockRejectedValue(unexpectedError);

    await requirePartner(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Database connection failed'
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should correctly sort coupleIds regardless of userId/partnerId order', async () => {
    // Test with userId > partnerId
    const userId = 'zzz-user';
    const partnerId = 'aaa-partner';

    mockRequireAuthUserId.mockResolvedValue(userId);
    mockRequireSupabase.mockReturnValue(mockSupabase);
    mockGetPartnerIdForUser.mockResolvedValue(partnerId);

    await requirePartner(mockReq, mockRes, mockNext);

    expect(mockReq.coupleIds).toEqual([partnerId, userId]); // Should be sorted
  });
});
