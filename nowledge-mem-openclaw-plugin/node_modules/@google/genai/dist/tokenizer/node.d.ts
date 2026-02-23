/** The generic reusable api auth config. Deprecated. Please use AuthConfig (google/cloud/aiplatform/master/auth.proto) instead. This data type is not supported in Gemini API. */
declare interface ApiAuth {
    /** The API secret. */
    apiKeyConfig?: ApiAuthApiKeyConfig;
}

/** The API secret. This data type is not supported in Gemini API. */
declare interface ApiAuthApiKeyConfig {
    /** Required. The SecretManager secret version resource name storing API key. e.g. projects/{project}/secrets/{secret}/versions/{version} */
    apiKeySecretVersion?: string;
    /** The API key string. Either this or `api_key_secret_version` must be set. */
    apiKeyString?: string;
}

/** Config for authentication with API key. This data type is not supported in Gemini API. */
declare interface ApiKeyConfig {
    /** Optional. The name of the SecretManager secret version resource storing the API key. Format: `projects/{project}/secrets/{secrete}/versions/{version}` - If both `api_key_secret` and `api_key_string` are specified, this field takes precedence over `api_key_string`. - If specified, the `secretmanager.versions.access` permission should be granted to Vertex AI Extension Service Agent (https://cloud.google.com/vertex-ai/docs/general/access-control#service-agents) on the specified resource. */
    apiKeySecret?: string;
    /** Optional. The API key to be used in the request directly. */
    apiKeyString?: string;
    /** Optional. The location of the API key. */
    httpElementLocation?: HttpElementLocation;
    /** Optional. The parameter name of the API key. E.g. If the API request is "https://example.com/act?api_key=", "api_key" would be the parameter name. */
    name?: string;
}

/** The API spec that the external API implements. This enum is not supported in Gemini API. */
declare enum ApiSpec {
    /**
     * Unspecified API spec. This value should not be used.
     */
    API_SPEC_UNSPECIFIED = "API_SPEC_UNSPECIFIED",
    /**
     * Simple search API spec.
     */
    SIMPLE_SEARCH = "SIMPLE_SEARCH",
    /**
     * Elastic search API spec.
     */
    ELASTIC_SEARCH = "ELASTIC_SEARCH"
}

/** Auth configuration to run the extension. This data type is not supported in Gemini API. */
declare interface AuthConfig {
    /** Config for API key auth. */
    apiKeyConfig?: ApiKeyConfig;
    /** Type of auth scheme. */
    authType?: AuthType;
    /** Config for Google Service Account auth. */
    googleServiceAccountConfig?: AuthConfigGoogleServiceAccountConfig;
    /** Config for HTTP Basic auth. */
    httpBasicAuthConfig?: AuthConfigHttpBasicAuthConfig;
    /** Config for user oauth. */
    oauthConfig?: AuthConfigOauthConfig;
    /** Config for user OIDC auth. */
    oidcConfig?: AuthConfigOidcConfig;
}

/** Config for Google Service Account Authentication. This data type is not supported in Gemini API. */
declare interface AuthConfigGoogleServiceAccountConfig {
    /** Optional. The service account that the extension execution service runs as. - If the service account is specified, the `iam.serviceAccounts.getAccessToken` permission should be granted to Vertex AI Extension Service Agent (https://cloud.google.com/vertex-ai/docs/general/access-control#service-agents) on the specified service account. - If not specified, the Vertex AI Extension Service Agent will be used to execute the Extension. */
    serviceAccount?: string;
}

/** Config for HTTP Basic Authentication. This data type is not supported in Gemini API. */
declare interface AuthConfigHttpBasicAuthConfig {
    /** Required. The name of the SecretManager secret version resource storing the base64 encoded credentials. Format: `projects/{project}/secrets/{secrete}/versions/{version}` - If specified, the `secretmanager.versions.access` permission should be granted to Vertex AI Extension Service Agent (https://cloud.google.com/vertex-ai/docs/general/access-control#service-agents) on the specified resource. */
    credentialSecret?: string;
}

/** Config for user oauth. This data type is not supported in Gemini API. */
declare interface AuthConfigOauthConfig {
    /** Access token for extension endpoint. Only used to propagate token from [[ExecuteExtensionRequest.runtime_auth_config]] at request time. */
    accessToken?: string;
    /** The service account used to generate access tokens for executing the Extension. - If the service account is specified, the `iam.serviceAccounts.getAccessToken` permission should be granted to Vertex AI Extension Service Agent (https://cloud.google.com/vertex-ai/docs/general/access-control#service-agents) on the provided service account. */
    serviceAccount?: string;
}

/** Config for user OIDC auth. This data type is not supported in Gemini API. */
declare interface AuthConfigOidcConfig {
    /** OpenID Connect formatted ID token for extension endpoint. Only used to propagate token from [[ExecuteExtensionRequest.runtime_auth_config]] at request time. */
    idToken?: string;
    /** The service account used to generate an OpenID Connect (OIDC)-compatible JWT token signed by the Google OIDC Provider (accounts.google.com) for extension endpoint (https://cloud.google.com/iam/docs/create-short-lived-credentials-direct#sa-credentials-oidc). - The audience for the token will be set to the URL in the server url defined in the OpenApi spec. - If the service account is provided, the service account should grant `iam.serviceAccounts.getOpenIdToken` permission to Vertex AI Extension Service Agent (https://cloud.google.com/vertex-ai/docs/general/access-control#service-agents). */
    serviceAccount?: string;
}

/** Type of auth scheme. This enum is not supported in Gemini API. */
declare enum AuthType {
    AUTH_TYPE_UNSPECIFIED = "AUTH_TYPE_UNSPECIFIED",
    /**
     * No Auth.
     */
    NO_AUTH = "NO_AUTH",
    /**
     * API Key Auth.
     */
    API_KEY_AUTH = "API_KEY_AUTH",
    /**
     * HTTP Basic Auth.
     */
    HTTP_BASIC_AUTH = "HTTP_BASIC_AUTH",
    /**
     * Google Service Account Auth.
     */
    GOOGLE_SERVICE_ACCOUNT_AUTH = "GOOGLE_SERVICE_ACCOUNT_AUTH",
    /**
     * OAuth auth.
     */
    OAUTH = "OAUTH",
    /**
     * OpenID Connect (OIDC) Auth.
     */
    OIDC_AUTH = "OIDC_AUTH"
}

