import type { ReactNode } from 'react';
import { AccessDenied } from './AccessDenied';

interface PermissionGateProps {
    allowed: boolean;
    children?: ReactNode;
    deniedMessage?: string;
    deniedTitle?: string;
}

export const PermissionGate = ({
    allowed,
    children,
    deniedMessage,
    deniedTitle
}: PermissionGateProps) => {
    if (allowed) {
        return <>{children}</>;
    }

    return <AccessDenied title={deniedTitle} message={deniedMessage} />;
};
