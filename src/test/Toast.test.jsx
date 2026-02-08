import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ToastProvider, useToast } from '../components/Toast';

// Test component that uses the toast hook
const TestComponent = () => {
    const toast = useToast();
    return (
        <div>
            <button onClick={() => toast.success('Success!')}>Show Success</button>
            <button onClick={() => toast.error('Error!')}>Show Error</button>
        </div>
    );
};

describe('Toast Component', () => {
    it('renders without crashing', () => {
        render(
            <ToastProvider>
                <div>Test</div>
            </ToastProvider>
        );
        expect(screen.getByText('Test')).toBeInTheDocument();
    });

    it('provides toast context to children', () => {
        render(
            <ToastProvider>
                <TestComponent />
            </ToastProvider>
        );
        expect(screen.getByText('Show Success')).toBeInTheDocument();
        expect(screen.getByText('Show Error')).toBeInTheDocument();
    });

    it('throws error when used outside provider', () => {
        // This would throw, so we test the error boundary catches it
        expect(() => {
            render(<TestComponent />);
        }).toThrow('useToast must be used within a ToastProvider');
    });
});