/** Specifies the function Behavior. Currently only supported by the BidiGenerateContent method. This enum is not supported in Vertex AI. */
declare enum Behavior {
    /**
     * This value is unused.
     */
    UNSPECIFIED = "UNSPECIFIED",
    /**
     * If set, the system will wait to receive the function response before continuing the conversation.
     */
    BLOCKING = "BLOCKING",
    /**
     * If set, the system will not wait to receive the function response. Instead, it will attempt to handle function responses as they become available while maintaining the conversation between the user and the model.
     */
    NON_BLOCKING = "NON_BLOCKING"
}

/** Content blob. */
declare interface Blob_2 {
    /** Required. Raw bytes.
     * @remarks Encoded as base64 string. */
    data?: string;
    /** Optional. Display name of the blob. Used to provide a label or filename to distinguish blobs. This field is only returned in PromptMessage for prompt management. It is currently used in the Gemini GenerateContent calls only when server side tools (code_execution, google_search, and url_context) are enabled. This field is not supported in Gemini API. */
    displayName?: string;
    /** Required. The IANA standard MIME type of the source data. */
    mimeType?: string;
}

/** Result of executing the [ExecutableCode]. Only generated when using the [CodeExecution] tool, and always follows a `part` containing the [ExecutableCode]. */
declare interface CodeExecutionResult {
    /** Required. Outcome of the code execution. */
    outcome?: Outcome;
    /** Optional. Contains stdout when code execution is successful, stderr or other description otherwise. */
    output?: string;
}

/** Tool to support computer use. */
declare interface ComputerUse {
    /** Required. The environment being operated. */
    environment?: Environment;
    /** By default, predefined functions are included in the final model call.
     Some of them can be explicitly excluded from being automatically included.
     This can serve two purposes:
     1. Using a more restricted / different action space.
     2. Improving the definitions / instructions of predefined functions. */
    excludedPredefinedFunctions?: string[];
}

/** Local tokenizer compute tokens result. */
export declare interface ComputeTokensResult {
    /** Lists of tokens info from the input. */
    tokensInfo?: TokensInfo[];
}

/** Contains the multi-part content of a message. */
declare interface Content {
    /** List of parts that constitute a single message. Each part may have
     a different IANA MIME type. */
    parts?: Part[];
    /** Optional. The producer of the content. Must be either 'user' or 'model'. Useful to set for multi-turn conversations, otherwise can be left blank or unset. */
    role?: string;
}

declare type ContentListUnion = Content | Content[] | PartUnion | PartUnion[];

declare type ContentUnion = Content | PartUnion[] | PartUnion;

/** Config for the count_tokens method. */
declare interface CountTokensConfig {
    /** Used to override HTTP request options. */
    httpOptions?: HttpOptions;
    /** Abort signal which can be used to cancel the request.

     NOTE: AbortSignal is a client-only operation. Using it to cancel an
     operation will not cancel the request in the service. You will still
     be charged usage for any applicable operations.
     */
    abortSignal?: AbortSignal;
    /** Instructions for the model to steer it toward better performance.
     */
    systemInstruction?: ContentUnion;
    /** Code that enables the system to interact with external systems to
     perform an action outside of the knowledge and scope of the model.
     */
    tools?: Tool[];
    /** Configuration that the model uses to generate the response. Not
     supported by the Gemini Developer API.
     */
    generationConfig?: GenerationConfig;
}

/** Local tokenizer count tokens result. */
export declare interface CountTokensResult {
    /** The total number of tokens. */
    totalTokens?: number;
}

/** Describes the options to customize dynamic retrieval. */
declare interface DynamicRetrievalConfig {
    /** Optional. The threshold to be used in dynamic retrieval. If not set, a system default value is used. */
    dynamicThreshold?: number;
    /** The mode of the predictor to be used in dynamic retrieval. */
    mode?: DynamicRetrievalConfigMode;
}

/** The mode of the predictor to be used in dynamic retrieval. */
declare enum DynamicRetrievalConfigMode {
    /**
     * Always trigger retrieval.
     */
    MODE_UNSPECIFIED = "MODE_UNSPECIFIED",
    /**
     * Run retrieval only when system decides it is necessary.
     */
    MODE_DYNAMIC = "MODE_DYNAMIC"
}

/** Tool to search public web data, powered by Vertex AI Search and Sec4 compliance. This data type is not supported in Gemini API. */
declare interface EnterpriseWebSearch {
    /** Optional. List of domains to be excluded from the search results. The default limit is 2000 domains. */
    excludeDomains?: string[];
    /** Optional. Sites with confidence level chosen & above this value will be blocked from the search results. */
    blockingConfidence?: PhishBlockThreshold;
}

/** The environment being operated. */
declare enum Environment {
    /**
     * Defaults to browser.
     */
    ENVIRONMENT_UNSPECIFIED = "ENVIRONMENT_UNSPECIFIED",
    /**
     * Operates in a web browser.
     */
    ENVIRONMENT_BROWSER = "ENVIRONMENT_BROWSER"
}

/** Code generated by the model that is meant to be executed, and the result returned to the model. Generated when using the [CodeExecution] tool, in which the code will be automatically executed, and a corresponding [CodeExecutionResult] will also be generated. */
declare interface ExecutableCode {
    /** Required. The code to be executed. */
    code?: string;
    /** Required. Programming language of the `code`. */
    language?: Language;
}

/** Retrieve from data source powered by external API for grounding. The external API is not owned by Google, but need to follow the pre-defined API spec. This data type is not supported in Gemini API. */
declare interface ExternalApi {
    /** The authentication config to access the API. Deprecated. Please use auth_config instead. */
    apiAuth?: ApiAuth;
    /** The API spec that the external API implements. */
    apiSpec?: ApiSpec;
    /** The authentication config to access the API. */
    authConfig?: AuthConfig;
    /** Parameters for the elastic search API. */
    elasticSearchParams?: ExternalApiElasticSearchParams;
    /** The endpoint of the external API. The system will call the API at this endpoint to retrieve the data for grounding. Example: https://acme.com:443/search */
    endpoint?: string;
    /** Parameters for the simple search API. */
    simpleSearchParams?: ExternalApiSimpleSearchParams;
}

/** The search parameters to use for the ELASTIC_SEARCH spec. This data type is not supported in Gemini API. */
declare interface ExternalApiElasticSearchParams {
    /** The ElasticSearch index to use. */
    index?: string;
    /** Optional. Number of hits (chunks) to request. When specified, it is passed to Elasticsearch as the `num_hits` param. */
    numHits?: number;
    /** The ElasticSearch search template to use. */
    searchTemplate?: string;
}

/** The search parameters to use for SIMPLE_SEARCH spec. This data type is not supported in Gemini API. */
declare interface ExternalApiSimpleSearchParams {
}

