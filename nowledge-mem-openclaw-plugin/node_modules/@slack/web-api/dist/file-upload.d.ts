import { Readable } from 'node:stream';
import type { Logger } from '@slack/logger';
import type { FilesCompleteUploadExternalArguments, FilesUploadV2Arguments, FileUploadV2, FileUploadV2Job } from './types/request/files';
export declare function getFileUploadJob(options: FilesUploadV2Arguments | FileUploadV2, logger: Logger): Promise<FileUploadV2Job>;
/**
 * Returns an array of files upload entries when `file_uploads` is supplied.
 * **Note**
 * file_uploads should be set when multiple files are intended to be attached to a
 * single message. To support this, we handle options supplied with
 * top level `initial_comment`, `thread_ts`, `channel_id` and `file_uploads` parameters.
 * ```javascript
 * const res = await client.files.uploadV2({
 *   initial_comment: 'Here are the files!',
 *   thread_ts: '1223313423434.131321',
 *   channel_id: 'C12345',
 *   file_uploads: [
 *     {
 *       file: './test/fixtures/test-txt.txt',
 *       filename: 'test-txt.txt',
 *     },
 *     {
 *       file: './test/fixtures/test-png.png',
 *       filename: 'test-png.png',
 *     },
 *   ],
 * });
 * ```
 * @param options provided by user
 */
export declare function getMultipleFileUploadJobs(options: FilesUploadV2Arguments, logger: Logger): Promise<FileUploadV2Job[]>;
/**
 * Returns a single file upload's data
 * @param options
 * @returns Binary data representation of file
 */
export declare function getFileData(options: FilesUploadV2Arguments | FileUploadV2): Promise<Buffer>;
export declare function getFileDataLength(data: Buffer): number;
export declare function getFileDataAsStream(readable: Readable): Promise<Buffer>;
/**
 * Filters through all fileUploads and groups them into jobs for completion
 * based on combination of channel_id, thread_ts, initial_comment, blocks.
 * {@link https://docs.slack.dev/reference/methods/files.completeUploadExternal files.completeUploadExternal} allows for multiple
 * files to be uploaded with a message (`initial_comment`), and as a threaded message (`thread_ts`)
 * In order to be grouped together, file uploads must have like properties.
 * @param fileUploads
 * @returns
 */
export declare function getAllFileUploadsToComplete(fileUploads: FileUploadV2Job[]): Record<string, FilesCompleteUploadExternalArguments>;
/**
 * Advise to use the files.uploadV2 method over legacy files.upload method and over
 * lower-level utilities.
 * @param method
 * @param logger
 */
export declare function warnIfNotUsingFilesUploadV2(method: string, logger: Logger): void;
/**
 * `channels` param is supported but only when a single channel is specified.
 * @param options
 * @param logger
 */
export declare function warnIfChannels(options: FilesUploadV2Arguments | FileUploadV2, logger: Logger): void;
/**
 * v1 files.upload supported `channels` parameter provided as a comma-separated
 * string of values, e.g. 'C1234,C5678'. V2 no longer supports this csv value.
 * You may still supply `channels` with a single channel string value e.g. 'C1234'
 * but it is highly encouraged to supply `channel_id` instead.
 * @param options
 */
export declare function errorIfChannelsCsv(options: FilesUploadV2Arguments | FileUploadV2): void;
/**
 * Checks for either a file or content property and errors if missing
 * @param options
 */
export declare function errorIfInvalidOrMissingFileData(options: FilesUploadV2Arguments | FileUploadV2): void;
/**
 * @param options
 * @param logger
 * @returns filename if it exists
 */
export declare function warnIfMissingOrInvalidFileNameAndDefault(options: FilesUploadV2Arguments | FileUploadV2, logger: Logger): string;
/**
 * `filetype` param is no longer supported and will be ignored
 * @param options
 * @param logger
 */
export declare function warnIfLegacyFileType(options: FilesUploadV2Arguments | FileUploadV2, logger: Logger): void;
export declare function buildMissingFileIdError(): string;
export declare function buildFileSizeErrorMsg(): string;
export declare function buildLegacyFileTypeWarning(): string;
export declare function buildMissingFileNameWarning(): string;
export declare function buildMissingExtensionWarning(filename: string): string;
export declare function buildLegacyMethodWarning(method: string): string;
export declare function buildGeneralFilesUploadWarning(): string;
export declare function buildFilesUploadMissingMessage(): string;
export declare function buildChannelsWarning(): string;
export declare function buildMultipleChannelsErrorMsg(): string;
export declare function buildInvalidFilesUploadParamError(): string;
//# sourceMappingURL=file-upload.d.ts.map