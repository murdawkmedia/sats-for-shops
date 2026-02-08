import React from 'react';

/**
 * Error Boundary Component
 * Catches JavaScript errors in child components and displays a fallback UI.
 * Accessible: uses role="alert" and auto-focuses on render.
 */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
        this.errorRef = React.createRef();
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({ error, errorInfo });
    }

    componentDidUpdate(prevProps, prevState) {
        // Focus the error container when error appears (accessibility)
        if (this.state.hasError && !prevState.hasError && this.errorRef.current) {
            this.errorRef.current.focus();
        }
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-orange-950 flex items-center justify-center p-4">
                    <div
                        ref={this.errorRef}
                        role="alert"
                        aria-live="assertive"
                        tabIndex={-1}
                        className="max-w-lg w-full bg-slate-900/50 backdrop-blur-xl border border-red-500/30 rounded-2xl p-8 text-center animate-scale-in focus:outline-none"
                    >
                        <div className="text-6xl mb-4" aria-hidden="true">💥</div>
                        <h1 className="text-2xl font-bold text-red-400 mb-4">
                            Oops! Something went wrong
                        </h1>
                        <p className="text-slate-400 mb-6">
                            The app encountered an unexpected error. Don't worry — your data is safe.
                        </p>

                        {/* Error details (development only) */}
                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <div className="bg-slate-950/50 rounded-lg p-4 mb-6 text-left overflow-auto max-h-48">
                                <p className="text-red-400 text-sm font-mono">
                                    {this.state.error.toString()}
                                </p>
                                {this.state.errorInfo && (
                                    <pre className="text-slate-500 text-xs mt-2 whitespace-pre-wrap">
                                        {this.state.errorInfo.componentStack}
                                    </pre>
                                )}
                            </div>
                        )}

                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={this.handleReset}
                                className="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg transition-colors"
                            >
                                Try Again
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors"
                            >
                                Reload Page
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
