# node-edge-tts

node-edge-tts is a module that utilizes Microsoft Edge's online TTS (Text-to-Speech) service on Node.js


## Installation

```
npm install node-edge-tts
```

#### Or you can directly use it in the command line.
```
npx node-edge-tts -t 'Hello world'
```


## Command line usage
```
Usage: npx node-edge-tts [options]

Options:
      --help           Show help                                       [boolean]
      --version        Show version number                             [boolean]
  -t, --text           The text to be converted to speech    [string] [required]
  -f, --filepath       The output file path   [string] [default: "./output.mp3"]
  -v, --voice          The voice to be used
                                        [string] [default: "zh-CN-XiaoyiNeural"]
  -l, --lang           The language to be used       [string] [default: "zh-CN"]
  -o, --outputFormat   The output format
                           [string] [default: "audio-24khz-48kbitrate-mono-mp3"]
      --pitch          The pitch of the voice      [string] [default: "default"]
  -r, --rate           The rate of the voice       [string] [default: "default"]
      --volume         The volume of the voice     [string] [default: "default"]
  -s, --saveSubtitles  Whether to save subtitles      [boolean] [default: false]
  -p, --proxy          example: http://localhost:7890                   [string]
      --timeout        The timeout of the request      [number] [default: 10000]

Examples:
  npx node-edge-tts -t 'Hello world' -f './output.mp3'
```


## Module usage

```
const { EdgeTTS } = require('node-edge-tts')
```
or
```
import { EdgeTTS } from 'node-edge-tts'
```

```
const tts = new EdgeTTS()
await tts.ttsPromise('Hello world', path_to_audiofile_with_extension)
```

### configure
```
const tts = new EdgeTTS({
  voice: 'en-US-AriaNeural',
  lang: 'en-US',
  outputFormat: 'audio-24khz-96kbitrate-mono-mp3',
  saveSubtitles: true,
  proxy: 'http://localhost:7890',
  pitch: '-10%',
  rate: '+10%',
  volume: '-50%',
  timeout: 10000
})
```
You can find the available options for speechconfig at [voice/lang](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts)|[outputFormat](https://learn.microsoft.com/en-us/dotnet/api/microsoft.cognitiveservices.speech.speechsynthesisoutputformat?view=azure-dotnet)|[pitch/rate/volume](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-synthesis-markup-voice), but not all options are available due to limitations of the services provided by Microsoft Edge.

### subtitles
Subtitles are json files with the same name as the audio file, as shown below:
```
\\ the *start* is the time point at which the *part* begins,
\\ the *end* is the time point at which the *part* ends,
\\ measured in milliseconds.
[
  { "part": "node-edge-tts ", "start": 100, "end": 1287 },
  { "part": "is ", "start": 1287, "end": 1450 },
  { "part": "a ", "start": 1450, "end": 1500 },
  { "part": "module ", "start": 1500, "end": 2037 },
  { "part": "that ", "start": 2037, "end": 2350 },
  { "part": "utilizes ", "start": 2350, "end": 3162 },
  { "part": "Microsoft ", "start": 3162, "end": 3762 },
  { "part": "Edge's ", "start": 3762, "end": 4212 },
  { "part": "online ", "start": 4212, "end": 4750 },
  { "part": "TTS (", "start": 4750, "end": 5450 },
  { "part": "Text-to-Speech) ", "start": 5600, "end": 6637 },
  { "part": "service ", "start": 6800, "end": 7387 },
  { "part": "on ", "start": 7387, "end": 7600 },
  { "part": "Node.", "start": 7600, "end": 7950 },
  { "part": "js", "start": 8012, "end": 8762 }
]
```
