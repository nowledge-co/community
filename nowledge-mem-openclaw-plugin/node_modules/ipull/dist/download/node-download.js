import DownloadEngineNodejs from "./download-engine/engine/download-engine-nodejs.js";
import BaseDownloadEngine from "./download-engine/engine/base-download-engine.js";
import DownloadEngineMultiDownload from "./download-engine/engine/download-engine-multi-download.js";
import CliAnimationWrapper from "./transfer-visualize/transfer-cli/cli-animation-wrapper.js";
import { CLI_LEVEL } from "./transfer-visualize/transfer-cli/transfer-cli.js";
import { NoDownloadEngineProvidedError } from "./download-engine/engine/error/no-download-engine-provided-error.js";
const DEFAULT_PARALLEL_STREAMS_FOR_NODEJS = 3;
/**
 * Download one file with CLI progress
 */
export async function downloadFile(options) {
    // TODO: Remove in the next major version
    if (!("url" in options) && options.partsURL) {
        options.partURLs ??= options.partsURL;
    }
    options.parallelStreams ??= DEFAULT_PARALLEL_STREAMS_FOR_NODEJS;
    const downloader = DownloadEngineNodejs.createFromOptions(options);
    const wrapper = new CliAnimationWrapper(downloader, options);
    await wrapper.attachAnimation();
    return await downloader;
}
/**
 * Download multiple files with CLI progress
 */
export async function downloadSequence(options, ...downloads) {
    let downloadOptions = {};
    if (options instanceof BaseDownloadEngine || options instanceof Promise) {
        downloads.unshift(options);
    }
    else if (options) {
        downloadOptions = options;
    }
    if (downloads.length === 0) {
        throw new NoDownloadEngineProvidedError();
    }
    downloadOptions.cliLevel = CLI_LEVEL.HIGH;
    const downloader = DownloadEngineMultiDownload.fromEngines(downloads, downloadOptions);
    const wrapper = new CliAnimationWrapper(downloader, downloadOptions);
    await wrapper.attachAnimation();
    return await downloader;
}
//# sourceMappingURL=node-download.js.map