/** Options for feature selection preference. */
declare enum FeatureSelectionPreference {
    FEATURE_SELECTION_PREFERENCE_UNSPECIFIED = "FEATURE_SELECTION_PREFERENCE_UNSPECIFIED",
    PRIORITIZE_QUALITY = "PRIORITIZE_QUALITY",
    BALANCED = "BALANCED",
    PRIORITIZE_COST = "PRIORITIZE_COST"
}

/** URI based data. */
declare interface FileData {
    /** Optional. Display name of the file data. Used to provide a label or filename to distinguish file datas. This field is only returned in PromptMessage for prompt management. It is currently used in the Gemini GenerateContent calls only when server side tools (code_execution, google_search, and url_context) are enabled. This field is not supported in Gemini API. */
    displayName?: string;
    /** Required. URI. */
    fileUri?: string;
    /** Required. The IANA standard MIME type of the source data. */
    mimeType?: string;
}

/** Tool to retrieve knowledge from the File Search Stores. */
declare interface FileSearch {
    /** The names of the file_search_stores to retrieve from.
     Example: `fileSearchStores/my-file-search-store-123` */
    fileSearchStoreNames?: string[];
    /** The number of file search retrieval chunks to retrieve. */
    topK?: number;
    /** Metadata filter to apply to the file search retrieval documents. See https://google.aip.dev/160 for the syntax of the filter expression. */
    metadataFilter?: string;
}

/** A function call. */
declare interface FunctionCall {
    /** The unique id of the function call. If populated, the client to execute the
     `function_call` and return the response with the matching `id`. */
    id?: string;
    /** Optional. The function parameters and values in JSON object format. See [FunctionDeclaration.parameters] for parameter details. */
    args?: Record<string, unknown>;
    /** Optional. The name of the function to call. Matches [FunctionDeclaration.name]. */
    name?: string;
    /** Optional. The partial argument value of the function call. If provided, represents the arguments/fields that are streamed incrementally. This field is not supported in Gemini API. */
    partialArgs?: PartialArg[];
    /** Optional. Whether this is the last part of the FunctionCall. If true, another partial message for the current FunctionCall is expected to follow. This field is not supported in Gemini API. */
    willContinue?: boolean;
}

/** Structured representation of a function declaration as defined by the [OpenAPI 3.0 specification](https://spec.openapis.org/oas/v3.0.3). Included in this declaration are the function name, description, parameters and response type. This FunctionDeclaration is a representation of a block of code that can be used as a `Tool` by the model and executed by the client. */
declare interface FunctionDeclaration {
    /** Optional. Description and purpose of the function. Model uses it to decide how and whether to call the function. */
    description?: string;
    /** Required. The name of the function to call. Must start with a letter or an underscore. Must be a-z, A-Z, 0-9, or contain underscores, dots and dashes, with a maximum length of 64. */
    name?: string;
    /** Optional. Describes the parameters to this function in JSON Schema Object format. Reflects the Open API 3.03 Parameter Object. string Key: the name of the parameter. Parameter names are case sensitive. Schema Value: the Schema defining the type used for the parameter. For function with no parameters, this can be left unset. Parameter names must start with a letter or an underscore and must only contain chars a-z, A-Z, 0-9, or underscores with a maximum length of 64. Example with 1 required and 1 optional parameter: type: OBJECT properties: param1: type: STRING param2: type: INTEGER required: - param1 */
    parameters?: Schema;
    /** Optional. Describes the parameters to the function in JSON Schema format. The schema must describe an object where the properties are the parameters to the function. For example: ``` { "type": "object", "properties": { "name": { "type": "string" }, "age": { "type": "integer" } }, "additionalProperties": false, "required": ["name", "age"], "propertyOrdering": ["name", "age"] } ``` This field is mutually exclusive with `parameters`. */
    parametersJsonSchema?: unknown;
    /** Optional. Describes the output from this function in JSON Schema format. Reflects the Open API 3.03 Response Object. The Schema defines the type used for the response value of the function. */
    response?: Schema;
    /** Optional. Describes the output from this function in JSON Schema format. The value specified by the schema is the response value of the function. This field is mutually exclusive with `response`. */
    responseJsonSchema?: unknown;
    /** Optional. Specifies the function Behavior. Currently only supported by the BidiGenerateContent method. This field is not supported in Vertex AI. */
    behavior?: Behavior;
}

/** A function response. */
declare class FunctionResponse {
    /** Signals that function call continues, and more responses will be returned, turning the function call into a generator. Is only applicable to NON_BLOCKING function calls (see FunctionDeclaration.behavior for details), ignored otherwise. If false, the default, future responses will not be considered. Is only applicable to NON_BLOCKING function calls, is ignored otherwise. If set to false, future responses will not be considered. It is allowed to return empty `response` with `will_continue=False` to signal that the function call is finished. */
    willContinue?: boolean;
    /** Specifies how the response should be scheduled in the conversation. Only applicable to NON_BLOCKING function calls, is ignored otherwise. Defaults to WHEN_IDLE. */
    scheduling?: FunctionResponseScheduling;
    /** List of parts that constitute a function response. Each part may
     have a different IANA MIME type. */
    parts?: FunctionResponsePart[];
    /** Optional. The id of the function call this response is for. Populated by the client to match the corresponding function call `id`. */
    id?: string;
    /** Required. The name of the function to call. Matches [FunctionDeclaration.name] and [FunctionCall.name]. */
    name?: string;
    /** Required. The function response in JSON object format. Use "output" key to specify function output and "error" key to specify error details (if any). If "output" and "error" keys are not specified, then whole "response" is treated as function output. */
    response?: Record<string, unknown>;
}

/** Raw media bytes for function response.

 Text should not be sent as raw bytes, use the FunctionResponse.response
 field. */
declare class FunctionResponseBlob {
    /** Required. The IANA standard MIME type of the source data. */
    mimeType?: string;
    /** Required. Inline media bytes.
     * @remarks Encoded as base64 string. */
    data?: string;
    /** Optional. Display name of the blob.
     Used to provide a label or filename to distinguish blobs. */
    displayName?: string;
}

/** URI based data for function response. */
declare class FunctionResponseFileData {
    /** Required. URI. */
    fileUri?: string;
    /** Required. The IANA standard MIME type of the source data. */
    mimeType?: string;
    /** Optional. Display name of the file.
     Used to provide a label or filename to distinguish files. */
    displayName?: string;
}

/** A datatype containing media that is part of a `FunctionResponse` message.

 A `FunctionResponsePart` consists of data which has an associated datatype. A
 `FunctionResponsePart` can only contain one of the accepted types in
 `FunctionResponsePart.data`.

 A `FunctionResponsePart` must have a fixed IANA MIME type identifying the
 type and subtype of the media if the `inline_data` field is filled with raw
 bytes. */
