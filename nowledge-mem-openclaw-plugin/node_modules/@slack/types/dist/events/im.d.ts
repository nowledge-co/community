export interface IMCloseEvent {
    type: 'im_close';
    user: string;
    channel: string;
    event_ts: string;
}
export interface IMCreatedEvent {
    type: 'im_created';
    user: string;
    channel: {
        id: string;
    };
}
export interface IMHistoryChangedEvent {
    type: 'im_history_changed';
    latest: string;
    ts: string;
    event_ts: string;
}
export interface IMOpenEvent {
    type: 'im_open';
    user: string;
    channel: string;
    event_ts: string;
}
//# sourceMappingURL=im.d.ts.map