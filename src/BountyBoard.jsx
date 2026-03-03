import React, { useState, useEffect } from 'react';
import useBounties from './hooks/useBounties';
import { useToast } from './components/Toast';
import { useNostrAuth } from './contexts/NostrAuthContext';
import NostrLoginModal from './components/NostrLoginModal';
import SettingsPanel from './components/SettingsPanel';
import { createBounty, addContribution, claimBounty, requestMeetup, addComment, getMeetups } from './services/api';
import { truncateNpub } from './services/nostr';

const businessTypes = [
  '🍜 Restaurant', '💈 Barber Shop', '☕ Coffee Shop', '🏪 Convenience Store',
  '🍺 Bar / Pub', '🏋️ Gym', '🧺 Laundromat', '🛒 Grocery Store',
  '🎮 Gaming Cafe', '📚 Bookstore', '🌸 Spa / Massage', '🔧 Auto Shop',
  '🥟 Night Market Stall', '🧋 Bubble Tea Shop', '🏨 Hotel', '📦 Other'
];

const formatSats = (sats) => {
  if (sats >= 1000000) return `${(sats / 1000000).toFixed(2)}M sats`;
  if (sats >= 1000) return `${(sats / 1000).toFixed(0)}K sats`;
  return `${sats} sats`;
};

/**
 * Format an ISO date string as relative time (e.g., "2 hours ago")
 */
const formatRelativeTime = (isoDateOrTimestamp) => {
  if (!isoDateOrTimestamp) return '';
  try {
    // Handle both Unix timestamps (seconds, from Nostr) and ISO date strings
    let date;
    if (typeof isoDateOrTimestamp === 'number') {
      // Unix timestamp — Nostr uses seconds, JS uses ms
      date = new Date(isoDateOrTimestamp * (isoDateOrTimestamp < 1e12 ? 1000 : 1));
    } else {
      date = new Date(isoDateOrTimestamp);
    }
    if (isNaN(date.getTime())) return String(isoDateOrTimestamp);

    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  } catch {
    return String(isoDateOrTimestamp); // Fallback to original string
  }
};

const StatusBadge = ({ status }) => {
  const styles = {
    active: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    pending_verification: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    completed: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  };
  const labels = {
    active: '🎯 Open Bounty',
    pending_verification: '⏳ Pending Verification',
    completed: '✅ Completed',
  };
  const style = styles[status] || 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
  const label = labels[status] || status || 'Unknown';
  return <span className={`px-3 py-1 rounded-full text-xs font-bold ${style}`}>{label}</span>;
};