declare class FunctionResponsePart {
    /** Optional. Inline media bytes. */
    inlineData?: FunctionResponseBlob;
    /** Optional. URI based data. */
    fileData?: FunctionResponseFileData;
}

/** Specifies how the response should be scheduled in the conversation. */
declare enum FunctionResponseScheduling {
    /**
     * This value is unused.
     */
    SCHEDULING_UNSPECIFIED = "SCHEDULING_UNSPECIFIED",
    /**
     * Only add the result to the conversation context, do not interrupt or trigger generation.
     */
    SILENT = "SILENT",
    /**
     * Add the result to the conversation context, and prompt to generate output without interrupting ongoing generation.
     */
    WHEN_IDLE = "WHEN_IDLE",
    /**
     * Add the result to the conversation context, interrupt ongoing generation and prompt to generate output.
     */
    INTERRUPT = "INTERRUPT"
}

/** Generation config. */
declare interface GenerationConfig {
    /** Optional. Config for model selection. */
    modelSelectionConfig?: ModelSelectionConfig;
    /** Output schema of the generated response. This is an alternative to
     `response_schema` that accepts [JSON Schema](https://json-schema.org/).
     */
    responseJsonSchema?: unknown;
    /** Optional. If enabled, audio timestamp will be included in the request to the model. This field is not supported in Gemini API. */
    audioTimestamp?: boolean;
    /** Optional. Number of candidates to generate. */
    candidateCount?: number;
    /** Optional. If enabled, the model will detect emotions and adapt its responses accordingly. This field is not supported in Gemini API. */
    enableAffectiveDialog?: boolean;
    /** Optional. Frequency penalties. */
    frequencyPenalty?: number;
    /** Optional. Logit probabilities. */
    logprobs?: number;
    /** Optional. The maximum number of output tokens to generate per message. */
    maxOutputTokens?: number;
    /** Optional. If specified, the media resolution specified will be used. */
    mediaResolution?: MediaResolution;
    /** Optional. Positive penalties. */
    presencePenalty?: number;
    /** Optional. If true, export the logprobs results in response. */
    responseLogprobs?: boolean;
    /** Optional. Output response mimetype of the generated candidate text. Supported mimetype: - `text/plain`: (default) Text output. - `application/json`: JSON response in the candidates. The model needs to be prompted to output the appropriate response type, otherwise the behavior is undefined. This is a preview feature. */
    responseMimeType?: string;
    /** Optional. The modalities of the response. */
    responseModalities?: Modality[];
    /** Optional. The `Schema` object allows the definition of input and output data types. These types can be objects, but also primitives and arrays. Represents a select subset of an [OpenAPI 3.0 schema object](https://spec.openapis.org/oas/v3.0.3#schema). If set, a compatible response_mime_type must also be set. Compatible mimetypes: `application/json`: Schema for JSON response. */
    responseSchema?: Schema;
    /** Optional. Routing configuration. This field is not supported in Gemini API. */
    routingConfig?: GenerationConfigRoutingConfig;
    /** Optional. Seed. */
    seed?: number;
    /** Optional. The speech generation config. */
    speechConfig?: SpeechConfig;
    /** Optional. Stop sequences. */
    stopSequences?: string[];
    /** Optional. Controls the randomness of predictions. */
    temperature?: number;
    /** Optional. Config for thinking features. An error will be returned if this field is set for models that don't support thinking. */
    thinkingConfig?: ThinkingConfig;
    /** Optional. If specified, top-k sampling will be used. */
    topK?: number;
    /** Optional. If specified, nucleus sampling will be used. */
    topP?: number;
    /** Optional. Enables enhanced civic answers. It may not be available for all models. This field is not supported in Vertex AI. */
    enableEnhancedCivicAnswers?: boolean;
}

/** The configuration for routing the request to a specific model. This data type is not supported in Gemini API. */
declare interface GenerationConfigRoutingConfig {
    /** Automated routing. */
    autoMode?: GenerationConfigRoutingConfigAutoRoutingMode;
    /** Manual routing. */
    manualMode?: GenerationConfigRoutingConfigManualRoutingMode;
}

/** When automated routing is specified, the routing will be determined by the pretrained routing model and customer provided model routing preference. This data type is not supported in Gemini API. */
declare interface GenerationConfigRoutingConfigAutoRoutingMode {
    /** The model routing preference. */
    modelRoutingPreference?: 'UNKNOWN' | 'PRIORITIZE_QUALITY' | 'BALANCED' | 'PRIORITIZE_COST';
}

/** When manual routing is set, the specified model will be used directly. This data type is not supported in Gemini API. */
declare interface GenerationConfigRoutingConfigManualRoutingMode {
    /** The model name to use. Only the public LLM models are accepted. See [Supported models](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/inference#supported-models). */
    modelName?: string;
}

/** Tool to retrieve public maps data for grounding, powered by Google. */
declare interface GoogleMaps {
    /** The authentication config to access the API. Only API key is supported. This field is not supported in Gemini API. */
    authConfig?: AuthConfig;
    /** Optional. If true, include the widget context token in the response. */
    enableWidget?: boolean;
}

/** GoogleSearch tool type. Tool to support Google Search in Model. Powered by Google. */
declare interface GoogleSearch {
    /** Optional. List of domains to be excluded from the search results. The default limit is 2000 domains. Example: ["amazon.com", "facebook.com"]. This field is not supported in Gemini API. */
    excludeDomains?: string[];
    /** Optional. Sites with confidence level chosen & above this value will be blocked from the search results. This field is not supported in Gemini API. */
    blockingConfidence?: PhishBlockThreshold;
    /** Optional. Filter search results to a specific time range. If customers set a start time, they must set an end time (and vice versa). This field is not supported in Vertex AI. */
    timeRangeFilter?: Interval;
}

/** Tool to retrieve public web data for grounding, powered by Google. */
declare interface GoogleSearchRetrieval {
    /** Specifies the dynamic retrieval configuration for the given source. */
    dynamicRetrievalConfig?: DynamicRetrievalConfig;
}

