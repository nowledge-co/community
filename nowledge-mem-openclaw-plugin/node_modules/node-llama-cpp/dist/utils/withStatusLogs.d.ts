export default function withStatusLogs<T>(messageAndOptions: string | {
    loading: string;
    success?: string;
    fail?: string;
    disableLogs?: boolean;
}, callback: () => Promise<T>): Promise<T>;
