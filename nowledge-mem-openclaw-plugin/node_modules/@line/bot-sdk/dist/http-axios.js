import axios from "axios";
import { Readable } from "node:stream";
import { HTTPError, ReadError, RequestError } from "./exceptions.js";
import { USER_AGENT } from "./version.js";
export default class HTTPClient {
    instance;
    config;
    constructor(config = {}) {
        this.config = config;
        const { baseURL, defaultHeaders } = config;
        this.instance = axios.create({
            baseURL,
            headers: {
                ...defaultHeaders,
                "User-Agent": USER_AGENT,
            },
        });
        this.instance.interceptors.response.use(res => res, err => Promise.reject(this.wrapError(err)));
    }
    async get(url, params) {
        const res = await this.instance.get(url, { params });
        return res.data;
    }
    async getStream(url, params) {
        const res = await this.instance.get(url, {
            params,
            responseType: "stream",
        });
        return res.data;
    }
    async post(url, body, config) {
        const res = await this.instance.post(url, body, {
            headers: {
                "Content-Type": "application/json",
                ...(config && config.headers),
            },
            ...config,
        });
        return this.responseParse(res);
    }
    responseParse(res) {
        const { responseParser } = this.config;
        if (responseParser)
            return responseParser(res);
        else
            return res.data;
    }
    async put(url, body, config) {
        const res = await this.instance.put(url, body, {
            headers: {
                "Content-Type": "application/json",
                ...(config && config.headers),
            },
            ...config,
        });
        return this.responseParse(res);
    }
    async postForm(url, body) {
        const params = new URLSearchParams();
        for (const key in body) {
            if (body.hasOwnProperty(key)) {
                params.append(key, body[key]);
            }
        }
        const res = await this.instance.post(url, params.toString(), {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
        return res.data;
    }
    async postFormMultipart(url, form) {
        const res = await this.instance.post(url, form);
        return res.data;
    }
    async putFormMultipart(url, form, config) {
        const res = await this.instance.put(url, form, config);
        return res.data;
    }
    async toBuffer(data) {
        if (Buffer.isBuffer(data)) {
            return data;
        }
        else if (data instanceof Readable) {
            return await new Promise((resolve, reject) => {
                const buffers = [];
                let size = 0;
                data.on("data", (chunk) => {
                    buffers.push(chunk);
                    size += chunk.length;
                });
                data.on("end", () => resolve(Buffer.concat(buffers, size)));
                data.on("error", reject);
            });
        }
        else {
            throw new Error("invalid data type for binary data");
        }
    }
    async postBinary(url, data, contentType) {
        const buffer = await this.toBuffer(data);
        const res = await this.instance.post(url, buffer, {
            headers: {
                "Content-Type": contentType || "image/png",
                "Content-Length": buffer.length,
            },
        });
        return res.data;
    }
    async postBinaryContent(url, body) {
        const res = await this.instance.post(url, body, {
            headers: {
                "Content-Type": body.type,
                "Content-Length": body.size,
            },
        });
        return res.data;
    }
    async delete(url, params) {
        const res = await this.instance.delete(url, { params });
        return res.data;
    }
    wrapError(err) {
        if (err.response) {
            const { status, statusText } = err.response;
            const { message } = err;
            return new HTTPError(message, {
                statusCode: status,
                statusMessage: statusText,
                originalError: err,
            });
        }
        else if (err.code) {
            const { message, code } = err;
            return new RequestError(message, { code, originalError: err });
        }
        else if (err.config) {
            // unknown, but from axios
            const { message } = err;
            return new ReadError(message, { originalError: err });
        }
        // otherwise, just rethrow
        return err;
    }
}
//# sourceMappingURL=http-axios.js.map