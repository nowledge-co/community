import type { Logger } from '@slack/logger';
import type { ChatAppendStreamArguments, ChatStartStreamArguments, ChatStopStreamArguments } from './types/request';
import type { ChatAppendStreamResponse, ChatStartStreamResponse, ChatStopStreamResponse } from './types/response';
import type WebClient from './WebClient';
export interface ChatStreamerOptions {
    /**
     * @description The length of markdown_text to buffer in-memory before calling a method. Increasing this value decreases the number of method calls made for the same amount of text, which is useful to avoid rate limits.
     * @default 256
     */
    buffer_size?: number;
}
export declare class ChatStreamer {
    private buffer;
    private client;
    private logger;
    private options;
    private state;
    private streamArgs;
    private streamTs;
    private token;
    /**
     * Instantiate a new chat streamer.
     *
     * @description The "constructor" method creates a unique {@link ChatStreamer} instance that keeps track of one chat stream.
     * @example
     * const client = new WebClient(process.env.SLACK_BOT_TOKEN);
     * const logger = new ConsoleLogger();
     * const args = {
     *   channel: "C0123456789",
     *   thread_ts: "1700000001.123456",
     *   recipient_team_id: "T0123456789",
     *   recipient_user_id: "U0123456789",
     * };
     * const streamer = new ChatStreamer(client, logger, args, { buffer_size: 512 });
     * await streamer.append({
     *   markdown_text: "**hello world!**",
     * });
     * await streamer.stop();
     * @see {@link https://docs.slack.dev/reference/methods/chat.startStream}
     * @see {@link https://docs.slack.dev/reference/methods/chat.appendStream}
     * @see {@link https://docs.slack.dev/reference/methods/chat.stopStream}
     */
    constructor(client: WebClient, logger: Logger, args: ChatStartStreamArguments, options: ChatStreamerOptions);
    /**
     * Append to the stream.
     *
     * @description The "append" method appends to the chat stream being used. This method can be called multiple times. After the stream is stopped this method cannot be called.
     * @example
     * const streamer = client.chatStream({
     *   channel: "C0123456789",
     *   thread_ts: "1700000001.123456",
     *   recipient_team_id: "T0123456789",
     *   recipient_user_id: "U0123456789",
     * });
     * await streamer.append({
     *   markdown_text: "**hello wo",
     * });
     * await streamer.append({
     *   markdown_text: "rld!**",
     * });
     * await streamer.stop();
     * @see {@link https://docs.slack.dev/reference/methods/chat.appendStream}
     */
    append(args: Omit<ChatAppendStreamArguments, 'channel' | 'ts'>): Promise<ChatStartStreamResponse | ChatAppendStreamResponse | null>;
    /**
     * Stop the stream and finalize the message.
     *
     * @description The "stop" method stops the chat stream being used. This method can be called once to end the stream. Additional "blocks" and "metadata" can be provided.
     *
     * @example
     * const streamer = client.chatStream({
     *   channel: "C0123456789",
     *   thread_ts: "1700000001.123456",
     *   recipient_team_id: "T0123456789",
     *   recipient_user_id: "U0123456789",
     * });
     * await streamer.append({
     *   markdown_text: "**hello world!**",
     * });
     * await streamer.stop();
     * @see {@link https://docs.slack.dev/reference/methods/chat.stopStream}
     */
    stop(args?: Omit<ChatStopStreamArguments, 'channel' | 'ts'>): Promise<ChatStopStreamResponse>;
    private flushBuffer;
}
//# sourceMappingURL=chat-stream.d.ts.map