/** The location of the API key. This enum is not supported in Gemini API. */
declare enum HttpElementLocation {
    HTTP_IN_UNSPECIFIED = "HTTP_IN_UNSPECIFIED",
    /**
     * Element is in the HTTP request query.
     */
    HTTP_IN_QUERY = "HTTP_IN_QUERY",
    /**
     * Element is in the HTTP request header.
     */
    HTTP_IN_HEADER = "HTTP_IN_HEADER",
    /**
     * Element is in the HTTP request path.
     */
    HTTP_IN_PATH = "HTTP_IN_PATH",
    /**
     * Element is in the HTTP request body.
     */
    HTTP_IN_BODY = "HTTP_IN_BODY",
    /**
     * Element is in the HTTP request cookie.
     */
    HTTP_IN_COOKIE = "HTTP_IN_COOKIE"
}

/** HTTP options to be used in each of the requests. */
declare interface HttpOptions {
    /** The base URL for the AI platform service endpoint. */
    baseUrl?: string;
    /** The resource scope used to constructing the resource name when base_url is set */
    baseUrlResourceScope?: ResourceScope;
    /** Specifies the version of the API to use. */
    apiVersion?: string;
    /** Additional HTTP headers to be sent with the request. */
    headers?: Record<string, string>;
    /** Timeout for the request in milliseconds. */
    timeout?: number;
    /** Extra parameters to add to the request body.
     The structure must match the backend API's request structure.
     - VertexAI backend API docs: https://cloud.google.com/vertex-ai/docs/reference/rest
     - GeminiAPI backend API docs: https://ai.google.dev/api/rest */
    extraBody?: Record<string, unknown>;
    /** HTTP retry options for the request. */
    retryOptions?: HttpRetryOptions;
}

/** HTTP retry options to be used in each of the requests. */
declare interface HttpRetryOptions {
    /** Maximum number of attempts, including the original request.
     If 0 or 1, it means no retries. If not specified, default to 5. */
    attempts?: number;
}

/** Represents a time interval, encoded as a Timestamp start (inclusive) and a Timestamp end (exclusive). The start must be less than or equal to the end. When the start equals the end, the interval is empty (matches no time). When both start and end are unspecified, the interval matches any time. */
declare interface Interval {
    /** Optional. Exclusive end of the interval. If specified, a Timestamp matching this interval will have to be before the end. */
    endTime?: string;
    /** Optional. Inclusive start of the interval. If specified, a Timestamp matching this interval will have to be the same or after the start. */
    startTime?: string;
}

/** Programming language of the `code`. */
declare enum Language {
    /**
     * Unspecified language. This value should not be used.
     */
    LANGUAGE_UNSPECIFIED = "LANGUAGE_UNSPECIFIED",
    /**
     * Python >= 3.10, with numpy and simpy available.
     */
    PYTHON = "PYTHON"
}

/**
 * LocalTokenizer for Node.js environment.
 *
 * Provides local tokenization for Gemini models without requiring API calls.
 * Automatically uses Node.js platform (filesystem caching in temp directory).
 *
 * @example
 * ```typescript
 * import {LocalTokenizer} from '@google/genai/node';
 *
 * const tokenizer = new LocalTokenizer('gemini-2.0-flash-001');
 * const result = await tokenizer.countTokens("What is your name?");
 * console.log(result.totalTokens); // 5
 * ```
 *
 * @experimental This API is experimental and may change in future versions.
 */
export declare class LocalTokenizer {
    private baseTokenizer;
    /**
     * Creates a new LocalTokenizer for Node.js.
     *
     * @param modelName Gemini model name (e.g., 'gemini-2.0-flash-001')
     */
    constructor(modelName: string);
    /**
     * Counts the number of tokens in the given content.
     *
     * @param contents The contents to tokenize
     * @param config Optional configuration for counting tokens
     * @return A CountTokensResult containing the total number of tokens
     */
    countTokens(contents: ContentListUnion, config?: CountTokensConfig): Promise<CountTokensResult>;
    /**
     * Computes detailed token information for the given content.
     *
     * @param contents The contents to tokenize
     * @return A ComputeTokensResult containing token IDs, bytes, and roles
     */
    computeTokens(contents: ContentListUnion): Promise<ComputeTokensResult>;
}

/** The media resolution to use. */
declare enum MediaResolution {
    /**
     * Media resolution has not been set
     */
    MEDIA_RESOLUTION_UNSPECIFIED = "MEDIA_RESOLUTION_UNSPECIFIED",
    /**
     * Media resolution set to low (64 tokens).
     */
    MEDIA_RESOLUTION_LOW = "MEDIA_RESOLUTION_LOW",
    /**
     * Media resolution set to medium (256 tokens).
     */
    MEDIA_RESOLUTION_MEDIUM = "MEDIA_RESOLUTION_MEDIUM",
    /**
     * Media resolution set to high (zoomed reframing with 256 tokens).
     */
    MEDIA_RESOLUTION_HIGH = "MEDIA_RESOLUTION_HIGH"
}

/** Server content modalities. */
declare enum Modality {
    /**
     * The modality is unspecified.
     */
    MODALITY_UNSPECIFIED = "MODALITY_UNSPECIFIED",
    /**
     * Indicates the model should return text
     */
    TEXT = "TEXT",
    /**
     * Indicates the model should return images.
     */
    IMAGE = "IMAGE",
    /**
     * Indicates the model should return audio.
     */
    AUDIO = "AUDIO"
}

/** Config for model selection. */
declare interface ModelSelectionConfig {
    /** Options for feature selection preference. */
    featureSelectionPreference?: FeatureSelectionPreference;
}

/** Configuration for a multi-speaker text-to-speech request. */
declare interface MultiSpeakerVoiceConfig {
    /** Required. A list of configurations for the voices of the speakers. Exactly two speaker voice configurations must be provided. */
    speakerVoiceConfigs?: SpeakerVoiceConfig[];
}

/** Outcome of the code execution. */
declare enum Outcome {
    /**
     * Unspecified status. This value should not be used.
     */
    OUTCOME_UNSPECIFIED = "OUTCOME_UNSPECIFIED",
    /**
     * Code execution completed successfully.
     */
    OUTCOME_OK = "OUTCOME_OK",
    /**
     * Code execution finished but with a failure. `stderr` should contain the reason.
     */
    OUTCOME_FAILED = "OUTCOME_FAILED",
    /**
     * Code execution ran for too long, and was cancelled. There may or may not be a partial output present.
     */
    OUTCOME_DEADLINE_EXCEEDED = "OUTCOME_DEADLINE_EXCEEDED"
}

/** A datatype containing media content.

 Exactly one field within a Part should be set, representing the specific type
 of content being conveyed. Using multiple fields within the same `Part`
 instance is considered invalid. */
