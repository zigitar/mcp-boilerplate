# MCP Boilerplate: Simple Setup Guide

This project helps you create your own remote MCP server on Cloudflare with user login and payment options. You don't need to be a technical expert to get it running!

## What You'll Get

- An MCP server that works with , Cursor, Claude and other AI assistants
- User login with Google or GitHub
- Payment processing with Stripe
- The ability to create both free and paid MCP tools

## Setup Checklist

Before starting, make sure you have:

- Node.js installed (download from [nodejs.org](https://nodejs.org/))
- A Cloudflare account (sign up at [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up))
- A Google account for setting up login (or GitHub if you prefer)
- A Stripe account for payments (sign up at [dashboard.stripe.com/register](https://dashboard.stripe.com/register))

## Step-by-Step Setup

### Step 1: Get the Code

1. Clone this repository to your computer:
```bash
git clone https://github.com/playbookshq/mcp-boilerplate.git
cd mcp-boilerplate
```

2. Install everything needed:
```bash
npm install
```

### Step 2: Set Up the Database

1. Install Wrangler (Cloudflare's tool) if you haven't already:
```bash
npm install -g wrangler
```

1. Create a database for user login:
```bash
npx wrangler kv namespace create "OAUTH_KV"
```

1. After running this command, you'll see some text that includes `id` and `preview_id` values
   
2. Open the `wrangler.jsonc` file in the project folder

3. Look for the section with `"kv_namespaces": [`

4. Add your database information there:
```json
"kv_namespaces": [
  {
    "binding": "OAUTH_KV",
    "id": "paste-your-id-here",
    "preview_id": "paste-your-preview-id-here"
  }
]
```

### Step 3: Set Up Your Local Settings

1. Create a file for your settings:
```bash
cp .dev.vars.example .dev.vars
```

1. Open the `.dev.vars` file in your code editor

2. You'll need to add several values here (we'll get them in the next steps)

### Step 4a: Setting Up Google Login (Recommended)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project with any name you like
3. Go to "APIs & Services" > "Credentials"
4. Click "+ CREATE CREDENTIALS" and choose "OAuth client ID"
5. If prompted, set up a consent screen:
   - Choose "External" for User Type
   - Add an App name (like "My AI Tool")
   - Add your email address where required
   - You can skip the "Scopes" and "Test users" sections
6. For the OAuth client:
   - Select "Web application" for Application type
   - Give it a name
   - Under "Authorized redirect URIs" add: `http://localhost:8787/callback/google`
7. Click "CREATE"
8. You'll now see your Client ID and Client Secret - copy these values
9. Add them to your `.dev.vars` file:
```ini
GOOGLE_CLIENT_ID="paste-your-client-id-here"
GOOGLE_CLIENT_SECRET="paste-your-client-secret-here"
```

Once you've completed this step, you can proceed directly to Step 5 if you don't need GitHub login.

### Step 4b: Setting Up GitHub Login (Optional)

If you prefer to use GitHub for login instead of Google:

1. Go to your GitHub account
2. Click on your profile picture in the top-right corner, then go to "Settings"
3. In the left sidebar, scroll down and click on "Developer settings"
4. Click on "OAuth Apps", then click the "New OAuth App" button
5. Fill in the form:
   - Application name: Give it a name (like "My AI Tool")
   - Homepage URL: `http://localhost:8787`
   - Application description: A brief description of your app (optional)
   - Authorization callback URL: `http://localhost:8787/callback/github`
6. Click "Register application"
7. On the next page, you'll see your Client ID
8. Click "Generate a new client secret"
9. Copy your Client Secret immediately (you won't be able to see it again)
10. Add these values to your `.dev.vars` file:
```ini
GITHUB_CLIENT_ID="paste-your-client-id-here"
GITHUB_CLIENT_SECRET="paste-your-client-secret-here"
```
1.  You'll also need to update the default authentication in your code:
    - Open `src/index.ts`
    - Find the import for Google handler: `import { GoogleHandler } from "./auth/google-handler";`
    - Replace it with: `import { GithubHandler } from "./auth/github-handler";`
    - Find the line with `defaultHandler: GoogleHandler as any,`
    - Change it to: `defaultHandler: GithubHandler as any,`

After completing either Step 4a or 4b, proceed to Step 5.

### Step 5: Setting Up Stripe Payments

1. Log in to your [Stripe Dashboard](https://dashboard.stripe.com/)
2. Get your test API key:
   - Go to Developers > API keys
   - Copy your "Secret key" (it starts with `sk_test_`)
3. Create a product and price:
   - Go to Products > Add Product
   - Give it a name and description
   - Add a price (this is what users will pay)
   - Save the product
   - After saving, find and copy the "Price ID" (it starts with `price_`)
4. Add these values to your `.dev.vars` file:
```ini
STRIPE_SECRET_KEY="sk_test_your-key-here"
STRIPE_PRICE_ID="price_your-price-id-here"
```

### Step 6: Complete Your Settings

Make sure your `.dev.vars` file has all these values:

```ini
BASE_URL="http://localhost:8787"
COOKIE_ENCRYPTION_KEY="generate-a-random-string-at-least-32-characters"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
STRIPE_SECRET_KEY="your-stripe-secret-key"
STRIPE_PRICE_ID="your-stripe-price-id"
```

For the `COOKIE_ENCRYPTION_KEY`, you can generate a random string with this command:

```bash
openssl rand -hex 32
```

### Step 7: Start Your Server Locally

1. Run this command to start your server:
```bash
npx wrangler dev
```

1. Your server will start at `http://localhost:8787`

2. The main endpoint for AI tools will be at `http://localhost:8787/sse`

### Step 8: Try It Out

You can test your server by connecting to it with an AI assistant:

1. Go to [Cloudflare AI Playground](https://playground.ai.cloudflare.com/)
2. Enter your server URL: `http://localhost:8787/sse`
3. You'll be redirected to log in with Google
4. After logging in, you can start testing the tools

Or with Claude Desktop:

1. Open Claude Desktop
2. Go to Settings > Developer > Edit Config
3. Add your server:
```json
{
  "mcpServers": {
    "my_server": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://localhost:8787/sse"
      ]
    }
  }
}
```
1. Restart Claude Desktop
2. Your tools should now be available in Claude

Or with MCP Inspector:

1. Run MCP Inspector and connect to your server:
```bash
npx @modelcontextprotocol/inspector@latest
```
1. Enter your server URL: `http://localhost:8787/sse`
2. Use the web interface to test and debug your tools
3. You can directly call your tools, see the request/response data, and quickly iterate during development

### Step 9: Going Live (Deploying)

When you're ready to make your server available online:

1. Deploy to Cloudflare:
```bash
npx wrangler deploy
```

1. After deployment, you'll get a URL like `https://your-worker-name.your-account.workers.dev`

2a. Update your Google OAuth settings:
   - Go back to Google Cloud Console > APIs & Services > Credentials
   - Edit your OAuth client
   - Add another redirect URI: `https://your-worker-name.your-account.workers.dev/callback/google`

2b. Update your GitHub OAuth App settings: (optional)
   - Go to your GitHub Developer settings > OAuth Apps
   - Select your OAuth App
   - Update the "Authorization callback URL" to: `https://your-worker-name.your-account.workers.dev/callback/github`

3. Add your settings to Cloudflare by running these commands (you'll be prompted to enter each value):
```bash
npx wrangler secret put BASE_URL
npx wrangler secret put COOKIE_ENCRYPTION_KEY
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_PRICE_ID
```
   
   For the `BASE_URL`, use your Cloudflare URL: `https://your-worker-name.your-account.workers.dev`

## Creating Your Own Tools

You can easily create your own AI tools by adding new files to the `src/tools` folder. The project comes with examples of both free and paid tools.

### Creating a Free Tool

To create a free tool (one that users can access without payment):

1. Create a new file in the `src/tools` folder (for example: `myTool.ts`)
2. Copy this template from the existing `add.ts` example:

```typescript
import { z } from "zod";
import { experimental_PaidMcpAgent as PaidMcpAgent } from "@stripe/agent-toolkit/cloudflare";

export function myTool(agent: PaidMcpAgent<Env, any, any>) {
  const server = agent.server;
  // @ts-ignore
  server.tool(
    "my_tool_name",                      // The tool name
    "This tool does something cool.",    // Description of what your tool does
    {                                    // Input parameters
      input1: z.string(),                // Parameter definitions using Zod
      input2: z.number()                 // E.g., strings, numbers, booleans
    },
    async ({ input1, input2 }: { input1: string; input2: number }) => ({
      // The function that runs when the tool is called
      content: [{ type: "text", text: `You provided: ${input1} and ${input2}` }],
    })
  );
}
```

3. Modify the code to create your own tool:
   - Change the function name (`myTool`)
   - Change the tool name (`my_tool_name`)
   - Update the description
   - Define the input parameters your tool needs
   - Write the code that runs when the tool is called

4. Add your tool to `src/tools/index.ts`:
```typescript
// Add this line with your other exports
export * from './myTool';
```

1. Register your tool in `src/index.ts`:
```typescript
// Inside the init() method, add:
tools.myTool(this);
```

### Creating a Paid Tool

To create a tool that requires payment:

1. Create a new file in the `src/tools` folder (for example: `myPaidTool.ts`)
2. Copy this template from the existing `bigAdd.ts` example:

```typescript
import { z } from "zod";
import { experimental_PaidMcpAgent as PaidMcpAgent } from "@stripe/agent-toolkit/cloudflare";
import { REUSABLE_PAYMENT_REASON } from "../helpers/constants";

export function myPaidTool(
  agent: PaidMcpAgent<Env, any, any>, 
  env?: { STRIPE_PRICE_ID: string; BASE_URL: string }
) {
  const priceId = env?.STRIPE_PRICE_ID || null;
  const baseUrl = env?.BASE_URL || null;

  if (!priceId || !baseUrl) {
    throw new Error("No env provided");
  }
  
  agent.paidTool(
    "my_paid_tool_name",               // The tool name
    {                                  // Input parameters
      input1: z.string(),              // Parameter definitions using Zod
      input2: z.number()               // E.g., strings, numbers, booleans
    },
    async ({ input1, input2 }: { input1: string; input2: number }) => ({
      // The function that runs when the tool is called
      content: [{ type: "text", text: `You provided: ${input1} and ${input2}` }],
    }),
    {
      priceId,                         // Uses the Stripe price ID
      successUrl: `${baseUrl}/payment/success`,
      paymentReason: REUSABLE_PAYMENT_REASON,
    }
  );
}
```

3. Modify the code to create your own paid tool:
   - Change the function name (`myPaidTool`)
   - Change the tool name (`my_paid_tool_name`)
   - Define the input parameters your tool needs
   - Write the code that runs when the tool is called

4. Add your tool to `src/tools/index.ts`:
```typescript
// Add this line with your other exports
export * from './myPaidTool';
```

1. Register your tool in `src/index.ts`:
```typescript
// Inside the init() method, add:
tools.myPaidTool(this, { 
  STRIPE_PRICE_ID: this.env.STRIPE_PRICE_ID, 
  BASE_URL: this.env.BASE_URL 
});
```

You can create different paid tools with different Stripe products by creating additional price IDs in your Stripe dashboard and passing them as environment variables.

### What Happens When a Free User Tries a Paid Tool

When a user tries to access a paid tool without having purchased it:

1. The server checks if they've already paid
2. If not, the AI assistant will automatically prompt them with a checkout link
3. After completing payment on Stripe they should be able to use the tool immediately

## Future Enhancements (Optional)

### Setting Up Stripe Webhooks

The basic setup above is all you need to get started. The built-in Stripe integration verifies payments directly when users try to access paid tools - it checks both one-time payments and subscriptions automatically.

Webhooks are completely optional but could be useful for more complex payment scenarios in the future, like:

- Building a customer dashboard to display subscription status
- Implementing usage-based billing with metering
- Creating custom workflows when subscriptions are created or canceled
- Handling refunds and disputes with special logic

If you ever want to add webhook support:

1. Go to your Stripe Dashboard > Developers > Webhooks
2. Click "Add endpoint"
3. For the endpoint URL:
   - For local development: `http://localhost:8787/webhooks/stripe`
   - For production: `https://your-worker-name.your-account.workers.dev/webhooks/stripe`
4. For "Events to send", select events relevant to your needs, such as:
   - checkout.session.completed
   - invoice.payment_succeeded
   - customer.subscription.updated
5. After creating the webhook, copy the "Signing secret"
6. Add this value to your settings:
   - For local development, add to `.dev.vars`:
```ini
STRIPE_WEBHOOK_SECRET="whsec_your-webhook-secret-here"
```
   - For production, set it using Wrangler:
```bash
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

## Need Help?

If you get stuck or have questions, check out the more detailed documentation or reach out for support! 