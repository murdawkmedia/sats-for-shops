/**
 * API Service — Hybrid Nostr + localStorage persistence.
 * 
 * Priority:
 * 1. Publish to Nostr relays when user is logged in
 * 2. Cache locally in localStorage for offline/fast access
 * 3. Fetch from Nostr on startup to sync with relay data
 * 
 * All write operations require authentication (pubkey).
 */
import storage from './storage';
import * as nostr from './nostr';

// Initialize storage on first import
storage.initializeStorage();

// ============================================================================
// BOUNTIES
// ============================================================================

/**
 * Get bounties — tries Nostr first, falls back to localStorage.
 */
export const getBounties = async (meetupId = null) => {
  try {
    // Try Nostr first
    const nostrBounties = await nostr.fetchBounties({ meetupId });

    if (nostrBounties.length > 0) {
      // Merge with local data for comments/contributions
      const localBounties = storage.getBounties(meetupId);
      const merged = mergeNostrWithLocal(nostrBounties, localBounties);
      return { success: true, data: merged, source: 'nostr' };
    }

    // Fallback to localStorage
    const data = storage.getBounties(meetupId);
    return { success: true, data, source: 'local' };
  } catch (err) {
    // On error, always try localStorage
    try {
      const data = storage.getBounties(meetupId);
      return { success: true, data, source: 'local-fallback' };
    } catch {
      return { success: false, error: err.message };
    }
  }
};

/**
 * Create a bounty — publishes to Nostr and caches locally.
 */
