# Cloudflare CORS Anywhere

A Cloudflare Worker script that acts as a CORS proxy, allowing cross-origin resource sharing for specified origins and URLs.

## Features

- Handles OPTIONS preflight requests
- Modifies response headers to enable CORS
- Configurable whitelist and blacklist patterns
- Parses custom headers
- Enforces security and rate-limiting policies

## Usage
https://your-worker-domain.workers.dev/?https://example.com/api


## Limits
- 100,000 requests/day
- 1,000 requests/10 minutes

## Deployment

1. Create a Cloudflare Worker in your Cloudflare dashboard
2. Copy the contents of `index.js` into your worker
3. Deploy the worker

## Configuration

You can configure whitelist and blacklist patterns in the script:

```javascript
const blacklistUrls = [];           // regexp for blacklisted urls
const whitelistOrigins = [ ".*" ];  // regexp for whitelisted origins