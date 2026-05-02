// TODO: replace mock with real API call once backend exposes GET /api/robots/current
export interface Robot {
    id: string;
    name: string;
    location: string;
}

export function useRobot(): { data: Robot | null; loading: boolean } {
    const mock: Robot = {
        id: 'mock-robot-1',
        name: 'Lobby Guard',
        location: 'Hallway A',
    };

    return { data: mock, loading: false };
}