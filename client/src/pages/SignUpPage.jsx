import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Sparkles, Check } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

const SignUpPage = () => {
    const navigate = useNavigate();
    const { signUp, signInWithGoogle } = useAuthStore();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const passwordRequirements = [
        { text: 'At least 8 characters', met: password.length >= 8 },
    ];

    const allRequirementsMet = passwordRequirements.every(req => req.met);

    const handleEmailSignUp = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        if (!email || !password || !confirmPassword) {
            setError('Please fill in all fields');
            setIsSubmitting(false);
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            setIsSubmitting(false);
            return;
        }

        if (!allRequirementsMet) {
            setError('Password does not meet requirements');
            setIsSubmitting(false);
            return;
        }

        const { error } = await signUp(email, password);
        setIsSubmitting(false);
        if (error) {
            if (error.message.includes('already registered') || error.status === 422) {
                setError('This email is already registered. Please sign in instead.');
            } else {
                setError(error.message);
            }
        } else {
            setSuccess(true);
            // Force navigation to onboarding immediately to avoid any state race conditions
            navigate('/onboarding');
        }
    };

    const handleGoogleSignUp = async () => {
        setError('');
        setIsSubmitting(true);
        const { error } = await signInWithGoogle();
        setIsSubmitting(false);
        if (error) {
            setError(error.message);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-court-cream via-white to-court-tan/30 flex flex-col items-center justify-center p-6">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center"
                >
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', delay: 0.2 }}
                        className="w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #C9A227 0%, #8B7019 100%)' }}
                    >
                        <Check className="w-12 h-12 text-white" />
                    </motion.div>
                    <h2 className="text-2xl font-bold text-neutral-800 mb-2">Account Created! 🎉</h2>
                    <p className="text-neutral-500">Let's set up your profile...</p>
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="mt-6"
                    >
                        <Sparkles className="w-6 h-6 text-court-gold mx-auto" />
                    </motion.div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-court-cream via-white to-court-tan/30 flex flex-col items-center justify-center p-6">
            {/* Background Decorations */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <motion.div
                    animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
                    transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-20 right-10 text-4xl opacity-20"
                >
                    ✨
                </motion.div>
                <motion.div
                    animate={{ y: [0, 15, 0], rotate: [0, -5, 0] }}
                    transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                    className="absolute bottom-32 left-16 text-3xl opacity-20"
                >
                    🐱
                </motion.div>
            </div>

            {/* Logo & Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-6"
            >
                <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #C9A227 0%, #8B7019 100%)' }}
                >
                    <span className="text-4xl">🐱</span>
                </motion.div>
                <h1 className="text-3xl font-bold text-gradient font-display">Join Pause</h1>
                <p className="text-neutral-500 mt-2">Create your account to get started</p>
            </motion.div>

            {/* Sign Up Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="w-full max-w-md"
            >
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-white/50">
                    {/* Error Message */}
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl"
                        >
                            <p className="text-red-600 text-sm text-center">{error}</p>
                        </motion.div>
                    )}

                    {/* Google Sign Up */}
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleGoogleSignUp}
                        disabled={isSubmitting}
                        className="w-full py-3.5 bg-white border-2 border-neutral-200 rounded-2xl font-bold text-neutral-700 flex items-center justify-center gap-3 hover:bg-neutral-50 hover:border-neutral-300 transition-all disabled:opacity-50"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Continue with Google
                    </motion.button>

                    {/* Divider */}
                    <div className="flex items-center gap-4 my-6">
                        <div className="flex-1 h-px bg-neutral-200"></div>
                        <span className="text-neutral-400 text-sm">or</span>
                        <div className="flex-1 h-px bg-neutral-200"></div>
                    </div>

                    {/* Email Form */}
                    <form onSubmit={handleEmailSignUp} className="space-y-4">
                        {/* Email Input */}
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Email address"
                                className="w-full pl-12 pr-4 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:border-court-gold focus:ring-2 focus:ring-court-gold/20 transition-all"
                            />
                        </div>

                        {/* Password Input */}
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Create password"
                                className="w-full pl-12 pr-12 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:border-court-gold focus:ring-2 focus:ring-court-gold/20 transition-all"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>

                        {/* Password Requirements */}
                        {password && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="space-y-1.5 pl-1"
                            >
                                {passwordRequirements.map((req, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs">
                                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${req.met ? 'bg-green-500' : 'bg-neutral-200'}`}>
                                            {req.met && <Check className="w-2.5 h-2.5 text-white" />}
                                        </div>
                                        <span className={req.met ? 'text-green-600' : 'text-neutral-400'}>{req.text}</span>
                                    </div>
                                ))}
                            </motion.div>
                        )}

                        {/* Confirm Password Input */}
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm password"
                                className={`w-full pl-12 pr-4 py-3.5 bg-neutral-50 border rounded-2xl text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:ring-2 transition-all ${confirmPassword && password !== confirmPassword
                                    ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                                    : 'border-neutral-200 focus:border-court-gold focus:ring-court-gold/20'
                                    }`}
                            />
                        </div>

                        {/* Submit Button */}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            disabled={isSubmitting || !allRequirementsMet}
                            className="w-full py-3.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 transition-all"
                            style={{ background: 'linear-gradient(135deg, #C9A227 0%, #8B7019 100%)' }}
                        >
                            {isSubmitting ? (
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                >
                                    <Sparkles className="w-5 h-5" />
                                </motion.div>
                            ) : (
                                <>
                                    Create Account
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </motion.button>
                    </form>

                    {/* Terms */}
                    <p className="mt-4 text-xs text-neutral-400 text-center">
                        By signing up, you agree to our Terms of Service and Privacy Policy
                    </p>
                </div>

                {/* Sign In Link */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mt-6 text-center text-neutral-600"
                >
                    Already have an account?{' '}
                    <Link
                        to="/signin"
                        className="font-bold text-court-gold hover:text-court-goldDark transition-colors"
                    >
                        Sign in
                    </Link>
                </motion.p>
            </motion.div>
        </div>
    );
};

export default SignUpPage;
