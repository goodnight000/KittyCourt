import React from 'react'

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
    }

    handleReset = () => {
        this.setState({ hasError: false })
        this.props.onReset?.()
    }

    render() {
        if (!this.state.hasError) {
            return this.props.children
        }

        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center bg-court-cream">
                <div className="text-2xl font-semibold text-court-brown">Something went wrong</div>
                <p className="text-sm text-court-brownLight">
                    {this.props.message || 'We hit a snag loading this screen. Try again.'}
                </p>
                <button
                    type="button"
                    onClick={this.handleReset}
                    className="px-4 py-2 rounded-full bg-court-gold text-white font-semibold shadow"
                >
                    Try again
                </button>
            </div>
        )
    }
}

export default ErrorBoundary
