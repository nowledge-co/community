"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFileUploadJob = getFileUploadJob;
exports.getMultipleFileUploadJobs = getMultipleFileUploadJobs;
exports.getFileData = getFileData;
exports.getFileDataLength = getFileDataLength;
exports.getFileDataAsStream = getFileDataAsStream;
exports.getAllFileUploadsToComplete = getAllFileUploadsToComplete;
exports.warnIfNotUsingFilesUploadV2 = warnIfNotUsingFilesUploadV2;
exports.warnIfChannels = warnIfChannels;
exports.errorIfChannelsCsv = errorIfChannelsCsv;
exports.errorIfInvalidOrMissingFileData = errorIfInvalidOrMissingFileData;
exports.warnIfMissingOrInvalidFileNameAndDefault = warnIfMissingOrInvalidFileNameAndDefault;
exports.warnIfLegacyFileType = warnIfLegacyFileType;
exports.buildMissingFileIdError = buildMissingFileIdError;
exports.buildFileSizeErrorMsg = buildFileSizeErrorMsg;
exports.buildLegacyFileTypeWarning = buildLegacyFileTypeWarning;
exports.buildMissingFileNameWarning = buildMissingFileNameWarning;
exports.buildMissingExtensionWarning = buildMissingExtensionWarning;
exports.buildLegacyMethodWarning = buildLegacyMethodWarning;
exports.buildGeneralFilesUploadWarning = buildGeneralFilesUploadWarning;
exports.buildFilesUploadMissingMessage = buildFilesUploadMissingMessage;
exports.buildChannelsWarning = buildChannelsWarning;
exports.buildMultipleChannelsErrorMsg = buildMultipleChannelsErrorMsg;
exports.buildInvalidFilesUploadParamError = buildInvalidFilesUploadParamError;
const node_fs_1 = require("node:fs");
const node_stream_1 = require("node:stream");
const errors_1 = require("./errors");
function getFileUploadJob(options, logger) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        // Validate parameters
        warnIfLegacyFileType(options, logger);
        warnIfChannels(options, logger);
        errorIfChannelsCsv(options);
        const fileName = warnIfMissingOrInvalidFileNameAndDefault(options, logger);
        const fileData = yield getFileData(options);
        const fileDataBytesLength = getFileDataLength(fileData);
        const fileUploadJob = {
            // supplied by user
            alt_text: options.alt_text,
            blocks: options.blocks,
            channel_id: (_a = options.channels) !== null && _a !== void 0 ? _a : options.channel_id,
            filename: (_b = options.filename) !== null && _b !== void 0 ? _b : fileName,
            initial_comment: options.initial_comment,
            snippet_type: options.snippet_type,
            title: (_d = (_c = options.title) !== null && _c !== void 0 ? _c : options.filename) !== null && _d !== void 0 ? _d : fileName, // default title to filename unless otherwise specified
            // calculated
            data: fileData,
            length: fileDataBytesLength,
        };
        if ('thread_ts' in options) {
            fileUploadJob.thread_ts = options.thread_ts;
        }
        if ('token' in options) {
            fileUploadJob.token = options.token;
        }
        if ('content' in options) {
            return Object.assign({ content: options.content }, fileUploadJob);
        }
        if ('file' in options) {
            return Object.assign({ file: options.file }, fileUploadJob);
        }
        throw (0, errors_1.errorWithCode)(new Error('Either a file or content field is required for valid file upload. You must supply one'), errors_1.ErrorCode.FileUploadInvalidArgumentsError);
    });
}
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
function getMultipleFileUploadJobs(options, logger) {
    return __awaiter(this, void 0, void 0, function* () {
        if ('file_uploads' in options) {
            // go through each file_upload and create a job for it
            return Promise.all(options.file_uploads.map((upload) => {
                // ensure no omitted properties included in files_upload entry
                // these properties are valid only at the top-level, not
                // inside file_uploads.
                const { blocks, channel_id, channels, initial_comment, thread_ts } = upload;
                if (blocks || channel_id || channels || initial_comment || thread_ts) {
                    throw (0, errors_1.errorWithCode)(new Error(buildInvalidFilesUploadParamError()), errors_1.ErrorCode.FileUploadInvalidArgumentsError);
                }
                // takes any channel_id, initial_comment and thread_ts
                // supplied at the top level.
                const uploadJobArgs = Object.assign(Object.assign({}, upload), { blocks: options.blocks, channels: options.channels, channel_id: options.channel_id, initial_comment: options.initial_comment });
                if ('thread_ts' in options) {
                    uploadJobArgs.thread_ts = options.thread_ts;
                }
                if ('token' in options) {
                    uploadJobArgs.token = options.token;
                }
                if ('content' in upload) {
                    return getFileUploadJob(Object.assign({ content: upload.content }, uploadJobArgs), logger);
                }
                if ('file' in upload) {
                    return getFileUploadJob(Object.assign({ file: upload.file }, uploadJobArgs), logger);
                }
                throw (0, errors_1.errorWithCode)(new Error('Either a file or content field is required for valid file upload. You must supply one'), errors_1.ErrorCode.FileUploadInvalidArgumentsError);
            }));
        }
        throw new Error(buildFilesUploadMissingMessage());
    });
}
// Helpers to build the FileUploadJob
/**
 * Returns a single file upload's data
 * @param options
 * @returns Binary data representation of file
 */
