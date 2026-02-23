export interface TokensRevokedEvent {
    type: 'tokens_revoked';
    tokens: {
        oauth?: string[];
        bot?: string[];
    };
}
//# sourceMappingURL=token.d.ts.map