export const createBounty = async (bountyData) => {
  if (!bountyData.creator_pubkey) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    // Generate a unique ID
    const id = crypto.randomUUID();
    const fullData = { ...bountyData, id };

    // Try to publish to Nostr
    try {
      const event = await nostr.publishBounty({
        id,
        business_name: bountyData.business_name,
        business_type: bountyData.business_type,
        description: bountyData.description,
        satoshis: bountyData.satoshis,
        meetup_id: bountyData.meetup_id,
        status: 'active',
      });

      // Store event_id for future reference
      fullData.event_id = event.id;
      console.log('✅ Bounty published to Nostr:', event.id);
    } catch (nostrErr) {
      console.warn('⚠️ Failed to publish to Nostr, saving locally only:', nostrErr.message);
    }

    // Always save locally as cache
    const result = storage.createBounty(fullData);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

/**
 * Update a bounty status.
 */
export const updateBounty = async (bountyId, updates) => {
  try {
    // Try to update on Nostr
    try {
      if (updates.status) {
        await nostr.updateBounty(bountyId, updates);
        console.log('✅ Bounty updated on Nostr');
      }
    } catch (nostrErr) {
      console.warn('⚠️ Failed to update on Nostr:', nostrErr.message);
    }

    // Always update locally
    if (updates.status) {
      const result = storage.updateBountyStatus(bountyId, updates.status);
      return { success: !!result, data: result };
    }
    return { success: false, error: 'No supported update fields' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const deleteBounty = async (bountyId, pubkey) => {
  if (!pubkey) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    const result = storage.deleteBounty(bountyId, pubkey);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// ============================================================================
// CONTRIBUTORS
// ============================================================================

export const addContribution = async (contributionData) => {
  if (!contributionData.pubkey) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    const result = storage.addContribution(contributionData);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const getContributors = async (bountyId) => {
  try {
    const bounties = storage.getBounties();
    const bounty = bounties.find(b => b.id === bountyId);
    return { success: true, data: bounty?.contributors || [] };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// ============================================================================
// CLAIMS
// ============================================================================

export const claimBounty = async (claimData) => {
  if (!claimData.pubkey) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    // Update status on Nostr
    try {
      await nostr.updateBounty(claimData.bounty_id, {
        status: 'claimed',
        claimer_pubkey: claimData.pubkey,
      });
    } catch (nostrErr) {
      console.warn('⚠️ Failed to update claim on Nostr:', nostrErr.message);
    }

    const result = storage.claimBounty(claimData);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const getClaims = async (status = null) => {
  try {
    const bounties = storage.getBounties();
    let claimed = bounties.filter(b => b.claimed_by);
    if (status) {
      claimed = claimed.filter(b => b.status === status);
    }
    return { success: true, data: claimed };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// ============================================================================
// VERIFICATIONS
// ============================================================================

export const addVerification = async (verificationData) => {
  if (!verificationData.pubkey) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    const result = storage.addVerification(verificationData);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const getVerifications = async (claimId) => {
  try {
    const bounties = storage.getBounties();
    const bounty = bounties.find(b => b.id === claimId);
    return { success: true, data: bounty?.verifications || [] };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// ============================================================================
// COMMENTS
// ============================================================================

/**
 * Add a comment — publishes to Nostr (NIP-22) and caches locally.
 */
export const addComment = async (commentData) => {
  if (!commentData.pubkey) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    // Get bounty info for Nostr comment
    const bounties = storage.getBounties();
    const bounty = bounties.find(b => b.id === commentData.bounty_id);

    // Try to publish to Nostr if we have event_id
    if (bounty?.event_id && bounty?.creator_pubkey) {
      try {
        await nostr.publishComment({
          bountyEventId: bounty.event_id,
          bountyPubkey: bounty.creator_pubkey,
          text: commentData.comment,
        });
        console.log('✅ Comment published to Nostr');
      } catch (nostrErr) {
        console.warn('⚠️ Failed to publish comment to Nostr:', nostrErr.message);
      }
    }

    // Always save locally
    const result = storage.addComment(commentData);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

/**
 * Get comments — tries Nostr first, falls back to local.
 */
export const getComments = async (bountyId) => {
  try {
    // Get bounty to find event_id
    const bounties = storage.getBounties();
    const bounty = bounties.find(b => b.id === bountyId);

    // Try Nostr if we have event_id
    if (bounty?.event_id) {
      try {
        const nostrComments = await nostr.fetchComments(bounty.event_id);
        if (nostrComments.length > 0) {
          // Format for UI
          const formatted = nostrComments.map(c => ({
            name: nostr.truncateNpub(nostr.hexToNpub(c.pubkey)),
            text: c.text,
            date: formatRelativeTime(c.created_at * 1000),
            pubkey: c.pubkey,
          }));
          return { success: true, data: formatted, source: 'nostr' };
        }
      } catch (nostrErr) {
        console.warn('⚠️ Failed to fetch comments from Nostr:', nostrErr.message);
      }
    }

    // Fallback to local
    return { success: true, data: bounty?.comments || [], source: 'local' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// ============================================================================
// MEETUPS
// ============================================================================

/**
 * Get meetups — tries Nostr first, falls back to localStorage.
 */
export const getMeetups = async () => {
  try {
    // Try Nostr first
    const nostrMeetups = await nostr.fetchMeetups();

    if (nostrMeetups.length > 0) {
      // Merge with local
      const localMeetups = storage.getMeetups();
      const merged = mergeByField(nostrMeetups, localMeetups, 'id');
      return { success: true, data: merged, source: 'nostr' };
    }

    // Fallback to localStorage
    const data = storage.getMeetups();
    return { success: true, data, source: 'local' };
  } catch (err) {
    try {
      const data = storage.getMeetups();
      return { success: true, data, source: 'local-fallback' };
    } catch {
      return { success: false, error: err.message };
    }
  }
};

/**
 * Create a meetup — publishes to Nostr and caches locally.
 */
export const requestMeetup = async (meetupData) => {
  try {
    const id = meetupData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const fullData = { ...meetupData, id };

    // Try to publish to Nostr
    try {
      const event = await nostr.publishMeetup({
        id,
        name: meetupData.name,
        country: meetupData.country,
      });
      fullData.event_id = event.id;
      console.log('✅ Meetup published to Nostr:', event.id);
    } catch (nostrErr) {
      console.warn('⚠️ Failed to publish meetup to Nostr:', nostrErr.message);
    }

    // Always save locally (pass fullData so event_id is stored alongside the meetup)
    const result = storage.createMeetup(fullData);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const getMeetupData = async (meetupId) => {
  try {
    const bounties = storage.getBounties(meetupId);
    const claimed = bounties.filter(b => b.claimed_by);
    return { success: true, bounties, claims: claimed };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const getBountyDetails = async (bountyId) => {
  try {
    const bounties = storage.getBounties();
    const bounty = bounties.find(b => b.id === bountyId);
    return {
      success: true,
      contributors: bounty?.contributors || [],
      comments: bounty?.comments || [],
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Merge Nostr bounties with local bounties (local wins for comments/contributors).
 */
function mergeNostrWithLocal(nostrBounties, localBounties) {
  const localMap = new Map(localBounties.map(b => [b.id, b]));

  return nostrBounties.map(nb => {
    const local = localMap.get(nb.id);
    if (local) {
      // Use Nostr for core data, local for comments/contributors
      return {
        ...nb,
        comments: local.comments || [],
        contributors: local.contributors || [],
        verifications: local.verifications || [],
      };
    }
    return { ...nb, comments: [], contributors: [], verifications: [] };
  });
}

/**
 * Merge two arrays by a field, keeping unique entries.
 */
function mergeByField(arr1, arr2, field) {
  const seen = new Set();
  const result = [];

  for (const item of [...arr1, ...arr2]) {
    const key = item[field];
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }

  return result;
}

/**
 * Format a timestamp as relative time.
 */
function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

export default {
  getBounties,
  createBounty,
  updateBounty,
  deleteBounty,
  addContribution,
  getContributors,
  claimBounty,
  getClaims,
  addVerification,
  getVerifications,
  addComment,
  getComments,
  getMeetups,
  requestMeetup,
  getMeetupData,
  getBountyDetails,
};
