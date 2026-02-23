export declare function urlToObject(url: URL): {
    href: string;
    protocol: string;
    username: string;
    password: string;
    host: string;
    hostname: string;
    port: string;
    pathname: string;
    search: string;
    searchParams: {
        key: string;
        value: string;
    }[];
    hash: string;
    origin: string;
};
