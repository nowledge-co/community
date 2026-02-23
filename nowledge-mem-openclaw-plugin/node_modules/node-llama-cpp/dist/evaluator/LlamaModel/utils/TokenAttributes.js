// updated against `enum llama_token_attr` from `llama.h`
export var TokenAttribute;
(function (TokenAttribute) {
    TokenAttribute[TokenAttribute["undefined"] = 0] = "undefined";
    TokenAttribute[TokenAttribute["unknown"] = 1] = "unknown";
    TokenAttribute[TokenAttribute["unused"] = 2] = "unused";
    TokenAttribute[TokenAttribute["normal"] = 4] = "normal";
    TokenAttribute[TokenAttribute["control"] = 8] = "control";
    TokenAttribute[TokenAttribute["userDefined"] = 16] = "userDefined";
    TokenAttribute[TokenAttribute["byte"] = 32] = "byte";
    TokenAttribute[TokenAttribute["normalized"] = 64] = "normalized";
    TokenAttribute[TokenAttribute["lstrip"] = 128] = "lstrip";
    TokenAttribute[TokenAttribute["rstrip"] = 256] = "rstrip";
    TokenAttribute[TokenAttribute["singleWord"] = 512] = "singleWord";
})(TokenAttribute || (TokenAttribute = {}));
export class TokenAttributes {
    token;
    /** @internal */ _attributes;
    constructor(token, attributes) {
        this.token = token;
        this._attributes = attributes;
    }
    get undefined() {
        return this._attributes === TokenAttribute.undefined;
    }
    get unknown() {
        return this._hasAttribute(TokenAttribute.unknown);
    }
    get unused() {
        return this._hasAttribute(TokenAttribute.unused);
    }
    get normal() {
        return this._hasAttribute(TokenAttribute.normal);
    }
    get control() {
        return this._hasAttribute(TokenAttribute.control);
    }
    get userDefined() {
        return this._hasAttribute(TokenAttribute.userDefined);
    }
    get byte() {
        return this._hasAttribute(TokenAttribute.byte);
    }
    get normalized() {
        return this._hasAttribute(TokenAttribute.normalized);
    }
    get lstrip() {
        return this._hasAttribute(TokenAttribute.lstrip);
    }
    get rstrip() {
        return this._hasAttribute(TokenAttribute.rstrip);
    }
    get singleWord() {
        return this._hasAttribute(TokenAttribute.singleWord);
    }
    /** @internal */
    _hasAttribute(attribute) {
        return (this._attributes & attribute) === attribute;
    }
    /** @internal */
    static _create(token, attributes) {
        return new TokenAttributes(token, attributes);
    }
}
//# sourceMappingURL=TokenAttributes.js.map