import React from 'react'
import { captureException } from '../services/sentry'
import useAuthStore from '../store/useAuthStore'
import { DEFAULT_LANGUAGE, normalizeLanguage, translate } from '../i18n'

// Get translated text safely (handles class component context)
const getLanguage = () => {
    const preferredLanguage = useAuthStore.getState().preferredLanguage
    return normalizeLanguage(preferredLanguage) || DEFAULT_LANGUAGE
}

const getTranslatedText = (key, fallback, params) => {
    try {
        const translated = translate(getLanguage(), key, params)
        // If translation returns the key itself, use fallback
        if (typeof translated !== 'string' || translated === key) {
            return fallback
        }
        return translated
    } catch {
        // Intentionally ignored: i18n may be unavailable during error
        return fallback
    }
}

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false }
    }

    static getDerivedStateFromError() {
        return { hasError: true }
    }

    componentDidCatch(error, info) {
        console.error('[ErrorBoundary] Unhandled error:', error, info)
        captureException(error, { extra: info })
    }

    handleReset = () => {
        this.setState({ hasError: false })
        this.props.onReset?.()
    }

    render() {
        if (!this.state.hasError) {
            return this.props.children
        }

        // Get translated strings with fallbacks (CRITICAL-011 fix)
        const title = getTranslatedText('errors.somethingWentWrong', 'Something went wrong');
        const message = this.props.message || getTranslatedText('errors.tryAgainMessage', 'We hit a snag loading this screen. Try again.');
        const buttonText = getTranslatedText('common.tryAgain', 'Try again');

        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center bg-court-cream">
                <div className="text-2xl font-semibold text-court-brown">{title}</div>
                <p className="text-sm text-court-brownLight">
                    {message}
                </p>
                <button
                    type="button"
                    onClick={this.handleReset}
                    aria-label="Retry loading"
                    className="px-4 py-2 rounded-full bg-court-gold text-white font-semibold shadow"
                >
                    {buttonText}
                </button>
            </div>
        )
    }
}

export default ErrorBoundary