function getFileData(options) {
    return __awaiter(this, void 0, void 0, function* () {
        errorIfInvalidOrMissingFileData(options);
        if ('file' in options) {
            const { file } = options;
            // try to handle as buffer
            if (Buffer.isBuffer(file))
                return file;
            // try to handle as filepath
            if (typeof file === 'string') {
                // try to read file as if the string was a file path
                try {
                    const dataBuffer = (0, node_fs_1.readFileSync)(file);
                    return dataBuffer;
                }
                catch (_err) {
                    throw (0, errors_1.errorWithCode)(new Error(`Unable to resolve file data for ${file}. Please supply a filepath string, or binary data Buffer or String directly.`), errors_1.ErrorCode.FileUploadInvalidArgumentsError);
                }
            }
            // try to handle as Readable
            const data = yield getFileDataAsStream(file);
            if (data)
                return data;
        }
        if ('content' in options)
            return Buffer.from(options.content);
        // general catch-all error
        throw (0, errors_1.errorWithCode)(new Error('There was an issue getting the file data for the file or content supplied'), errors_1.ErrorCode.FileUploadReadFileDataError);
    });
}
function getFileDataLength(data) {
    if (data) {
        return Buffer.byteLength(data, 'utf8');
    }
    throw (0, errors_1.errorWithCode)(new Error(buildFileSizeErrorMsg()), errors_1.ErrorCode.FileUploadReadFileDataError);
}
function getFileDataAsStream(readable) {
    return __awaiter(this, void 0, void 0, function* () {
        const chunks = [];
        return new Promise((resolve, reject) => {
            readable.on('readable', () => {
                let chunk = readable.read();
                while (chunk !== null) {
                    chunks.push(chunk);
                    chunk = readable.read();
                }
            });
            readable.on('end', () => {
                if (chunks.length > 0) {
                    const content = Buffer.concat(chunks);
                    resolve(content);
                }
                else {
                    reject(Error('No data in supplied file'));
                }
            });
        });
    });
}
/**
 * Filters through all fileUploads and groups them into jobs for completion
 * based on combination of channel_id, thread_ts, initial_comment, blocks.
 * {@link https://docs.slack.dev/reference/methods/files.completeUploadExternal files.completeUploadExternal} allows for multiple
 * files to be uploaded with a message (`initial_comment`), and as a threaded message (`thread_ts`)
 * In order to be grouped together, file uploads must have like properties.
 * @param fileUploads
 * @returns
 */
function getAllFileUploadsToComplete(fileUploads) {
    const toComplete = {};
    for (const upload of fileUploads) {
        const { blocks, channel_id, thread_ts, initial_comment, file_id, title } = upload;
        if (file_id) {
            const compareString = `:::${channel_id}:::${thread_ts}:::${initial_comment}:::${JSON.stringify(blocks)}`;
            // biome-ignore lint/suspicious/noPrototypeBuiltins: TODO use hasOwn instead of hasOwnProperty
            if (!Object.prototype.hasOwnProperty.call(toComplete, compareString)) {
                toComplete[compareString] = {
                    files: [{ id: file_id, title }],
                    channel_id,
                    blocks,
                    initial_comment,
                };
                if (thread_ts && channel_id) {
                    const fileThreadDestinationArgument = {
                        channel_id,
                        thread_ts,
                    };
                    toComplete[compareString] = Object.assign(Object.assign({}, toComplete[compareString]), fileThreadDestinationArgument);
                }
                if ('token' in upload) {
                    toComplete[compareString].token = upload.token;
                }
            }
            else {
                toComplete[compareString].files.push({
                    id: file_id,
                    title,
                });
            }
        }
        else {
            throw new Error(buildMissingFileIdError());
        }
    }
    return toComplete;
}
// Validation
/**
 * Advise to use the files.uploadV2 method over legacy files.upload method and over
 * lower-level utilities.
 * @param method
 * @param logger
 */
function warnIfNotUsingFilesUploadV2(method, logger) {
    const targetMethods = ['files.upload'];
    const isTargetMethod = targetMethods.includes(method);
    if (method === 'files.upload')
        logger.warn(buildLegacyMethodWarning(method));
    if (isTargetMethod)
        logger.info(buildGeneralFilesUploadWarning());
}
/**
 * `channels` param is supported but only when a single channel is specified.
 * @param options
 * @param logger
 */
