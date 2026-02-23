"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EdgeTTS = void 0;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const ws_1 = require("ws");
const https_proxy_agent_1 = require("https-proxy-agent");
const drm_1 = require("./drm");
function escapeXml(unsafe) {
    return unsafe.replace(/[<>&"']/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '"': return '&quot;';
            case "'": return '&apos;';
            default: return c;
        }
    });
}
class EdgeTTS {
    constructor({ voice = 'zh-CN-XiaoyiNeural', lang = 'zh-CN', outputFormat = 'audio-24khz-48kbitrate-mono-mp3', saveSubtitles = false, proxy, rate = 'default', pitch = 'default', volume = 'default', timeout = 10000 } = {}) {
        this.voice = voice;
        this.lang = lang;
        this.outputFormat = outputFormat;
        this.saveSubtitles = saveSubtitles;
        this.proxy = proxy;
        this.rate = rate;
        this.pitch = pitch;
        this.volume = volume;
        this.timeout = timeout;
    }
    async _connectWebSocket() {
        const wsConnect = new ws_1.WebSocket(`wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${drm_1.TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${(0, drm_1.generateSecMsGecToken)()}&Sec-MS-GEC-Version=1-${drm_1.CHROMIUM_FULL_VERSION}`, {
            host: 'speech.platform.bing.com',
            origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
            headers: {
                'Pragma': 'no-cache',
                'Cache-Control': 'no-cache',
                'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${drm_1.CHROMIUM_FULL_VERSION.split('.')[0]}.0.0.0 Safari/537.36 Edg/${drm_1.CHROMIUM_FULL_VERSION.split('.')[0]}.0.0.0`,
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            agent: this.proxy ? new https_proxy_agent_1.HttpsProxyAgent(this.proxy) : undefined
        });
        return new Promise((resolve, reject) => {
            wsConnect.on('open', () => {
                wsConnect.send(`Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n
          {
            "context": {
              "synthesis": {
                "audio": {
                  "metadataoptions": {
                    "sentenceBoundaryEnabled": "false",
                    "wordBoundaryEnabled": "true"
                  },
                  "outputFormat": "${this.outputFormat}"
                }
              }
            }
          }
        `);
                resolve(wsConnect);
            });
            wsConnect.on('error', (err) => {
                reject(err);
            });
        });
    }
    _saveSubFile(subFile, text, audioPath) {
        let subPath = audioPath + '.json';
        let subChars = text.split('');
        let subCharIndex = 0;
        subFile.forEach((cue, index) => {
            let fullPart = '';
            let stepIndex = 0;
            for (let sci = subCharIndex; sci < subChars.length; sci++) {
                if (subChars[sci] === cue.part[stepIndex]) {
                    fullPart = fullPart + subChars[sci];
                    stepIndex += 1;
                }
                else if (subChars[sci] === subFile?.[index + 1]?.part?.[0]) {
                    subCharIndex = sci;
                    break;
                }
                else {
                    fullPart = fullPart + subChars[sci];
                }
            }
            cue.part = fullPart;
        });
        (0, node_fs_1.writeFileSync)(subPath, JSON.stringify(subFile, null, '  '), { encoding: 'utf-8' });
    }
    async ttsPromise(text, audioPath) {
        const _wsConnect = await this._connectWebSocket();
        return new Promise((resolve, reject) => {
            let audioStream = (0, node_fs_1.createWriteStream)(audioPath);
            let subFile = [];
            let timeout = setTimeout(() => reject('Timed out'), this.timeout);
            _wsConnect.on('message', async (data, isBinary) => {
                if (isBinary) {
                    let separator = 'Path:audio\r\n';
                    let index = data.indexOf(separator) + separator.length;
                    let audioData = data.subarray(index);
                    audioStream.write(audioData);
                }
                else {
                    let message = data.toString();
                    if (message.includes('Path:turn.end')) {
                        audioStream.end();
                        audioStream.on('finish', () => {
                            _wsConnect.close();
                            if (this.saveSubtitles) {
                                this._saveSubFile(subFile, text, audioPath);
                            }
                            clearTimeout(timeout);
                            resolve();
                        });
                    }
                    else if (message.includes('Path:audio.metadata')) {
                        let splitTexts = message.split('\r\n');
                        try {
                            let metadata = JSON.parse(splitTexts[splitTexts.length - 1]);
                            metadata['Metadata'].forEach((element) => {
                                subFile.push({
                                    part: element['Data']['text']['Text'],
                                    start: Math.floor(element['Data']['Offset'] / 10000),
                                    end: Math.floor((element['Data']['Offset'] + element['Data']['Duration']) / 10000)
                                });
                            });
                        }
                        catch { }
                    }
                }
            });
            let requestId = (0, node_crypto_1.randomBytes)(16).toString('hex');
            _wsConnect.send(`X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n
      ` + `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${this.lang}">
        <voice name="${this.voice}">
          <prosody rate="${this.rate}" pitch="${this.pitch}" volume="${this.volume}">
            ${escapeXml(text)}
          </prosody>
        </voice>
      </speak>`);
        });
    }
}
exports.EdgeTTS = EdgeTTS;