declare interface Part {
    /** Media resolution for the input media.
     */
    mediaResolution?: PartMediaResolution;
    /** Optional. Result of executing the [ExecutableCode]. */
    codeExecutionResult?: CodeExecutionResult;
    /** Optional. Code generated by the model that is meant to be executed. */
    executableCode?: ExecutableCode;
    /** Optional. URI based data. */
    fileData?: FileData;
    /** Optional. A predicted [FunctionCall] returned from the model that contains a string representing the [FunctionDeclaration.name] with the parameters and their values. */
    functionCall?: FunctionCall;
    /** Optional. The result output of a [FunctionCall] that contains a string representing the [FunctionDeclaration.name] and a structured JSON object containing any output from the function call. It is used as context to the model. */
    functionResponse?: FunctionResponse;
    /** Optional. Inlined bytes data. */
    inlineData?: Blob_2;
    /** Optional. Text part (can be code). */
    text?: string;
    /** Optional. Indicates if the part is thought from the model. */
    thought?: boolean;
    /** Optional. An opaque signature for the thought so it can be reused in subsequent requests.
     * @remarks Encoded as base64 string. */
    thoughtSignature?: string;
    /** Optional. Video metadata. The metadata should only be specified while the video data is presented in inline_data or file_data. */
    videoMetadata?: VideoMetadata;
}

/** Partial argument value of the function call. This data type is not supported in Gemini API. */
declare interface PartialArg {
    /** Optional. Represents a null value. */
    nullValue?: 'NULL_VALUE';
    /** Optional. Represents a double value. */
    numberValue?: number;
    /** Optional. Represents a string value. */
    stringValue?: string;
    /** Optional. Represents a boolean value. */
    boolValue?: boolean;
    /** Required. A JSON Path (RFC 9535) to the argument being streamed. https://datatracker.ietf.org/doc/html/rfc9535. e.g. "$.foo.bar[0].data". */
    jsonPath?: string;
    /** Optional. Whether this is not the last part of the same json_path. If true, another PartialArg message for the current json_path is expected to follow. */
    willContinue?: boolean;
}

/** Media resolution for the input media. */
declare interface PartMediaResolution {
    /** The tokenization quality used for given media.
     */
    level?: PartMediaResolutionLevel;
    /** Specifies the required sequence length for media tokenization.
     */
    numTokens?: number;
}

/** The tokenization quality used for given media. */
declare enum PartMediaResolutionLevel {
    /**
     * Media resolution has not been set.
     */
    MEDIA_RESOLUTION_UNSPECIFIED = "MEDIA_RESOLUTION_UNSPECIFIED",
    /**
     * Media resolution set to low.
     */
    MEDIA_RESOLUTION_LOW = "MEDIA_RESOLUTION_LOW",
    /**
     * Media resolution set to medium.
     */
    MEDIA_RESOLUTION_MEDIUM = "MEDIA_RESOLUTION_MEDIUM",
    /**
     * Media resolution set to high.
     */
    MEDIA_RESOLUTION_HIGH = "MEDIA_RESOLUTION_HIGH",
    /**
     * Media resolution set to ultra high.
     */
    MEDIA_RESOLUTION_ULTRA_HIGH = "MEDIA_RESOLUTION_ULTRA_HIGH"
}

declare type PartUnion = Part | string;

/** Sites with confidence level chosen & above this value will be blocked from the search results. This enum is not supported in Gemini API. */
declare enum PhishBlockThreshold {
    /**
     * Defaults to unspecified.
     */
    PHISH_BLOCK_THRESHOLD_UNSPECIFIED = "PHISH_BLOCK_THRESHOLD_UNSPECIFIED",
    /**
     * Blocks Low and above confidence URL that is risky.
     */
    BLOCK_LOW_AND_ABOVE = "BLOCK_LOW_AND_ABOVE",
    /**
     * Blocks Medium and above confidence URL that is risky.
     */
    BLOCK_MEDIUM_AND_ABOVE = "BLOCK_MEDIUM_AND_ABOVE",
    /**
     * Blocks High and above confidence URL that is risky.
     */
    BLOCK_HIGH_AND_ABOVE = "BLOCK_HIGH_AND_ABOVE",
    /**
     * Blocks Higher and above confidence URL that is risky.
     */
    BLOCK_HIGHER_AND_ABOVE = "BLOCK_HIGHER_AND_ABOVE",
    /**
     * Blocks Very high and above confidence URL that is risky.
     */
    BLOCK_VERY_HIGH_AND_ABOVE = "BLOCK_VERY_HIGH_AND_ABOVE",
    /**
     * Blocks Extremely high confidence URL that is risky.
     */
    BLOCK_ONLY_EXTREMELY_HIGH = "BLOCK_ONLY_EXTREMELY_HIGH"
}

/** The configuration for the prebuilt speaker to use. */
declare interface PrebuiltVoiceConfig {
    /** The name of the preset voice to use. */
    voiceName?: string;
}

/** Specifies the context retrieval config. This data type is not supported in Gemini API. */
declare interface RagRetrievalConfig {
    /** Optional. Config for filters. */
    filter?: RagRetrievalConfigFilter;
    /** Optional. Config for Hybrid Search. */
    hybridSearch?: RagRetrievalConfigHybridSearch;
    /** Optional. Config for ranking and reranking. */
    ranking?: RagRetrievalConfigRanking;
    /** Optional. The number of contexts to retrieve. */
    topK?: number;
}

/** Config for filters. This data type is not supported in Gemini API. */
declare interface RagRetrievalConfigFilter {
    /** Optional. String for metadata filtering. */
    metadataFilter?: string;
    /** Optional. Only returns contexts with vector distance smaller than the threshold. */
    vectorDistanceThreshold?: number;
    /** Optional. Only returns contexts with vector similarity larger than the threshold. */
    vectorSimilarityThreshold?: number;
}

/** Config for Hybrid Search. This data type is not supported in Gemini API. */
declare interface RagRetrievalConfigHybridSearch {
    /** Optional. Alpha value controls the weight between dense and sparse vector search results. The range is [0, 1], while 0 means sparse vector search only and 1 means dense vector search only. The default value is 0.5 which balances sparse and dense vector search equally. */
    alpha?: number;
}

/** Config for ranking and reranking. This data type is not supported in Gemini API. */
declare interface RagRetrievalConfigRanking {
    /** Optional. Config for LlmRanker. */
    llmRanker?: RagRetrievalConfigRankingLlmRanker;
    /** Optional. Config for Rank Service. */
    rankService?: RagRetrievalConfigRankingRankService;
}

/** Config for LlmRanker. This data type is not supported in Gemini API. */
declare interface RagRetrievalConfigRankingLlmRanker {
    /** Optional. The model name used for ranking. See [Supported models](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/inference#supported-models). */
    modelName?: string;
}

