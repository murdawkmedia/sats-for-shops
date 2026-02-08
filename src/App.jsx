import { useState } from 'react'
import BountyBoard from './BountyBoard'
import LandingPage from './LandingPage'
import ErrorBoundary from './components/ErrorBoundary'
import { ToastProvider } from './components/Toast'
import { NostrAuthProvider, useNostrAuth } from './contexts/NostrAuthContext'

function AppContent() {
  const { isLoggedIn, user } = useNostrAuth();
  const [hasEntered, setHasEntered] = useState(false);

  const handleEnter = () => {
    setHasEntered(true);
  };

  if (!hasEntered && !isLoggedIn) {
    return <LandingPage onEnter={handleEnter} />;
  }

  return (
    <div className="w-full h-full">
      <ToastProvider>
        <BountyBoard />
      </ToastProvider>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <NostrAuthProvider>
        <AppContent />
      </NostrAuthProvider>
    </ErrorBoundary>
  );
}

export default App
