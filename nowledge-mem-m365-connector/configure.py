"""Generate credential-free Microsoft MCP connection artifacts; no network calls."""
import argparse
import ipaddress
import json
from pathlib import Path
import struct
import uuid
import zipfile
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

VERSION = "0.1.0"


def endpoint(value):
    url = urlsplit(value)
    if (url.scheme != "https" or not url.hostname or url.username or url.password
            or url.fragment or url.path.rstrip("/") != "/mcp"
            or any(ord(c) <= 32 for c in value) or "%" in url.netloc):
        raise ValueError("Use a credential-free public HTTPS /mcp endpoint")
    host = url.hostname.lower()
    if host == "localhost" or host.endswith((".localhost", ".local", ".internal", ".trycloudflare.com")):
        raise ValueError("Use a permanent public endpoint, not loopback or a Quick tunnel")
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        address = None
    if address is not None and not address.is_global:
        raise ValueError("Private IP endpoints cannot be reached by Microsoft")
    # Reject unknown query fields rather than accidentally packaging secrets.
    query = parse_qsl(url.query, keep_blank_values=True, strict_parsing=True)
    if query and query != [("space_protocol", "exact-v1")]:
        raise ValueError("Only space_protocol=exact-v1 is allowed in the endpoint query")
    _ = url.port  # Validate malformed ports before returning configuration.
    return urlunsplit(("https", url.netloc, "/mcp", urlencode({"space_protocol": "exact-v1"}), ""))


def studio(value):
    url = urlsplit(endpoint(value))
    return {
        "swagger": "2.0", "info": {"title": "Nowledge Mem", "version": VERSION,
            "description": "Search and deliberately save knowledge in the authenticated Mem workspace."},
        "host": url.netloc, "basePath": "/", "schemes": ["https"],
        "securityDefinitions": {"memConnection": {"type": "apiKey", "in": "header", "name": "Authorization"}},
        "security": [{"memConnection": []}],
        "paths": {"/mcp": {"post": {
            "summary": "Nowledge Mem remote MCP", "operationId": "InvokeMCP",
            "x-ms-agentic-protocol": "mcp-streamable-1.0",
            "parameters": [{"name": "space_protocol", "in": "query", "required": True,
                "type": "string", "enum": ["exact-v1"], "default": "exact-v1",
                "x-ms-visibility": "internal"}],
            "responses": {"200": {"description": "MCP response"}}}}},
    }


def oauth_compatibility(metadata):
    """A necessary DCR check, never proof of a Microsoft tenant handshake."""
    if not isinstance(metadata, dict):
        raise ValueError("Authorization-server metadata must be an object")
    methods = metadata.get("token_endpoint_auth_methods_supported", [])
    challenges = metadata.get("code_challenge_methods_supported", [])
    if (not isinstance(methods, list) or not all(isinstance(m, str) for m in methods)
            or not isinstance(challenges, list) or not all(isinstance(m, str) for m in challenges)):
        raise ValueError("OAuth methods must be arrays of strings")
    supported = [m for m in ("client_secret_post", "client_secret_basic") if m in methods]
    return {"confidential_client_methods": supported,
            "microsoft_dcr_candidate": bool(supported and metadata.get("registration_endpoint")
                                             and "S256" in challenges),
            "tenant_verified": False}


def fragment(value, auth_type, reference, metadata=None):
    if auth_type not in {"DynamicClientRegistration", "ApiKeyPluginVault"}:
        raise ValueError("Unsupported authentication type")
    if not reference or any(c.isspace() for c in reference):
        raise ValueError("Supply the non-secret Microsoft authorization configuration ID")
    if auth_type == "DynamicClientRegistration":
        if not oauth_compatibility(metadata)["microsoft_dcr_candidate"]:
            raise ValueError("Microsoft DCR needs secret-bearing client registration and S256; public-client-only OAuth is incompatible")
    return {"agentConnectors": [{"id": "nowledge-mem", "displayName": "Nowledge Mem",
        "description": "Recall and save knowledge within your authorized Mem workspace.",
        "toolSource": {"remoteMcpServer": {"mcpServerUrl": endpoint(value),
            "authorization": {"type": auth_type, "referenceId": reference}}}}]}


