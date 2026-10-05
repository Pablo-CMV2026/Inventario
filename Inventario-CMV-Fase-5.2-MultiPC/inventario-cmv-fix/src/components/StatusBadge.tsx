import type { AssetCondition, AssetLifecycleStatus, AssetOperationalStatus } from '../types/inventory'
import { assetConditionLabels, assetLifecycleStatusLabels, assetOperationalStatusLabels } from '../types/inventory'

type Props =
  | { kind: 'condition'; value: AssetCondition }
  | { kind: 'operational'; value: AssetOperationalStatus }
  | { kind: 'lifecycle'; value: AssetLifecycleStatus }

export function StatusBadge(props: Props) {
  const label = props.kind === 'condition'
    ? assetConditionLabels[props.value]
    : props.kind === 'operational'
      ? assetOperationalStatusLabels[props.value]
      : assetLifecycleStatusLabels[props.value]

  return <span className={`status-badge ${props.kind} ${props.value}`}>{label}</span>
}
