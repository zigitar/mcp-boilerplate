import type { AuthRequest, OAuthHelpers } from '@cloudflare/workers-oauth-provider';
import { Hono, type Context } from 'hono';
import { fetchUpstreamAuthToken, getUpstreamAuthorizeUrl, type Props } from './oauth';
import { clientIdAlreadyApproved, parseRedirectApproval, renderApprovalDialog } from './workers-oauth-utils';

// Define a more specific Context type for this handler
// Assumes Env type in worker-configuration.d.ts or global scope includes GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET etc.
type GoogleHandlerContext = Context<{
    Bindings: Env & { OAUTH_PROVIDER: OAuthHelpers }
}>;

const app = new Hono<{ Bindings: Env & { OAUTH_PROVIDER: OAuthHelpers } }>();

app.get('/authorize', async (c: GoogleHandlerContext) => {
    const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
    const { clientId } = oauthReqInfo;
    if (!clientId) {
        return c.text('Invalid request', 400);
    }

    // Ensure COOKIE_ENCRYPTION_KEY is in Env
    if (await clientIdAlreadyApproved(c.req.raw, oauthReqInfo.clientId, c.env.COOKIE_ENCRYPTION_KEY)) {
        return redirectToGoogle(c, oauthReqInfo);
    }

    return renderApprovalDialog(c.req.raw, {
        client: await c.env.OAUTH_PROVIDER.lookupClient(clientId),
        server: {
            provider: "google",
            name: 'MCP Boilerplate',
            logo: "https://avatars.githubusercontent.com/u/314135?s=200&v=4",
            description: 'This is a boilerplate MCP that you can use to build your own remote MCP server, with Stripe integration for paid tools and Google/Github authentication.',
        },
        state: { oauthReqInfo },
    });
});

app.post('/authorize', async (c: GoogleHandlerContext) => {
    const { state, headers } = await parseRedirectApproval(c.req.raw, c.env.COOKIE_ENCRYPTION_KEY);
    if (!state.oauthReqInfo) {
        return c.text('Invalid request', 400);
    }
    return redirectToGoogle(c, state.oauthReqInfo, headers);
});

async function redirectToGoogle(c: GoogleHandlerContext, oauthReqInfo: AuthRequest, headers: Record<string, string> = {}) {
    const paramsForUpstream = {
        upstream_url: 'https://accounts.google.com/o/oauth2/v2/auth',
        scope: 'email profile openid',
        client_id: c.env.GOOGLE_CLIENT_ID, // Requires GOOGLE_CLIENT_ID in Env
        redirect_uri: new URL('/callback', c.req.raw.url).href,
        state: btoa(JSON.stringify(oauthReqInfo)),
        response_type: 'code',
        access_type: 'offline',
        prompt: 'consent',
        ...(c.env.HOSTED_DOMAIN && { hd: c.env.HOSTED_DOMAIN }), // Requires HOSTED_DOMAIN in Env (optional)
    };

    return new Response(null, {
        status: 302,
        headers: {
            ...headers,
            // Assuming getUpstreamAuthorizeUrl in utils.ts can handle extra params or needs update
            location: getUpstreamAuthorizeUrl(paramsForUpstream as any),
        },
    });
}

app.get("/callback", async (c: GoogleHandlerContext) => {
    const stateQueryParam = c.req.query("state");
    if (!stateQueryParam) {
        return c.text("Invalid request: Missing state parameter", 400);
    }
    const oauthReqInfo = JSON.parse(atob(stateQueryParam)) as AuthRequest;
    if (!oauthReqInfo.clientId) {
        return c.text("Invalid state: Missing clientId", 400);
    }

    const code = c.req.query("code");
    if (!code) {
        return c.text("Invalid request: Missing code parameter", 400);
    }

    const tokenParams = {
        upstream_url: 'https://oauth2.googleapis.com/token',
        client_id: c.env.GOOGLE_CLIENT_ID, // Requires GOOGLE_CLIENT_ID in Env
        client_secret: c.env.GOOGLE_CLIENT_SECRET, // Requires GOOGLE_CLIENT_SECRET in Env
        code: code as string,
        redirect_uri: new URL('/callback', c.req.url).href,
        grant_type: 'authorization_code',
    };

    // Assuming fetchUpstreamAuthToken in utils.ts can handle grant_type or needs update
    const [accessToken, googleErrResponse] = await fetchUpstreamAuthToken(tokenParams as any);

    if (googleErrResponse) {
        console.error("Google OAuth token exchange error:", await googleErrResponse.clone().text());
        return googleErrResponse;
    }
    if (!accessToken) {
        return c.text('Failed to obtain access token from Google.', 500);
    }

    const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userResponse.ok) {
        const errorText = await userResponse.text();
        console.error("Google userinfo fetch error:", errorText);
        // Return a generic error and log Google's status/message
        return c.text(`Failed to fetch user info (Status: ${userResponse.status}). Check server logs.`, 500);
    }

    const userInfo = (await userResponse.json()) as {
        sub: string; name?: string; email?: string; picture?: string;
    };

    if (!userInfo.sub) {
        return c.text('Failed to obtain user ID (sub) from Google.', 500);
    }

    const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
        request: oauthReqInfo,
        userId: userInfo.sub,
        metadata: { label: userInfo.name || userInfo.email || userInfo.sub },
        scope: oauthReqInfo.scope,
        props: {
            login: userInfo.email || userInfo.sub,
            name: userInfo.name,
            email: userInfo.email,
            userEmail: userInfo.email,
            accessToken,
            picture: userInfo.picture,
        } as Props,
    });

    return Response.redirect(redirectTo);
});

export { app as GoogleHandler }; 