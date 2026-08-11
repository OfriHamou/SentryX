import type { AutoPatrolStatus } from '../hooks/robot/useAutoPatrolStatus';

const PATROL_STATE_LABELS: Record<string, string> =
{
    forward: 'Driving forward',
    moving: 'Driving forward',
    avoiding: 'Avoiding an obstacle',
    waiting_clear: 'Waiting for the path to clear',
    starting: 'Starting…',
    stopped: 'Stopped',
    idle: 'Idle',
};

export function patrolStateLabel(state?: string): string
{
    if (!state)
    {
        return 'Unknown';
    }

    const label = PATROL_STATE_LABELS[state];

    if (label)
    {
        return label;
    }
    else
    {
        return state.replace(/_/g, ' ');
    }
}

export function detectionText(detection: AutoPatrolStatus['last_detection']): string | null
{
    if (!detection || !detection.name)
    {
        return null;
    }

    const scorePercent = Math.round((detection.score ?? 0) * 100);
    return `${detection.name} · ${scorePercent}%`;
}