function warnIfChannels(options, logger) {
    if (options.channels)
        logger.warn(buildChannelsWarning());
}
/**
 * v1 files.upload supported `channels` parameter provided as a comma-separated
 * string of values, e.g. 'C1234,C5678'. V2 no longer supports this csv value.
 * You may still supply `channels` with a single channel string value e.g. 'C1234'
 * but it is highly encouraged to supply `channel_id` instead.
 * @param options
 */
function errorIfChannelsCsv(options) {
    const channels = options.channels ? options.channels.split(',') : [];
    if (channels.length > 1) {
        throw (0, errors_1.errorWithCode)(new Error(buildMultipleChannelsErrorMsg()), errors_1.ErrorCode.FileUploadInvalidArgumentsError);
    }
}
/**
 * Checks for either a file or content property and errors if missing
 * @param options
 */
function errorIfInvalidOrMissingFileData(options) {
    const hasFile = 'file' in options;
    const hasContent = 'content' in options;
    if (!(hasFile || hasContent) || (hasFile && hasContent)) {
        throw (0, errors_1.errorWithCode)(new Error('Either a file or content field is required for valid file upload. You cannot supply both'), errors_1.ErrorCode.FileUploadInvalidArgumentsError);
    }
    if ('file' in options) {
        const { file } = options;
        if (file && !(typeof file === 'string' || Buffer.isBuffer(file) || file instanceof node_stream_1.Readable)) {
            throw (0, errors_1.errorWithCode)(new Error('file must be a valid string path, buffer or Readable'), errors_1.ErrorCode.FileUploadInvalidArgumentsError);
        }
    }
    if ('content' in options && options.content && typeof options.content !== 'string') {
        throw (0, errors_1.errorWithCode)(new Error('content must be a string'), errors_1.ErrorCode.FileUploadInvalidArgumentsError);
    }
}
/**
 * @param options
 * @param logger
 * @returns filename if it exists
 */
function warnIfMissingOrInvalidFileNameAndDefault(options, logger) {
    var _a;
    const DEFAULT_FILETYPE = 'txt';
    const DEFAULT_FILENAME = `file.${(_a = options.filetype) !== null && _a !== void 0 ? _a : DEFAULT_FILETYPE}`;
    const { filename } = options;
    if (!filename) {
        // Filename was an optional property in legacy method
        logger.warn(buildMissingFileNameWarning());
        return DEFAULT_FILENAME;
    }
    if (filename.split('.').length < 2) {
        // likely filename is missing extension
        logger.warn(buildMissingExtensionWarning(filename));
    }
    return filename;
}
/**
 * `filetype` param is no longer supported and will be ignored
 * @param options
 * @param logger
 */
function warnIfLegacyFileType(options, logger) {
    if (options.filetype) {
        logger.warn(buildLegacyFileTypeWarning());
    }
}
// Validation message utilities
function buildMissingFileIdError() {
    return 'Missing required file id for file upload completion';
}
function buildFileSizeErrorMsg() {
    return 'There was an issue calculating the size of your file';
}
function buildLegacyFileTypeWarning() {
    return ('filetype is no longer a supported field in files.uploadV2.' +
        ' \nPlease remove this field. To indicate file type, please do so via the required filename property' +
        ' using the appropriate file extension, e.g. image.png, text.txt');
}
function buildMissingFileNameWarning() {
    return ('filename is a required field for files.uploadV2. \n For backwards compatibility and ease of migration, ' +
        'defaulting the filename. For best experience and consistent unfurl behavior, you' +
        ' should set the filename property with correct file extension, e.g. image.png, text.txt');
}
function buildMissingExtensionWarning(filename) {
    return `filename supplied '${filename}' may be missing a proper extension. Missing extenions may result in unexpected unfurl behavior when shared`;
}
function buildLegacyMethodWarning(method) {
    return `${method} may cause some issues like timeouts for relatively large files.`;
}
function buildGeneralFilesUploadWarning() {
    return ('Our latest recommendation is to use client.files.uploadV2() method, ' +
        'which is mostly compatible and much stabler, instead.');
}
function buildFilesUploadMissingMessage() {
    return 'Something went wrong with processing file_uploads';
}
function buildChannelsWarning() {
    return ("Although the 'channels' parameter is still supported for smoother migration from legacy files.upload, " +
        "we recommend using the new channel_id parameter with a single str value instead (e.g. 'C12345').");
}
function buildMultipleChannelsErrorMsg() {
    return 'Sharing files with multiple channels is no longer supported in v2. Share files in each channel separately instead.';
}
function buildInvalidFilesUploadParamError() {
    return ('You may supply file_uploads only for a single channel, message, or thread respectively. ' +
        'Therefore, please supply any channel_id, initial_comment or blocks, or thread_ts in the top-layer.');
}
//# sourceMappingURL=file-upload.js.map