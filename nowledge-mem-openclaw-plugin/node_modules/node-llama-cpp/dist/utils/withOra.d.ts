export default function withOra<T>(message: string | {
    loading: string;
    success?: string;
    fail?: string;
    useStatusLogs?: boolean;
    noSuccessLiveStatus?: boolean;
}, callback: () => Promise<T>): Promise<T>;
