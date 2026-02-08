import React, { useState } from 'react';
import NostrLoginModal from './components/NostrLoginModal';
import { useNostrAuth } from './contexts/NostrAuthContext';

const LandingPage = ({ onEnter }) => {
  const [showLogin, setShowLogin] = useState(false);
  const { hasExtension } = useNostrAuth();

  const handleLoginSuccess = () => {
    setShowLogin(false);
    onEnter();
  };

  const handleBrowse = () => {
    onEnter();
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white overflow-hidden">
      {/* Ambient background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute -top-40 -right-32 w-[600px] h-[600px] bg-orange-600/8 rounded-full blur-[120px]"></div>
        <div className="absolute -bottom-40 -left-32 w-[500px] h-[500px] bg-purple-600/8 rounded-full blur-[120px]"></div>
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto" aria-label="Main navigation">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-yellow-400 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20" aria-hidden="true">
            <span className="text-2xl">⚡</span>
          </div>
          <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-300">
            Sats for Shops
          </span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/murdawkmedia/sats-for-shops"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-white transition-colors text-sm hidden sm:block"
          >
            GitHub
          </a>
          <button
            onClick={() => setShowLogin(true)}
            className="bg-gradient-to-r from-orange-500 to-yellow-500 text-slate-950 font-bold px-5 py-2.5 rounded-xl hover:shadow-lg hover:shadow-orange-500/20 transition-all duration-300 transform hover:scale-105 text-sm"
          >
            Login with Nostr
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-12 pb-20 md:pt-20 md:pb-32">
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-2 mb-8 text-sm">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" aria-hidden="true"></span>
            <span className="text-orange-300">Built at bitcoin++ Taipei 2025</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black leading-tight mb-6">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-yellow-300 to-orange-500">
              Stack Sats
            </span>
            <br />
            <span className="text-slate-200">for Local Shops</span>
          </h1>

          <p className="text-xl text-slate-400 leading-relaxed mb-10 max-w-2xl mx-auto">
            Community bounties that reward you for onboarding local businesses to accept Bitcoin.
            Contribute sats, claim bounties, and grow the circular economy — one shop at a time.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button
              onClick={() => setShowLogin(true)}
              className="w-full sm:w-auto bg-gradient-to-r from-orange-500 to-yellow-500 text-slate-950 font-bold px-8 py-4 rounded-xl text-lg shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-3"
            >
              <span className="text-2xl" aria-hidden="true">⚡</span>
              Get Started with Nostr
            </button>
            <button
              onClick={handleBrowse}
              className="w-full sm:w-auto bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 hover:border-slate-600 text-white font-bold px-8 py-4 rounded-xl text-lg transition-all duration-300 flex items-center justify-center gap-3"
            >
              Browse Bounties
            </button>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            <div className="bg-slate-800/40 backdrop-blur border border-slate-700/30 rounded-2xl p-6 text-left hover:border-orange-500/20 transition-colors group">
              <div className="text-3xl mb-3 group-hover:scale-110 transition-transform" aria-hidden="true">🎯</div>
              <h3 className="text-white font-bold mb-2">Create Bounties</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Post bounties for specific business types you want accepting Bitcoin in your area.
              </p>
            </div>
            <div className="bg-slate-800/40 backdrop-blur border border-slate-700/30 rounded-2xl p-6 text-left hover:border-orange-500/20 transition-colors group">
              <div className="text-3xl mb-3 group-hover:scale-110 transition-transform" aria-hidden="true">💰</div>
              <h3 className="text-white font-bold mb-2">Stack the Bounty</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Anyone can add sats to increase the reward and attract more onboarders.
              </p>
            </div>
            <div className="bg-slate-800/40 backdrop-blur border border-slate-700/30 rounded-2xl p-6 text-left hover:border-orange-500/20 transition-colors group">
              <div className="text-3xl mb-3 group-hover:scale-110 transition-transform" aria-hidden="true">🏪</div>
              <h3 className="text-white font-bold mb-2">Onboard & Earn</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Successfully onboard a business and claim the sats. Community verifies the merchant.
              </p>
            </div>
          </div>
        </div>

        {/* How it works section */}
        <div className="mt-24 max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { step: '01', icon: '📝', title: 'Someone creates a bounty', desc: '"We need a coffee shop in Da\'an accepting Lightning"' },
              { step: '02', icon: '📈', title: 'Community stacks sats', desc: 'Multiple people contribute sats to make the bounty attractive' },
              { step: '03', icon: '🤝', title: 'Onboarder claims it', desc: 'Someone goes to a shop, helps them set up Lightning payments' },
              { step: '04', icon: '✅', title: 'Community verifies', desc: 'Others confirm the shop accepts Bitcoin. Sats get paid out!' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="text-orange-500/30 text-5xl font-black mb-3">{item.step}</div>
                <div className="text-3xl mb-3">{item.icon}</div>
                <h3 className="text-white font-bold text-sm mb-2">{item.title}</h3>
                <p className="text-slate-500 text-xs leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Nostr info section */}
        <div className="mt-24 max-w-2xl mx-auto text-center">
          <div className="bg-gradient-to-br from-purple-900/20 to-slate-800/40 border border-purple-500/20 rounded-2xl p-8">
            <div className="text-4xl mb-4" aria-hidden="true">🔑</div>
            <h3 className="text-2xl font-bold text-purple-300 mb-3">Powered by Nostr</h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              No email sign-up, no passwords to remember. Sats for Shops uses Nostr — a decentralized identity protocol.
              Your public key is your identity. Login with a browser extension like{' '}
              <a href="https://getalby.com" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Alby</a>,
              or generate a new keypair right here.
            </p>
            <button
              onClick={() => setShowLogin(true)}
              className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-3 rounded-xl transition-all inline-flex items-center gap-2"
            >
              <span>🔌</span> {hasExtension ? 'Login with Extension' : 'Get Started'}
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/50 py-8 text-center text-slate-600 text-sm">
        <p>Built with ⚡ by the Bitcoin community. Open source and free forever.</p>
      </footer>

      {/* Login Modal */}
      <NostrLoginModal
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
        onSuccess={handleLoginSuccess}
      />
    </div>
  );
};

export default LandingPage;