const CommentsSection = ({ bounty, isExpanded, onToggle, newCommentValue, onCommentChange, onPostComment, commentCount, isLoggedIn, onLoginRequired }) => (
  <div className="mt-4 pt-4 border-t border-slate-700/50">
    <button onClick={onToggle} aria-expanded={isExpanded} className="flex items-center gap-2 text-slate-400 hover:text-orange-400 transition-colors group">
      <span className="group-hover:scale-110 transition-transform" aria-hidden="true">💬</span>
      <span className="font-medium text-sm">{commentCount} Comment{commentCount !== 1 ? 's' : ''}</span>
      <span className={`text-xs transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} aria-hidden="true">▶</span>
    </button>
    {isExpanded && (
      <div className="mt-3 space-y-3">
        {bounty.comments?.map((c, i) => (
          <div key={c.date ? `${c.date}-${i}` : i} className="bg-black/20 border border-slate-700/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-orange-100 font-medium text-sm">{c.name}</span>
              <span className="text-slate-500 text-xs">{formatRelativeTime(c.date)}</span>
            </div>
            <p className="text-slate-300 text-sm">{c.text}</p>
          </div>
        ))}
        {commentCount === 0 && <p className="text-slate-500 text-sm italic">No comments yet. Be the first!</p>}
        <div className="flex gap-2 mt-3 p-1">
          <label htmlFor={`comment-${bounty.id}`} className="sr-only">Add a comment</label>
          <input id={`comment-${bounty.id}`} type="text" placeholder="Add a comment..." value={newCommentValue}
            onChange={(e) => onCommentChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (isLoggedIn ? onPostComment() : onLoginRequired())}
            className="flex-1 bg-black/30 border border-slate-700/50 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50" />
          <button onClick={() => isLoggedIn ? onPostComment() : onLoginRequired()} className="bg-orange-600/80 hover:bg-orange-600 px-4 py-2 rounded-lg text-white text-sm font-medium transition-all">Post</button>
        </div>
      </div>
    )}
  </div>
);

/**
 * Confirmation Modal Component
 */
const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }) => {
  // Close on Escape key
  React.useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 bg-[#020617]/80 backdrop-blur-md flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-[#0f172a] rounded-2xl border border-slate-700/30 p-6 max-w-sm w-full ring-1 ring-white/5">
        <h3 id="confirm-modal-title" className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-slate-400 mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-white font-medium">Cancel</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-xl text-white font-bold">Confirm</button>
        </div>
      </div>
    </div>
  );
};

export default function BountyBoard() {
  const { user, isLoggedIn, logout } = useNostrAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('bounties');
  const [selectedMeetup, setSelectedMeetup] = useState(null);

  // Async meetup loading
  const [meetups, setMeetups] = useState([]);
  const [meetupsLoading, setMeetupsLoading] = useState(true);
  const [meetupError, setMeetupError] = useState(null);

  // Load meetups on mount
  useEffect(() => {
    const loadMeetups = async () => {
      try {
        const result = await getMeetups();
        if (result.success) {
          setMeetups(result.data);
          // Select first meetup by default, or none if empty
          if (result.data.length > 0 && !selectedMeetup) {
            setSelectedMeetup(result.data[0].id);
          }
        } else {
          setMeetupError(result.error);
        }
      } catch (err) {
        setMeetupError(err.message);
      } finally {
        setMeetupsLoading(false);
      }
    };
    loadMeetups();
  }, []);

  const { bounties: apiBounties, loading: bountiesLoading, refetch: refetchBounties } = useBounties(selectedMeetup);

  // Modal states
  const [showNostrLogin, setShowNostrLogin] = useState(false);
  const [showNewBounty, setShowNewBounty] = useState(false);
  const [showNewMeetup, setShowNewMeetup] = useState(false);
  const [showContribute, setShowContribute] = useState(null);
  const [showClaimModal, setShowClaimModal] = useState(null);
  const [showClaimConfirm, setShowClaimConfirm] = useState(false);
  const [expandedComments, setExpandedComments] = useState({});
  const [newComment, setNewComment] = useState({});

  // Form states
  const [newBountyData, setNewBountyData] = useState({ businessType: businessTypes[0], description: '', pledge: '' });
  const [claimData, setClaimData] = useState({ businessName: '', googleMapsLink: '', btcMapLink: '', lightningAddress: '', notes: '' });
  const [contributeData, setContributeData] = useState({ pledge: '' });
  const [newMeetupData, setNewMeetupData] = useState({ name: '', country: '' });
  const [formErrors, setFormErrors] = useState({});

  const displayName = user?.displayName || 'Anonymous';
  const filteredBounties = apiBounties.filter(b => b.status !== 'completed');
  const completedBounties = apiBounties.filter(b => b.status === 'completed');
  const currentMeetup = meetups.find(m => m.id === selectedMeetup);

  /**
   * Auth gate helper - shows login modal if not authenticated
   */
  const requireAuth = (action) => {
    if (!isLoggedIn) {
      setShowNostrLogin(true);
      return false;
    }
    return true;
  };

  const handleCreateBounty = async () => {
    // Validate
    const errors = {};
    if (!newBountyData.description.trim()) errors.description = 'Description is required';
    if (!newBountyData.pledge || parseInt(newBountyData.pledge) < 1000) errors.pledge = 'Minimum 1000 sats';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      const result = await createBounty({
        meetup_id: selectedMeetup,
        business_type: newBountyData.businessType,
        description: newBountyData.description,
        creator_pubkey: user?.publicKey
      });
      if (result.success) {
        await addContribution({
          bounty_id: result.data.id,
          name: displayName,
          sats: parseInt(newBountyData.pledge),
          pubkey: user?.publicKey
        });
        toast.success('Bounty created! 🚀');
        setShowNewBounty(false);
        setNewBountyData({ businessType: businessTypes[0], description: '', pledge: '' });
        setFormErrors({});
        refetchBounties();
      } else {
        toast.error(result.error || 'Failed to create bounty.');
      }
    } catch (err) {
      toast.error('Failed to create bounty.');
    }
  };

  const handleContribute = async () => {
    const sats = parseInt(contributeData.pledge);
    if (!sats || sats < 1) {
      setFormErrors({ pledge: 'Enter a valid amount' });
      return;
    }

    try {
      const result = await addContribution({
        bounty_id: showContribute,
        name: displayName,
        sats,
        pubkey: user?.publicKey
      });
      if (result.success) {
        toast.success('Sats added! ⚡');
        setShowContribute(null);
        setContributeData({ pledge: '' });
        setFormErrors({});
        refetchBounties();
      } else {
        toast.error(result.error || 'Failed to contribute.');
      }
    } catch (err) {
      toast.error('Failed to contribute.');
    }
  };

  const handleClaimBounty = async () => {
    // Validate
    const errors = {};
    if (!claimData.businessName.trim()) errors.businessName = 'Business name is required';
    if (!claimData.googleMapsLink.trim()) errors.googleMapsLink = 'Google Maps link is required';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      const result = await claimBounty({
        bounty_id: showClaimModal.id,
        claimer_name: displayName,
        business_name: claimData.businessName,
        google_maps_link: claimData.googleMapsLink,
        btc_map_link: claimData.btcMapLink,
        lightning_address: claimData.lightningAddress,
        notes: claimData.notes,
        pubkey: user?.publicKey
      });
      if (result.success) {
        toast.success('Bounty claimed! 🎉');
        setShowClaimModal(null);
        setClaimData({ businessName: '', googleMapsLink: '', btcMapLink: '', lightningAddress: '', notes: '' });
        setFormErrors({});
        refetchBounties();
      } else {
        toast.error(result.error || 'Failed to claim bounty.');
      }
    } catch (err) {
      toast.error('Failed to claim bounty.');
    }
  };

  const handlePostComment = async (bountyId) => {
    if (!newComment[bountyId]?.trim()) return;
    try {
      const result = await addComment({
        bounty_id: bountyId,
        commenter_name: displayName,
        comment: newComment[bountyId],
        pubkey: user?.publicKey
      });
      if (result.success) {
        setNewComment(prev => ({ ...prev, [bountyId]: '' }));
        refetchBounties();
      } else {
        toast.error(result.error || 'Failed to add comment.');
      }
    } catch (err) {
      console.error('Failed to add comment', err);
    }
  };

  const handleAddMeetup = async () => {
    if (!newMeetupData.name.trim()) {
      setFormErrors({ meetupName: 'Name is required' });
      return;
    }

    try {
      const result = await requestMeetup(newMeetupData);
      if (result.success) {
        // Refresh meetups list
        const updated = await getMeetups();
        if (updated.success) {
          setMeetups(updated.data);
          setSelectedMeetup(result.data.id);
        }
        setShowNewMeetup(false);
        setNewMeetupData({ name: '', country: '' });
        setFormErrors({});
        toast.success('Meetup added! 🌍');
      } else {
        setFormErrors({ meetupName: result.error });
      }
    } catch (err) {
      setFormErrors({ meetupName: err.message });
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans pb-20">

      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-orange-600/10 rounded-full blur-[120px] -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] translate-y-1/2"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 py-12">
        {/* Hero */}
        <header className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-slate-700/50 mb-8">
            <span className="animate-pulse text-orange-400">✨</span>
            <span className="text-xs font-bold tracking-widest uppercase bg-gradient-to-r from-orange-200 to-amber-100 bg-clip-text text-transparent">bitcoin++ taipei hackathon</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 font-display">
            <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">Sats for</span>{' '}
            <span className="bg-gradient-to-r from-orange-400 via-orange-500 to-amber-500 bg-clip-text text-transparent">Shops</span>
          </h1>
          <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">Stack sats. Onboard merchants. <span className="text-white">Sovereignty edition.</span></p>
          <div className="flex items-center justify-center gap-8 text-sm text-slate-500">
            {[['emerald', 'No Custody'], ['blue', 'P2P'], ['purple', 'Censorship Resistant']].map(([c, t]) => (
              <div key={t} className="flex items-center gap-2"><div className={`w-1.5 h-1.5 rounded-full bg-${c}-500`}></div><span>{t}</span></div>
            ))}
          </div>
        </header>

        {/* Control Bar */}
        <nav className="sticky top-4 z-40 bg-slate-900/90 backdrop-blur-xl border border-slate-700/30 p-2 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] mb-12 flex flex-col md:flex-row items-center gap-4 ring-1 ring-white/5" aria-label="Bounty board controls">
          <div className="relative group">
            <label htmlFor="meetup-select" className="sr-only">Select meetup</label>
            {meetupsLoading ? (
              <div className="bg-[#0f172a] border border-slate-700 rounded-xl pl-10 pr-10 py-2.5 text-slate-500 min-w-[200px]">Loading...</div>
            ) : meetupError ? (
              <div className="bg-[#0f172a] border border-red-700/50 rounded-xl pl-10 pr-10 py-2.5 text-red-400 min-w-[200px]" title={meetupError}>Failed to load meetups</div>
          ) : meetups.length === 0 ? (
              <div className="bg-[#0f172a] border border-slate-700 rounded-xl pl-10 pr-10 py-2.5 text-slate-500 min-w-[200px]">No meetups yet</div>
            ) : (
              <select id="meetup-select" value={selectedMeetup || ''} onChange={(e) => setSelectedMeetup(e.target.value)}
                className="appearance-none bg-[#0f172a] border border-slate-700 hover:border-orange-500/50 rounded-xl pl-10 pr-10 py-2.5 text-white font-medium focus:outline-none focus:ring-1 focus:ring-orange-500 transition-all cursor-pointer min-w-[200px]">
                {meetups.map(m => <option key={m.id} value={m.id} className="bg-slate-900">{m.country} {m.name}</option>)}
              </select>
            )}
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-lg pointer-events-none" aria-hidden="true">🌍</div>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-xs" aria-hidden="true">▼</div>
          </div>

          <div className="w-px h-8 bg-slate-700 hidden md:block"></div>

          <div className="flex items-center gap-6 overflow-x-auto px-2" aria-live="polite" aria-label="Meetup statistics">
            <div className="flex items-center gap-3"><div className="bg-orange-500/10 p-2 rounded-lg text-orange-400">⚡</div><div><div className="text-sm font-bold text-white">{formatSats(apiBounties.reduce((a, b) => a + (b.totalSats || 0), 0))}</div><div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Pooled</div></div></div>
            <div className="flex items-center gap-3"><div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-400">🎯</div><div><div className="text-sm font-bold text-white">{filteredBounties.length}</div><div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Active</div></div></div>
            <div className="flex items-center gap-3"><div className="bg-blue-500/10 p-2 rounded-lg text-blue-400">👥</div><div><div className="text-sm font-bold text-white">{currentMeetup?.members || 0}</div><div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Members</div></div></div>
          </div>

          <div className="flex-1"></div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            {isLoggedIn ? (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/50 rounded-xl border border-slate-700/50">
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-orange-500 flex items-center justify-center text-[10px] text-white font-bold">⚡</div>
                <span className="text-white text-sm font-medium font-mono">{truncateNpub(user.npub, 4)}</span>
                <button onClick={logout} aria-label="Logout" className="ml-2 text-slate-500 hover:text-red-400 text-xs transition-colors w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/10">✕</button>
              </div>
            ) : (
              <button onClick={() => setShowNostrLogin(true)} className="flex-1 md:flex-none bg-gradient-to-r from-purple-600 to-orange-500 px-4 py-2.5 rounded-xl text-white text-sm font-bold transition-all hover:shadow-lg hover:shadow-purple-500/20">⚡ Login</button>
            )}
            <button onClick={() => requireAuth() && setShowNewMeetup(true)} aria-label="Add a new meetup" className="flex-1 md:flex-none bg-orange-600 hover:bg-orange-500 px-4 py-2.5 rounded-xl text-white text-sm font-bold transition-all shadow-lg shadow-orange-500/20">+ New Meetup</button>
          </div>
        </nav>

        {/* Tabs */}
        <div className="flex justify-center mb-10">
          <div className="bg-slate-900/80 backdrop-blur-xl p-1.5 rounded-2xl border border-slate-700/30 inline-flex ring-1 ring-white/5" role="tablist" aria-label="Content sections">
            {[{ id: 'bounties', label: 'Active Bounties', icon: '🎯' }, { id: 'completed', label: 'Success Stories', icon: '✅' }, { id: 'how', label: 'How It Works', icon: '📖' }, ...(isLoggedIn ? [{ id: 'settings', label: 'Settings', icon: '⚙️' }] : [])].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                role="tab" aria-selected={activeTab === tab.id} aria-controls={`tabpanel-${tab.id}`} id={`tab-${tab.id}`}
                className={`relative px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === tab.id ? 'text-white shadow-lg' : 'text-slate-400 hover:text-white bg-slate-800/40'}`}>
                {activeTab === tab.id && <div className="absolute inset-0 bg-slate-700 rounded-xl border border-slate-600/50 z-0"></div>}
                <span className="relative z-10 text-lg" aria-hidden="true">{tab.icon}</span>
                <span className="relative z-10">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Active Bounties */}
        {activeTab === 'bounties' && (
          <div className="space-y-6">
            <button
              onClick={() => {
                if (!selectedMeetup) {
                  toast.info('Select or create a meetup first!');
                  return;
                }
                requireAuth() && setShowNewBounty(true);
              }}
              aria-label={selectedMeetup ? 'Create a new bounty' : 'Select a meetup to create a bounty'}
              className="group w-full relative overflow-hidden rounded-2xl p-[2px] transition-all hover:scale-[1.01] bg-gradient-to-r from-orange-600/60 via-amber-500/60 to-yellow-500/60 hover:from-orange-500 hover:via-amber-400 hover:to-yellow-400"
            >
              <div className="relative bg-[#0f172a] rounded-2xl p-6 flex items-center justify-center gap-4 group-hover:bg-slate-900/95">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center text-xl font-bold text-white shadow-lg">+</div>
                <span className="text-xl font-bold bg-gradient-to-r from-orange-200 to-yellow-200 bg-clip-text text-transparent">Create New Bounty</span>
              </div>
            </button>

            {bountiesLoading && <div className="text-center py-12"><div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div><p className="text-slate-400 mt-4">Loading bounties...</p></div>}

            {!bountiesLoading && filteredBounties.length === 0 && (
              <div className="text-center py-12 bg-slate-800/20 rounded-xl border border-slate-700/50">
                <div className="text-6xl mb-4">🎯</div>
                <p className="text-xl text-slate-300 font-medium mb-2">No bounties yet</p>
                <p className="text-slate-400">{meetups.length === 0 ? 'Create a meetup to get started!' : `Be the first to create a bounty for ${currentMeetup?.name || 'this meetup'}!`}</p>
              </div>
            )}

            {!bountiesLoading && filteredBounties.map(bounty => (
              <div key={bounty.id} className="group relative bg-slate-800/40 backdrop-blur-md rounded-2xl border border-slate-700/30 overflow-hidden transition-all hover:border-orange-500/40 hover:shadow-[0_8px_40px_rgba(234,88,12,0.15)]">
                <div className="p-6 relative">
                  <div className="flex items-start justify-between gap-6 mb-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3 flex-wrap">
                        <div className="bg-slate-700/50 p-2 rounded-lg text-2xl border border-slate-800">{bounty.businessType?.split(' ')[0] || '📦'}</div>
                        <h3 className="text-xl font-bold text-white">{bounty.businessType?.slice(2) || bounty.business_type?.slice(2) || 'Business'}</h3>
                        <StatusBadge status={bounty.status} />
                      </div>
                      <p className="text-slate-300 text-lg leading-relaxed mb-4 font-light">{bounty.description}</p>
                      {bounty.status === 'pending_verification' && (
                        <div className="mt-4 bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                          <div className="flex items-start gap-4">
                            <div className="bg-amber-500/20 p-2 rounded-lg text-amber-500">📍</div>
                            <div className="flex-1">
                              <div className="text-amber-200 font-bold text-lg mb-1">{bounty.businessName || bounty.business_name}</div>
                              <div className="text-amber-200/60 text-sm mb-3">Claimed by <span className="text-white font-medium">{bounty.claimedBy || bounty.claimed_by}</span> on {formatRelativeTime(bounty.claimedAt || bounty.claimed_at)}</div>
                              <div className="flex gap-3 flex-wrap">
                                <a href={bounty.googleMapsLink || bounty.google_maps_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 px-4 py-2 rounded-lg text-blue-300 text-sm font-medium transition-colors">🗺️ View Map</a>
                                {(bounty.btcMapLink || bounty.btc_map_link) && <a href={bounty.btcMapLink || bounty.btc_map_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 px-4 py-2 rounded-lg text-orange-300 text-sm font-medium transition-colors">₿ BTC Map</a>}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 text-center min-w-[140px]">
                        <div className="text-3xl font-black text-orange-400">{formatSats(bounty.totalSats || 0)}</div>
                        <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-1">Reward Pool</div>
                      </div>
                      <div className="mt-2 text-center text-slate-400 text-sm font-medium">{bounty.contributors?.length || 0} contributor{(bounty.contributors?.length || 0) !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap bg-[#020617]/50 rounded-xl p-3 border border-slate-800">
                    <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Stacked by:</span>
                    {bounty.contributors?.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-800">
                        <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-orange-500' : 'bg-slate-500'}`}></div>
                        <span className="text-sm text-slate-200 font-medium">{c.name}</span>
                        <span className="text-xs text-slate-500 font-mono">{formatSats(c.sats)}</span>
                      </div>
                    ))}
                    {bounty.status === 'active' && (
                      <button
                        onClick={() => requireAuth() && setShowContribute(bounty.id)}
                        className="ml-auto bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 border border-orange-500/30 px-4 py-1.5 rounded-lg text-sm font-bold transition-all"
                      >+ Add Sats</button>
                    )}
                  </div>
                  <CommentsSection
                    bounty={bounty}
                    isExpanded={expandedComments[bounty.id]}
                    onToggle={() => setExpandedComments(p => ({ ...p, [bounty.id]: !p[bounty.id] }))}
                    newCommentValue={newComment[bounty.id] || ''}
                    onCommentChange={(v) => setNewComment(p => ({ ...p, [bounty.id]: v }))}
                    commentCount={bounty.comments?.length || 0}
                    onPostComment={() => handlePostComment(bounty.id)}
                    isLoggedIn={isLoggedIn}
                    onLoginRequired={() => setShowNostrLogin(true)}
                  />
                </div>
                {bounty.status === 'active' && (
                  <div className="bg-black/20 border-t border-slate-800 px-6 py-4 flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-2 text-slate-500 text-sm"><span>🕒</span><span>Created {formatRelativeTime(bounty.createdAt || bounty.created_at)}</span></div>
                    <button
                      onClick={() => { if (requireAuth()) { setShowClaimConfirm(true); setShowClaimModal(bounty); } }}
                      className="bg-emerald-600 hover:bg-emerald-500 px-6 py-2.5 rounded-xl text-white font-bold text-sm transition-all shadow-lg shadow-emerald-600/20"
                    >🎉 I Onboarded a Business!</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Success Stories Tab */}
        {activeTab === 'completed' && (
          <div className="space-y-6">
            {completedBounties.length === 0 && (
              <div className="text-center py-20 bg-slate-800/30 rounded-3xl border border-slate-800 border-dashed">
                <div className="text-6xl mb-4 opacity-50">🏪</div>
                <h3 className="text-white font-bold text-xl mb-2">No merchants yet</h3>
                <p className="text-slate-400 max-w-sm mx-auto">Be the first to claim a bounty!</p>
                <button onClick={() => setActiveTab('bounties')} className="mt-6 text-orange-400 hover:text-orange-300 font-medium">View Active Bounties →</button>
              </div>
            )}
            {completedBounties.map(bounty => (
              <div key={bounty.id} className="bg-emerald-900/10 rounded-2xl border border-emerald-500/20 p-6 relative overflow-hidden hover:border-emerald-500/50 transition-all">
                <div className="flex items-start justify-between flex-wrap gap-6 mb-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2"><div className="bg-emerald-500/20 p-2 rounded-lg text-2xl">{bounty.businessType?.split(' ')[0] || bounty.business_type?.split(' ')[0] || '📦'}</div><div><h3 className="text-2xl font-bold text-white">{bounty.businessName || bounty.business_name}</h3><span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-xs font-bold">✅ Verified</span></div></div>
                    <div className="mt-4 flex items-center gap-2 text-slate-300"><div className="h-6 w-6 rounded-full bg-orange-500/20 flex items-center justify-center text-xs">👑</div><span>Onboarded by <span className="text-orange-300 font-bold">{bounty.claimedBy || bounty.claimed_by}</span></span></div>
                  </div>
                  <div className="text-right"><div className="bg-emerald-900/40 border border-emerald-500/20 rounded-xl p-4"><div className="text-3xl font-bold text-emerald-400">⚡ {formatSats(bounty.totalSats || 0)}</div><div className="text-emerald-200/60 text-xs font-bold uppercase tracking-wider mt-1">Paid Out</div></div></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* How It Works Tab */}
        {activeTab === 'how' && (
          <div className="bg-[#0f172a]/40 rounded-3xl border border-slate-700/30 p-8 md:p-12 relative overflow-hidden ring-1 ring-white/5">
            <div className="relative z-10 text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-black text-white mb-6 font-display">How It Works</h2>
              <p className="text-xl text-slate-400 max-w-2xl mx-auto">An honor-based system to incentivize real-world Bitcoin adoption.<br /><span className="text-orange-400 font-medium">Trust, Verify, Stack.</span></p>
            </div>
            <div className="max-w-4xl mx-auto grid md:grid-cols-5 gap-8 text-center">
              {[
                { title: 'Create or Stack', desc: 'Post a bounty or add sats to an existing one.', icon: '🎯', color: 'bg-orange-500' },
                { title: 'Onboard Merchant', desc: 'Help a business set up Lightning payments.', icon: '🤝', color: 'bg-orange-500' },
                { title: 'Verify', desc: 'Community visits and pays with Bitcoin.', icon: '✅', color: 'bg-emerald-500' },
                { title: 'Initial Payout', desc: '33% paid to the onboarder.', icon: '⚡', color: 'bg-emerald-500' },
                { title: 'Full Payout', desc: '67% after 3 months of activity.', icon: '📅', color: 'bg-blue-500' },
              ].map((step, i) => (
                <div key={i}>
                  <div className={`w-14 h-14 mx-auto rounded-full ${step.color} flex items-center justify-center text-2xl shadow-lg mb-4`}>{step.icon}</div>
                  <h3 className="text-white font-bold mb-2">{step.title}</h3>
                  <p className="text-slate-400 text-sm">{step.desc}</p>
                </div>
              ))}
            </div>
            <div className="grid md:grid-cols-2 gap-6 mt-20">
              <div className="p-8 bg-slate-900/50 rounded-2xl border border-slate-800 hover:border-orange-500/30 transition-colors"><div className="text-3xl mb-4">📧</div><h4 className="font-bold text-white mb-3 text-lg">Smart Notifications</h4><p className="text-slate-400 text-sm">Stay in the loop when bounties are claimed or verified.</p></div>
              <div className="p-8 bg-slate-900/50 rounded-2xl border border-slate-800 hover:border-emerald-500/30 transition-colors"><div className="text-3xl mb-4">🔗</div><h4 className="font-bold text-white mb-4 text-lg">Community Tools</h4><div className="flex gap-3 flex-wrap"><a href="https://btcmap.org" className="bg-orange-600/20 hover:bg-orange-600/30 text-orange-300 border border-orange-500/30 px-4 py-2 rounded-lg font-medium transition-colors">₿ BTC Map</a><a href="https://btcplusplus.dev/conf/taipei" className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 px-4 py-2 rounded-lg font-medium transition-colors">✨ bitcoin++ Taipei</a></div></div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && isLoggedIn && <SettingsPanel />}
      </div>

      {/* ===== MODALS ===== */}

      {/* Nostr Login */}
      <NostrLoginModal isOpen={showNostrLogin} onClose={() => setShowNostrLogin(false)} onSuccess={() => { setShowNostrLogin(false); toast.success('Welcome! ⚡'); }} />

      {/* Claim Confirmation Modal */}
      <ConfirmModal
        isOpen={showClaimConfirm && showClaimModal}
        title="Claim This Bounty?"
        message={`You're about to claim the ${showClaimModal?.businessType || showClaimModal?.business_type || ''} bounty for ${formatSats(showClaimModal?.totalSats || 0)}. Make sure you've actually onboarded a merchant!`}
        onConfirm={() => { setShowClaimConfirm(false); }}
        onCancel={() => { setShowClaimConfirm(false); setShowClaimModal(null); }}
      />

      {/* New Bounty Modal */}
      {showNewBounty && (
        <div
          className="fixed inset-0 bg-[#020617]/80 backdrop-blur-md flex items-center justify-center p-4 z-50"
          role="dialog" aria-modal="true" aria-labelledby="new-bounty-title"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowNewBounty(false); setFormErrors({}); } }}
          onKeyDown={(e) => { if (e.key === 'Escape') { setShowNewBounty(false); setFormErrors({}); } }}
        >
          <div className="bg-[#0f172a] rounded-3xl border border-slate-700/30 p-8 max-w-md w-full max-h-[90vh] overflow-y-auto relative ring-1 ring-white/5">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-orange-500 via-yellow-500 to-orange-500"></div>
            <h2 id="new-bounty-title" className="text-2xl font-bold text-white mb-6 font-display">Create New Bounty</h2>
            <div className="space-y-5">
              <div><label className="block text-slate-400 text-sm font-medium mb-2">Business Type</label><select value={newBountyData.businessType} onChange={(e) => setNewBountyData(p => ({ ...p, businessType: e.target.value }))} className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50">{businessTypes.map((t, i) => <option key={i} value={t} className="bg-slate-900">{t}</option>)}</select></div>
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-2">Description <span className="text-red-400">*</span></label>
                <textarea value={newBountyData.description} onChange={(e) => setNewBountyData(p => ({ ...p, description: e.target.value }))} rows={3} placeholder="Describe the type of business you want to see accepting Bitcoin..." className={`w-full bg-slate-900/50 border ${formErrors.description ? 'border-red-500' : 'border-slate-700/50'} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 resize-none placeholder-slate-600`} />
                {formErrors.description && <p className="text-red-400 text-xs mt-1">{formErrors.description}</p>}
              </div>
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-2">Initial Pledge (sats) <span className="text-red-400">*</span> <span className="text-slate-500 text-xs">min 1000</span></label>
                <input type="number" value={newBountyData.pledge} onChange={(e) => setNewBountyData(p => ({ ...p, pledge: e.target.value }))} placeholder="50000" className={`w-full bg-slate-900/50 border ${formErrors.pledge ? 'border-red-500' : 'border-slate-700/50'} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 placeholder-slate-600`} />
                {formErrors.pledge && <p className="text-red-400 text-xs mt-1">{formErrors.pledge}</p>}
              </div>
            </div>
            <div className="flex gap-3 mt-8"><button onClick={() => { setShowNewBounty(false); setFormErrors({}); }} className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-white font-medium">Cancel</button><button onClick={handleCreateBounty} className="flex-1 px-4 py-3 bg-orange-600 hover:bg-orange-500 rounded-xl text-white font-bold shadow-lg shadow-orange-600/20">Create Bounty ⚡</button></div>
          </div>
        </div>
      )}

      {/* Contribute Modal */}
      {showContribute && (
        <div
          className="fixed inset-0 bg-[#020617]/80 backdrop-blur-md flex items-center justify-center p-4 z-50"
          role="dialog" aria-modal="true" aria-labelledby="contribute-title"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowContribute(null); setFormErrors({}); } }}
          onKeyDown={(e) => { if (e.key === 'Escape') { setShowContribute(null); setFormErrors({}); } }}
        >
          <div className="bg-[#0f172a] rounded-3xl border border-slate-700/30 p-8 max-w-md w-full relative ring-1 ring-white/5">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-orange-500 to-yellow-500"></div>
            <h2 id="contribute-title" className="text-2xl font-bold text-white mb-2 font-display">Add Sats</h2>
            <p className="text-slate-400 mb-6">Increase the bounty reward pool.</p>
            <div>
              <label className="block text-slate-400 text-sm font-medium mb-2">Amount (sats) <span className="text-red-400">*</span></label>
              <input type="number" value={contributeData.pledge} onChange={(e) => setContributeData({ pledge: e.target.value })} placeholder="10000" className={`w-full bg-slate-900/50 border ${formErrors.pledge ? 'border-red-500' : 'border-slate-700/50'} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 placeholder-slate-600`} />
              {formErrors.pledge && <p className="text-red-400 text-xs mt-1">{formErrors.pledge}</p>}
            </div>
            <div className="flex gap-3 mt-8"><button onClick={() => { setShowContribute(null); setFormErrors({}); }} className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-white font-medium">Cancel</button><button onClick={handleContribute} className="flex-1 px-4 py-3 bg-orange-600 hover:bg-orange-500 rounded-xl text-white font-bold shadow-lg">Stack Sats ⚡</button></div>
          </div>
        </div>
      )}

      {/* Claim Modal */}
      {showClaimModal && !showClaimConfirm && (
        <div
          className="fixed inset-0 bg-[#020617]/80 backdrop-blur-md flex items-center justify-center p-4 z-50"
          role="dialog" aria-modal="true" aria-labelledby="claim-modal-title"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowClaimModal(null); setFormErrors({}); } }}
          onKeyDown={(e) => { if (e.key === 'Escape') { setShowClaimModal(null); setFormErrors({}); } }}
        >
          <div className="bg-[#0f172a] rounded-3xl border border-slate-700/30 p-8 max-w-md w-full max-h-[90vh] overflow-y-auto relative ring-1 ring-white/5">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 to-emerald-400"></div>
            <h2 id="claim-modal-title" className="text-2xl font-bold text-white mb-2 font-display">🎉 Claim Bounty</h2>
            <p className="text-slate-400 mb-6">I onboarded a {showClaimModal.businessType || showClaimModal.business_type} to accept Bitcoin!</p>
            <div className="space-y-4">
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-2">Business Name <span className="text-red-400">*</span></label>
                <input value={claimData.businessName} onChange={(e) => setClaimData(p => ({ ...p, businessName: e.target.value }))} placeholder="e.g., Wang's Coffee" className={`w-full bg-slate-900/50 border ${formErrors.businessName ? 'border-red-500' : 'border-slate-700/50'} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 placeholder-slate-600`} />
                {formErrors.businessName && <p className="text-red-400 text-xs mt-1">{formErrors.businessName}</p>}
              </div>
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-2">Google Maps Link <span className="text-red-400">*</span></label>
                <input value={claimData.googleMapsLink} onChange={(e) => setClaimData(p => ({ ...p, googleMapsLink: e.target.value }))} placeholder="https://maps.google.com/..." className={`w-full bg-slate-900/50 border ${formErrors.googleMapsLink ? 'border-red-500' : 'border-slate-700/50'} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 placeholder-slate-600`} />
                {formErrors.googleMapsLink && <p className="text-red-400 text-xs mt-1">{formErrors.googleMapsLink}</p>}
              </div>
              <div><label className="block text-slate-400 text-sm font-medium mb-2">BTC Map Link</label><input value={claimData.btcMapLink} onChange={(e) => setClaimData(p => ({ ...p, btcMapLink: e.target.value }))} placeholder="https://btcmap.org/..." className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 placeholder-slate-600" /></div>
              <div><label className="block text-slate-400 text-sm font-medium mb-2">Lightning Address</label><input value={claimData.lightningAddress} onChange={(e) => setClaimData(p => ({ ...p, lightningAddress: e.target.value }))} placeholder="you@walletofsatoshi.com" className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 placeholder-slate-600" /></div>
              <div><label className="block text-slate-400 text-sm font-medium mb-2">Notes</label><textarea value={claimData.notes} onChange={(e) => setClaimData(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Any additional details..." className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 resize-none placeholder-slate-600" /></div>
            </div>
            <div className="flex gap-3 mt-8"><button onClick={() => { setShowClaimModal(null); setFormErrors({}); }} className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-white font-medium">Cancel</button><button onClick={handleClaimBounty} className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-bold shadow-lg shadow-emerald-600/20">Submit Claim 🎉</button></div>
          </div>
        </div>
      )}

      {/* New Meetup Modal */}
      {showNewMeetup && (
        <div
          className="fixed inset-0 bg-[#020617]/80 backdrop-blur-md flex items-center justify-center p-4 z-50"
          role="dialog" aria-modal="true" aria-labelledby="new-meetup-title"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowNewMeetup(false); setFormErrors({}); } }}
          onKeyDown={(e) => { if (e.key === 'Escape') { setShowNewMeetup(false); setFormErrors({}); } }}
        >
          <div className="bg-[#0f172a] rounded-3xl border border-slate-700/30 p-8 max-w-md w-full relative ring-1 ring-white/5">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
            <h2 id="new-meetup-title" className="text-2xl font-bold text-white mb-6 font-display">Add New Meetup</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-2">Meetup Name <span className="text-red-400">*</span></label>
                <input value={newMeetupData.name} onChange={(e) => setNewMeetupData(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Austin Bitcoin" className={`w-full bg-slate-900/50 border ${formErrors.meetupName ? 'border-red-500' : 'border-slate-700/50'} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 placeholder-slate-600`} />
                {formErrors.meetupName && <p className="text-red-400 text-xs mt-1">{formErrors.meetupName}</p>}
              </div>
              <div><label className="block text-slate-400 text-sm font-medium mb-2">Country Flag Emoji</label><input value={newMeetupData.country} onChange={(e) => setNewMeetupData(p => ({ ...p, country: e.target.value }))} placeholder="🇺🇸" className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 placeholder-slate-600" /></div>
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={() => { setShowNewMeetup(false); setFormErrors({}); }} className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-white font-medium">Cancel</button>
              <button onClick={handleAddMeetup} className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-bold shadow-lg">Add Meetup 🌍</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
