import { configureOAuth } from "@atcute/oauth-browser-client";

import {
  CompositeDidDocumentResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
  CompositeHandleResolver,
  DohJsonHandleResolver,
  WellKnownHandleResolver,
  LocalActorResolver,
} from "@atcute/identity-resolver";

import type {
  IdentityResolver,
  ResolvedIdentity,
  ResolveIdentityOptions,
} from "@atcute/oauth-browser-client";

import type { ActorIdentifier } from "@atcute/lexicons";

/**
 * Wraps an existing identity resolver and rewrites PDS endpoints to point to our OAuth proxy
 */
export class ProxyIdentityResolver implements IdentityResolver {
  constructor(
    private upstream: IdentityResolver,
    private proxyUrl: string,
  ) {}

  async resolve(
    actor: ActorIdentifier,
    options?: ResolveIdentityOptions,
  ): Promise<ResolvedIdentity> {
    // Use the upstream resolver to get the actual identity
    const identity = await this.upstream.resolve(actor, options);

    // Rewrite the PDS endpoint to point to our proxy
    console.log(
      "Rewriting PDS endpoint from",
      identity.pds,
      "to",
      this.proxyUrl,
    );

    return {
      ...identity,
      pds: this.proxyUrl,
    };
  }
}

let isConfigured = false;

// OAuth proxy URL - defaults to current origin, can be overridden via env var
const OAUTH_PROXY_URL =
  import.meta.env.VITE_OAUTH_PROXY_URL || "http://127.0.0.1:3000"; //window.location.origin;

export function initOAuth() {
  if (isConfigured) {
    return;
  }

  // Default to current origin for client_id and redirect_uri if not specified
  const origin = window.location.origin;
  const client_id =
    import.meta.env.VITE_OAUTH_CLIENT_ID || `${origin}/client-metadata.json`;
  const redirect_uri =
    import.meta.env.VITE_OAUTH_REDIRECT_URI || `${origin}/oauth/callback`;

  const didResolver = new CompositeDidDocumentResolver({
    methods: {
      plc: new PlcDidDocumentResolver(),
      web: new WebDidDocumentResolver(),
    },
  });

  const handleResolver = new CompositeHandleResolver({
    methods: {
      dns: new DohJsonHandleResolver({
        dohUrl: "https://mozilla.cloudflare-dns.com/dns-query",
      }),
      http: new WellKnownHandleResolver(),
    },
  });

  // Create an identity resolver from DID and handle resolvers
  const identityResolver = new LocalActorResolver({
    didDocumentResolver: didResolver,
    handleResolver,
  });

  // Wrap it with our proxy resolver to rewrite PDS endpoints
  const proxyResolver = new ProxyIdentityResolver(
    identityResolver,
    OAUTH_PROXY_URL,
  );

  configureOAuth({
    metadata: {
      client_id,
      redirect_uri,
    },
    identityResolver: proxyResolver,
  });

  isConfigured = true;
}
