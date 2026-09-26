'use client'

import { ItemVelocity, getVelocityTierColor } from '@/lib/velocity'

interface VelocityBadgeProps {
  velocity?: ItemVelocity
  compact?: boolean
  showBurnRate?: boolean
}

export default function VelocityBadge({
  velocity,
  compact = false,
  showBurnRate = true,
}: VelocityBadgeProps) {
  if (!velocity) {
    return (
      <span className="velocity-badge stable">
        <span className="velocity-dot" />
        <span>Stable (No Burn)</span>
      </span>
    )
  }

  const { tier, daysRemaining, dailyBurnRate, label } = velocity
  const tierClass = tier.toLowerCase() // 'critical' | 'warning' | 'stable'

  return (
    <div className={`velocity-badge-container ${compact ? 'compact' : ''}`}>
      <span
        className={`velocity-badge ${tierClass}`}
        title={`Burn Rate: ${dailyBurnRate} units/day. Runway: ${
          daysRemaining !== null ? `${daysRemaining} days` : 'Unlimited'
        }`}
      >
        <span className="velocity-dot" />
        <span className="velocity-tier-text">
          {tier === 'CRITICAL' ? 'CRITICAL' : tier === 'WARNING' ? 'WARNING' : 'STABLE'}
        </span>
        <span className="velocity-runway-text">
          {daysRemaining !== null ? `${daysRemaining}d runway` : 'No burn'}
        </span>
      </span>

      {showBurnRate && dailyBurnRate > 0 && !compact && (
        <span className="velocity-burn-rate">
          ⚡ {dailyBurnRate} u/day
        </span>
      )}
    </div>
  )
}
