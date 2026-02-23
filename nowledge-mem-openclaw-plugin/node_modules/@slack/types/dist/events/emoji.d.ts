export interface EmojiChangedEvent {
    type: 'emoji_changed';
    subtype: 'add' | 'remove' | 'rename';
    names?: string[];
    name?: string;
    value?: string;
    old_name?: string;
    new_name?: string;
    event_ts: string;
}
//# sourceMappingURL=emoji.d.ts.map