/** Config for Rank Service. This data type is not supported in Gemini API. */
declare interface RagRetrievalConfigRankingRankService {
    /** Optional. The model name of the rank service. Format: `semantic-ranker-512@latest` */
    modelName?: string;
}

/** ReplicatedVoiceConfig is used to configure replicated voice. */
declare interface ReplicatedVoiceConfig {
    /** The mime type of the replicated voice.
     */
    mimeType?: string;
    /** The sample audio of the replicated voice.

     * @remarks Encoded as base64 string. */
    voiceSampleAudio?: string;
}

/** Resource scope. */
declare enum ResourceScope {
    /**
     * When setting base_url, this value configures resource scope to be the collection.
     The resource name will not include api version, project, or location.
     For example, if base_url is set to "https://aiplatform.googleapis.com",
     then the resource name for a Model would be
     "https://aiplatform.googleapis.com/publishers/google/models/gemini-3-pro-preview
     */
    COLLECTION = "COLLECTION"
}

/** Defines a retrieval tool that model can call to access external knowledge. This data type is not supported in Gemini API. */
declare interface Retrieval {
    /** Optional. Deprecated. This option is no longer supported. */
    disableAttribution?: boolean;
    /** Use data source powered by external API for grounding. */
    externalApi?: ExternalApi;
    /** Set to use data source powered by Vertex AI Search. */
    vertexAiSearch?: VertexAISearch;
    /** Set to use data source powered by Vertex RAG store. User data is uploaded via the VertexRagDataService. */
    vertexRagStore?: VertexRagStore;
}

/** Schema is used to define the format of input/output data.

 Represents a select subset of an [OpenAPI 3.0 schema
 object](https://spec.openapis.org/oas/v3.0.3#schema-object). More fields may
 be added in the future as needed. */
declare interface Schema {
    /** Optional. The value should be validated against any (one or more) of the subschemas in the list. */
    anyOf?: Schema[];
    /** Optional. Default value of the data. */
    default?: unknown;
    /** Optional. The description of the data. */
    description?: string;
    /** Optional. Possible values of the element of primitive type with enum format. Examples: 1. We can define direction as : {type:STRING, format:enum, enum:["EAST", NORTH", "SOUTH", "WEST"]} 2. We can define apartment number as : {type:INTEGER, format:enum, enum:["101", "201", "301"]} */
    enum?: string[];
    /** Optional. Example of the object. Will only populated when the object is the root. */
    example?: unknown;
    /** Optional. The format of the data. Supported formats: for NUMBER type: "float", "double" for INTEGER type: "int32", "int64" for STRING type: "email", "byte", etc */
    format?: string;
    /** Optional. SCHEMA FIELDS FOR TYPE ARRAY Schema of the elements of Type.ARRAY. */
    items?: Schema;
    /** Optional. Maximum number of the elements for Type.ARRAY. */
    maxItems?: string;
    /** Optional. Maximum length of the Type.STRING */
    maxLength?: string;
    /** Optional. Maximum number of the properties for Type.OBJECT. */
    maxProperties?: string;
    /** Optional. Maximum value of the Type.INTEGER and Type.NUMBER */
    maximum?: number;
    /** Optional. Minimum number of the elements for Type.ARRAY. */
    minItems?: string;
    /** Optional. SCHEMA FIELDS FOR TYPE STRING Minimum length of the Type.STRING */
    minLength?: string;
    /** Optional. Minimum number of the properties for Type.OBJECT. */
    minProperties?: string;
    /** Optional. SCHEMA FIELDS FOR TYPE INTEGER and NUMBER Minimum value of the Type.INTEGER and Type.NUMBER */
    minimum?: number;
    /** Optional. Indicates if the value may be null. */
    nullable?: boolean;
    /** Optional. Pattern of the Type.STRING to restrict a string to a regular expression. */
    pattern?: string;
    /** Optional. SCHEMA FIELDS FOR TYPE OBJECT Properties of Type.OBJECT. */
    properties?: Record<string, Schema>;
    /** Optional. The order of the properties. Not a standard field in open api spec. Only used to support the order of the properties. */
    propertyOrdering?: string[];
    /** Optional. Required properties of Type.OBJECT. */
    required?: string[];
    /** Optional. The title of the Schema. */
    title?: string;
    /** Optional. The type of the data. */
    type?: Type;
}

/** Configuration for a single speaker in a multi speaker setup. */
declare interface SpeakerVoiceConfig {
    /** Required. The name of the speaker. This should be the same as the speaker name used in the prompt. */
    speaker?: string;
    /** Required. The configuration for the voice of this speaker. */
    voiceConfig?: VoiceConfig;
}

declare interface SpeechConfig {
    /** Configuration for the voice of the response. */
    voiceConfig?: VoiceConfig;
    /** Optional. Language code (ISO 639. e.g. en-US) for the speech synthesization. */
    languageCode?: string;
    /** The configuration for a multi-speaker text-to-speech request. This field is mutually exclusive with `voice_config`. */
    multiSpeakerVoiceConfig?: MultiSpeakerVoiceConfig;
}

/** The thinking features configuration. */
declare interface ThinkingConfig {
    /** Indicates whether to include thoughts in the response. If true, thoughts are returned only if the model supports thought and thoughts are available.
     */
    includeThoughts?: boolean;
    /** Indicates the thinking budget in tokens. 0 is DISABLED. -1 is AUTOMATIC. The default values and allowed ranges are model dependent.
     */
    thinkingBudget?: number;
    /** Optional. The number of thoughts tokens that the model should generate. */
    thinkingLevel?: ThinkingLevel;
}

/** The number of thoughts tokens that the model should generate. */
declare enum ThinkingLevel {
    /**
     * Unspecified thinking level.
     */
    THINKING_LEVEL_UNSPECIFIED = "THINKING_LEVEL_UNSPECIFIED",
    /**
     * Low thinking level.
     */
    LOW = "LOW",
    /**
     * Medium thinking level.
     */
    MEDIUM = "MEDIUM",
    /**
     * High thinking level.
     */
    HIGH = "HIGH",
    /**
     * MINIMAL thinking level.
     */
    MINIMAL = "MINIMAL"
}

/** Tokens info with a list of tokens and the corresponding list of token ids. */
export declare interface TokensInfo {
    /** Optional fields for the role from the corresponding Content. */
    role?: string;
    /** A list of token ids from the input. */
    tokenIds?: string[];
    /** A list of tokens from the input.
     * @remarks Encoded as base64 string. */
    tokens?: string[];
}

