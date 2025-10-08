import type { StatusTone } from '../lib/status';

type StatusBadgeProps = {
  label: string;
  tone?: StatusTone;
};

export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {
  return <span className={`badge badge--${tone}`}>{label}</span>;
}
