export class GgufInsightsTokens {
    /** @internal */ _ggufInsights;
    constructor(ggufInsights) {
        this._ggufInsights = ggufInsights;
    }
    get sepToken() {
        const tokenizerModel = this._ggufInsights._ggufFileInfo?.metadata?.tokenizer?.ggml?.model;
        const totalTokens = this._ggufInsights._ggufFileInfo?.metadata?.tokenizer?.ggml?.tokens?.length;
        let sepTokenId = this._ggufInsights._ggufFileInfo?.metadata?.tokenizer?.ggml?.["seperator_token_id"];
        if (sepTokenId == null && tokenizerModel === "bert") {
            sepTokenId = 102; // source: `llama_vocab::impl::load` in `llama-vocab.cpp`
        }
        if (totalTokens != null && sepTokenId != null && sepTokenId >= totalTokens)
            return null;
        return sepTokenId ?? null;
    }
    get eosToken() {
        const tokenizerModel = this._ggufInsights._ggufFileInfo?.metadata?.tokenizer?.ggml?.model;
        const totalTokens = this._ggufInsights._ggufFileInfo?.metadata?.tokenizer?.ggml?.tokens?.length;
        const eosTokenId = this._ggufInsights._ggufFileInfo?.metadata?.tokenizer?.ggml?.["eos_token_id"];
        if (eosTokenId != null && totalTokens != null && eosTokenId < totalTokens)
            return eosTokenId;
        switch (tokenizerModel) {
            case "no_vocab": return null;
            case "none": return null;
            case "bert": return null;
            case "rwkv": return null;
            case "llama": return 2;
            case "gpt2": return 11;
            case "t5": return 1;
            case "plamo2": return 2;
        }
        return 2; // source: `llama_vocab::impl::load` in `llama-vocab.cpp`
    }
    /** @internal */
    static _create(ggufInsights) {
        return new GgufInsightsTokens(ggufInsights);
    }
}
//# sourceMappingURL=GgufInsightsTokens.js.map