import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import useAppStore from '../store/useAppStore'

// Mock the API
vi.mock('../services/api', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
    }
}))

describe('Courtroom Store', () => {
    beforeEach(() => {
        // Reset store state before each test
        useAppStore.setState({
            currentUser: { id: '1', name: 'User A', kibbleBalance: 50 },
            users: [
                { id: '1', name: 'User A', kibbleBalance: 50 },
                { id: '2', name: 'User B', kibbleBalance: 50 }
            ],
            activeCase: {
                userAInput: '',
                userAFeelings: '',
                userBInput: '',
                userBFeelings: '',
                status: 'DRAFT',
                verdict: null,
            },
            caseHistory: [],
        })
    })

    describe('Case Input', () => {
        it('should update User A facts when current user is User A', () => {
            const { result } = renderHook(() => useAppStore())

            act(() => {
                result.current.updateCaseInput('Test facts from User A', 'facts')
            })

            expect(result.current.activeCase.userAInput).toBe('Test facts from User A')
            expect(result.current.activeCase.userBInput).toBe('')
        })

        it('should update User A feelings when current user is User A', () => {
            const { result } = renderHook(() => useAppStore())

            act(() => {
                result.current.updateCaseInput('I felt upset', 'feelings')
            })

            expect(result.current.activeCase.userAFeelings).toBe('I felt upset')
        })

        it('should update User B input when current user is User B', () => {
            const { result } = renderHook(() => useAppStore())

            // Switch to User B
            act(() => {
                result.current.switchUser('2')
            })

            act(() => {
                result.current.updateCaseInput('Test facts from User B', 'facts')
            })

            expect(result.current.activeCase.userBInput).toBe('Test facts from User B')
            expect(result.current.activeCase.userAInput).toBe('')
        })
    })

    describe('Case Submission Flow', () => {
        it('should lock case for User A after submission', () => {
            const { result } = renderHook(() => useAppStore())

            // User A enters input
            act(() => {
                result.current.updateCaseInput('User A complaint', 'facts')
            })

            // User A submits
            act(() => {
                result.current.submitSide()
            })

            expect(result.current.activeCase.status).toBe('LOCKED_A')
        })

        it('should start deliberating after User B submits', () => {
            const { result } = renderHook(() => useAppStore())

            // First, User A submits
            act(() => {
                result.current.updateCaseInput('User A complaint', 'facts')
                result.current.submitSide()
            })

            // Switch to User B
            act(() => {
                result.current.switchUser('2')
            })

            // User B enters input and submits
            act(() => {
                result.current.updateCaseInput('User B response', 'facts')
                result.current.submitSide()
            })

            expect(result.current.activeCase.status).toBe('DELIBERATING')
        })
    })

    describe('Case Reset', () => {
        it('should reset case to initial state', () => {
            const { result } = renderHook(() => useAppStore())

            // Set up some case data
            act(() => {
                result.current.updateCaseInput('Some complaint', 'facts')
                result.current.updateCaseInput('Some feelings', 'feelings')
                result.current.submitSide()
            })

            // Reset the case
            act(() => {
                result.current.resetCase()
            })

            expect(result.current.activeCase).toEqual({
                userAInput: '',
                userAFeelings: '',
                userBInput: '',
                userBFeelings: '',
                status: 'DRAFT',
                verdict: null,
            })
        })
    })

    describe('Verdict Display', () => {
        it('should properly store verdict object', () => {
            const { result } = renderHook(() => useAppStore())

            const mockVerdict = {
                summary: 'Test summary',
                ruling: 'Test ruling',
                sentence: 'Test sentence',
                winner: 'tie',
            }

            // Manually set verdict (simulating what generateVerdict does)
            act(() => {
                useAppStore.setState({
                    activeCase: {
                        ...result.current.activeCase,
                        status: 'RESOLVED',
                        verdict: mockVerdict,
                    }
                })
            })

            expect(result.current.activeCase.status).toBe('RESOLVED')
            expect(result.current.activeCase.verdict).toEqual(mockVerdict)
            expect(result.current.activeCase.verdict.summary).toBe('Test summary')
        })
    })

    describe('User Switching', () => {
        it('should switch between users correctly', () => {
            const { result } = renderHook(() => useAppStore())

            expect(result.current.currentUser.name).toBe('User A')

            act(() => {
                result.current.switchUser('2')
            })

            expect(result.current.currentUser.name).toBe('User B')
        })
    })
})

describe('Economy Store', () => {
    beforeEach(() => {
        useAppStore.setState({
            currentUser: { id: '1', name: 'User A', kibbleBalance: 50 },
            users: [
                { id: '1', name: 'User A', kibbleBalance: 50 },
            ],
        })
    })

    describe('Coupon Affordability', () => {
        it('should check if user can afford a coupon', () => {
            const { result } = renderHook(() => useAppStore())

            // User has 50 kibble
            expect(result.current.currentUser.kibbleBalance).toBe(50)

            // They can afford a 25 kibble coupon
            const cheapCoupon = { cost: 25 }
            expect(result.current.currentUser.kibbleBalance >= cheapCoupon.cost).toBe(true)

            // They cannot afford a 100 kibble coupon
            const expensiveCoupon = { cost: 100 }
            expect(result.current.currentUser.kibbleBalance >= expensiveCoupon.cost).toBe(false)
        })
    })
})
