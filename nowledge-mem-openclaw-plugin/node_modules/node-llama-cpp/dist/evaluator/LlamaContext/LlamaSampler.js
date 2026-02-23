/** @internal */
export class LlamaSampler {
    /** @internal */ _llama;
    /** @internal */ _sampler;
    /** @internal */ disposed = false;
    constructor(model) {
        this._llama = model._llama;
        this._sampler = new this._llama._bindings.AddonSampler(model._model);
        this.asyncDispose = this.asyncDispose.bind(this);
    }
    dispose() {
        this.disposed = true;
        this._sampler.dispose();
    }
    async asyncDispose() {
        this.disposed = true;
        this._sampler.dispose();
    }
    applyConfig(config) {
        return this._sampler.applyConfig(config);
    }
    /** @internal */
    static _canBeNextTokenForGrammarEvaluationState(llama, grammarEvaluationState, token) {
        return llama._bindings.AddonSampler.canBeNextTokenForGrammarEvaluationState(grammarEvaluationState._state, token);
    }
    /** @internal */
    static _acceptTokenOnGrammarEvaluationState(llama, grammarEvaluationState, token) {
        llama._bindings.AddonSampler.acceptGrammarEvaluationStateToken(grammarEvaluationState._state, token);
    }
}
//# sourceMappingURL=LlamaSampler.js.map