def app_manifest(value, auth_type, reference, app_id, metadata=None):
    app_id = str(uuid.UUID(app_id))
    result = {
        "$schema": "https://developer.microsoft.com/en-us/json-schemas/teams/v1.30/MicrosoftTeams.schema.json",
        "manifestVersion": "1.30", "version": VERSION, "id": app_id,
        "developer": {"name": "Nowledge Labs", "websiteUrl": "https://mem.nowledge.co",
                      "privacyUrl": "https://mem.nowledge.co/privacy", "termsOfUseUrl": "https://mem.nowledge.co/terms"},
        "name": {"short": "Nowledge Mem", "full": "Nowledge Mem for Microsoft 365 Copilot"},
        "description": {"short": "Recall and deliberately save knowledge in your Mem workspace.",
                        "full": "Connect directly to your authorized Nowledge Mem workspace. Search prior knowledge and save useful decisions with your own credentials and consent. Tenant availability and permissions apply."},
        "icons": {"color": "color.png", "outline": "outline.png"}, "accentColor": "#242424",
        "validDomains": [urlsplit(endpoint(value)).hostname],
    }
    result.update(fragment(value, auth_type, reference, metadata))
    return result


def png(path, size):
    with Path(path).open("rb") as source:
        data = source.read(1024 * 1024 + 1)
    if (len(data) > 1024 * 1024 or len(data) < 33 or data[:8] != b"\x89PNG\r\n\x1a\n"
            or data[12:16] != b"IHDR" or struct.unpack(">II", data[16:24]) != (size, size)):
        raise ValueError(f"Icon must be a PNG of {size}x{size}, at most 1 MiB")
    return data


def package(manifest, color, outline, destination):
    # Validate all inputs before creating anything. Exclusive output preserves
    # an existing artifact; no token/credential material is accepted here.
    icons = {"color.png": png(color, 192), "outline.png": png(outline, 32)}
    with zipfile.ZipFile(destination, "x", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", json.dumps(manifest, indent=2))
        for name, data in icons.items():
            archive.writestr(name, data)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True)
    parser.add_argument("--format", choices=["studio", "agent-connectors", "app-manifest", "oauth-check"], default="studio")
    parser.add_argument("--auth-type", choices=["DynamicClientRegistration", "ApiKeyPluginVault"], default="DynamicClientRegistration")
    parser.add_argument("--reference-id", help="Microsoft config ID, never a token or key")
    parser.add_argument("--metadata", type=Path, help="Authorization-server discovery JSON, not client credentials")
    parser.add_argument("--app-id", help="App UUID registered in Microsoft Developer Portal")
    parser.add_argument("--package", type=Path, help="Create a new installable ZIP; never overwrite an existing artifact")
    parser.add_argument("--color-icon", type=Path)
    parser.add_argument("--outline-icon", type=Path)
    args = parser.parse_args()
    try:
        metadata = None
        if args.metadata:
            with args.metadata.open("rb") as source:
                raw = source.read(1024 * 1024 + 1)
            if len(raw) > 1024 * 1024:
                raise ValueError("Discovery metadata exceeds 1 MiB")
            metadata = json.loads(raw)
        endpoint(args.url)
        if args.format == "studio":
            result = studio(args.url)
        elif args.format == "oauth-check":
            result = oauth_compatibility(metadata)
        elif args.format == "app-manifest":
            if not args.app_id:
                raise ValueError("app-manifest requires --app-id")
            result = app_manifest(args.url, args.auth_type, args.reference_id, args.app_id, metadata)
        else:
            result = fragment(args.url, args.auth_type, args.reference_id, metadata)
        if args.package:
            if args.format != "app-manifest" or not args.color_icon or not args.outline_icon:
                raise ValueError("ZIP packaging requires app-manifest and both icon paths")
            package(result, args.color_icon, args.outline_icon, args.package)
    except (ValueError, OSError) as error:
        parser.error(str(error))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
