import { useState, useEffect, useCallback } from 'react';
import { getBounties } from '../services/api';

/**
 * Transform raw bounty data from storage into the format expected by the UI
 */
const transformBountyData = (rawData) => {
  if (!rawData || !Array.isArray(rawData)) {
    return [];
  }

  return rawData.map((row) => ({
    id: row.id,
    meetup: row.meetup_id,
    businessType: row.business_type,
    description: row.description,
    status: row.status || 'active',
    createdAt: row.created_at || new Date().toISOString().split('T')[0],
    claimedAt: row.claimed_at || null,
    verifiedAt: row.verified_at || null,
    completedAt: row.completed_at || null,

    contributors: row.contributors || [],
    totalSats: row.totalSats || row.contributors?.reduce((sum, c) => sum + (c.sats || 0), 0) || 0,

    watchers: row.watchers || [],
    comments: row.comments || [],

    // Claim fields
    claimedBy: row.claimed_by || null,
    claimerEmail: row.claimer_email || null,
    businessName: row.business_name || null,
    googleMapsLink: row.google_maps_link || null,
    btcMapLink: row.btc_map_link || null,
    verifications: row.verifications || [],
  }));
};

/**
 * Custom hook to fetch and manage bounties
 */
export const useBounties = (meetupId) => {
  const [bounties, setBounties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBounties = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await getBounties(meetupId);

    if (result.success) {
      const transformed = transformBountyData(result.data);
      setBounties(transformed);
    } else {
      setError(result.error);
      setBounties([]);
    }

    setLoading(false);
  }, [meetupId]);

  useEffect(() => {
    if (meetupId) {
      fetchBounties();
    }
  }, [meetupId, fetchBounties]);

  return { bounties, loading, error, refetch: fetchBounties };
};

export default useBounties;
