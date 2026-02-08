import React from 'react';

/**
 * Skeleton loading components for better UX during data fetch
 */

// Base skeleton with pulse animation
export const Skeleton = ({ className = '' }) => (
    <div className={`animate-pulse bg-slate-700/50 rounded ${className}`} />
);

// Bounty card skeleton
export const BountyCardSkeleton = () => (
    <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 rounded-2xl border border-slate-700/30 p-6 mb-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
                <Skeleton className="w-12 h-12 rounded-xl" />
                <div>
                    <Skeleton className="w-32 h-5 mb-2" />
                    <Skeleton className="w-24 h-4" />
                </div>
            </div>
            <Skeleton className="w-24 h-6 rounded-full" />
        </div>

        {/* Description */}
        <Skeleton className="w-full h-16 mb-4" />

        {/* Stats row */}
        <div className="flex gap-6 mb-4">
            <Skeleton className="w-20 h-8" />
            <Skeleton className="w-20 h-8" />
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
            <Skeleton className="flex-1 h-10 rounded-xl" />
            <Skeleton className="flex-1 h-10 rounded-xl" />
        </div>
    </div>
);

// Multiple bounty cards skeleton
export const BountyListSkeleton = ({ count = 3 }) => (
    <div className="space-y-4">
        {Array.from({ length: count }).map((_, i) => (
            <BountyCardSkeleton key={i} />
        ))}
    </div>
);

// Admin panel skeleton
export const AdminPanelSkeleton = () => (
    <div className="p-6">
        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-slate-800/50 rounded-xl p-4">
                    <Skeleton className="w-16 h-4 mb-2" />
                    <Skeleton className="w-12 h-8" />
                </div>
            ))}
        </div>

        {/* Table skeleton */}
        <div className="bg-slate-800/30 rounded-xl overflow-hidden">
            <div className="bg-slate-700/50 p-4">
                <Skeleton className="w-32 h-5" />
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 border-t border-slate-700/30 flex gap-4">
                    <Skeleton className="w-1/4 h-4" />
                    <Skeleton className="w-1/4 h-4" />
                    <Skeleton className="w-1/4 h-4" />
                    <Skeleton className="w-1/4 h-4" />
                </div>
            ))}
        </div>
    </div>
);

// Inline text skeleton
export const TextSkeleton = ({ width = 'w-24', height = 'h-4' }) => (
    <Skeleton className={`${width} ${height} inline-block`} />
);

export default {
    Skeleton,
    BountyCardSkeleton,
    BountyListSkeleton,
    AdminPanelSkeleton,
    TextSkeleton,
};