/** Tool details of a tool that the model may use to generate a response. */
declare interface Tool {
    /** Optional. Retrieval tool type. System will always execute the provided retrieval tool(s) to get external knowledge to answer the prompt. Retrieval results are presented to the model for generation. This field is not supported in Gemini API. */
    retrieval?: Retrieval;
    /** Optional. Tool to support the model interacting directly with the
     computer. If enabled, it automatically populates computer-use specific
     Function Declarations. */
    computerUse?: ComputerUse;
    /** Optional. Tool to retrieve knowledge from the File Search Stores. */
    fileSearch?: FileSearch;
    /** Optional. CodeExecution tool type. Enables the model to execute code as part of generation. */
    codeExecution?: ToolCodeExecution;
    /** Optional. Tool to support searching public web data, powered by Vertex AI Search and Sec4 compliance. This field is not supported in Gemini API. */
    enterpriseWebSearch?: EnterpriseWebSearch;
    /** Optional. Function tool type. One or more function declarations to be passed to the model along with the current user query. Model may decide to call a subset of these functions by populating FunctionCall in the response. User should provide a FunctionResponse for each function call in the next turn. Based on the function responses, Model will generate the final response back to the user. Maximum 512 function declarations can be provided. */
    functionDeclarations?: FunctionDeclaration[];
    /** Optional. GoogleMaps tool type. Tool to support Google Maps in Model. */
    googleMaps?: GoogleMaps;
    /** Optional. GoogleSearch tool type. Tool to support Google Search in Model. Powered by Google. */
    googleSearch?: GoogleSearch;
    /** Optional. Specialized retrieval tool that is powered by Google Search. */
    googleSearchRetrieval?: GoogleSearchRetrieval;
    /** Optional. Tool to support URL context retrieval. */
    urlContext?: UrlContext;
}

/** Tool that executes code generated by the model, and automatically returns the result to the model. See also [ExecutableCode]and [CodeExecutionResult] which are input and output to this tool. This data type is not supported in Gemini API. */
declare interface ToolCodeExecution {
}

/** The type of the data. */
declare enum Type {
    /**
     * Not specified, should not be used.
     */
    TYPE_UNSPECIFIED = "TYPE_UNSPECIFIED",
    /**
     * OpenAPI string type
     */
    STRING = "STRING",
    /**
     * OpenAPI number type
     */
    NUMBER = "NUMBER",
    /**
     * OpenAPI integer type
     */
    INTEGER = "INTEGER",
    /**
     * OpenAPI boolean type
     */
    BOOLEAN = "BOOLEAN",
    /**
     * OpenAPI array type
     */
    ARRAY = "ARRAY",
    /**
     * OpenAPI object type
     */
    OBJECT = "OBJECT",
    /**
     * Null type
     */
    NULL = "NULL"
}

/** Tool to support URL context. */
declare interface UrlContext {
}

/** Retrieve from Vertex AI Search datastore or engine for grounding. datastore and engine are mutually exclusive. See https://cloud.google.com/products/agent-builder. This data type is not supported in Gemini API. */
declare interface VertexAISearch {
    /** Specifications that define the specific DataStores to be searched, along with configurations for those data stores. This is only considered for Engines with multiple data stores. It should only be set if engine is used. */
    dataStoreSpecs?: VertexAISearchDataStoreSpec[];
    /** Optional. Fully-qualified Vertex AI Search data store resource ID. Format: `projects/{project}/locations/{location}/collections/{collection}/dataStores/{dataStore}` */
    datastore?: string;
    /** Optional. Fully-qualified Vertex AI Search engine resource ID. Format: `projects/{project}/locations/{location}/collections/{collection}/engines/{engine}` */
    engine?: string;
    /** Optional. Filter strings to be passed to the search API. */
    filter?: string;
    /** Optional. Number of search results to return per query. The default value is 10. The maximumm allowed value is 10. */
    maxResults?: number;
}

/** Define data stores within engine to filter on in a search call and configurations for those data stores. For more information, see https://cloud.google.com/generative-ai-app-builder/docs/reference/rpc/google.cloud.discoveryengine.v1#datastorespec. This data type is not supported in Gemini API. */
declare interface VertexAISearchDataStoreSpec {
    /** Full resource name of DataStore, such as Format: `projects/{project}/locations/{location}/collections/{collection}/dataStores/{dataStore}` */
    dataStore?: string;
    /** Optional. Filter specification to filter documents in the data store specified by data_store field. For more information on filtering, see [Filtering](https://cloud.google.com/generative-ai-app-builder/docs/filter-search-metadata) */
    filter?: string;
}

/** Retrieve from Vertex RAG Store for grounding. This data type is not supported in Gemini API. */
declare interface VertexRagStore {
    /** Optional. Deprecated. Please use rag_resources instead. */
    ragCorpora?: string[];
    /** Optional. The representation of the rag source. It can be used to specify corpus only or ragfiles. Currently only support one corpus or multiple files from one corpus. In the future we may open up multiple corpora support. */
    ragResources?: VertexRagStoreRagResource[];
    /** Optional. The retrieval config for the Rag query. */
    ragRetrievalConfig?: RagRetrievalConfig;
    /** Optional. Number of top k results to return from the selected corpora. */
    similarityTopK?: number;
    /** Optional. Currently only supported for Gemini Multimodal Live API. In Gemini Multimodal Live API, if `store_context` bool is specified, Gemini will leverage it to automatically memorize the interactions between the client and Gemini, and retrieve context when needed to augment the response generation for users' ongoing and future interactions. */
    storeContext?: boolean;
    /** Optional. Only return results with vector distance smaller than the threshold. */
    vectorDistanceThreshold?: number;
}

/** The definition of the Rag resource. This data type is not supported in Gemini API. */
declare interface VertexRagStoreRagResource {
    /** Optional. RagCorpora resource name. Format: `projects/{project}/locations/{location}/ragCorpora/{rag_corpus}` */
    ragCorpus?: string;
    /** Optional. rag_file_id. The files should be in the same rag_corpus set in rag_corpus field. */
    ragFileIds?: string[];
}

/** Metadata describes the input video content. */
declare interface VideoMetadata {
    /** Optional. The end offset of the video. */
    endOffset?: string;
    /** Optional. The frame rate of the video sent to the model. If not specified, the default value will be 1.0. The fps range is (0.0, 24.0]. */
    fps?: number;
    /** Optional. The start offset of the video. */
    startOffset?: string;
}

declare interface VoiceConfig {
    /** If true, the model will use a replicated voice for the response. */
    replicatedVoiceConfig?: ReplicatedVoiceConfig;
    /** The configuration for the prebuilt voice to use. */
    prebuiltVoiceConfig?: PrebuiltVoiceConfig;
}

export { }
