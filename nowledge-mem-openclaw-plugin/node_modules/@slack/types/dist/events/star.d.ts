export interface StarAddedEvent {
    type: 'star_added';
    user: string;
    item: Record<string, unknown>;
    event_ts: string;
}
export interface StarRemovedEvent {
    type: 'star_removed';
    user: string;
    item: Record<string, unknown>;
    event_ts: string;
}
//# sourceMappingURL=star.d.ts.map