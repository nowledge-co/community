import type { Logger } from '@slack/logger';
export interface SlackRequestVerificationOptions {
    signingSecret: string;
    body: string;
    headers: {
        'x-slack-signature': string;
        'x-slack-request-timestamp': number;
    };
    nowMilliseconds?: number;
    logger?: Logger;
}
/**
 * Verifies the signature of an incoming request from Slack.
 * If the request is invalid, this method throws an exception with the error details.
 */
export declare function verifySlackRequest(options: SlackRequestVerificationOptions): void;
/**
 * Verifies the signature of an incoming request from Slack.
 * If the request is invalid, this method returns false.
 */
export declare function isValidSlackRequest(options: SlackRequestVerificationOptions): boolean;
//# sourceMappingURL=verify-request.d.ts.map