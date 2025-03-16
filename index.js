/*
CORS Anywhere as a Cloudflare Worker!
(c) 2025 by sarkyboy

Updated and fixed version (2025)

This Cloudflare Worker script acts as a CORS proxy that allows
cross-origin resource sharing for specified origins and URLs.
It handles OPTIONS preflight requests and modifies response headers accordingly to enable CORS.
The script also includes functionality to parse custom headers and provide detailed information
about the CORS proxy service when accessed without specific parameters.
The script is configurable with whitelist and blacklist patterns.
The main goal is to facilitate cross-origin requests while enforcing specific security and rate-limiting policies.
*/

// Configuration: Whitelist and Blacklist
const blacklistUrls = [];           // regexp for blacklisted urls
const whitelistOrigins = [ ".*" ];   // regexp for whitelisted origins

// Function to check if a given URI or origin is listed in the whitelist or blacklist
function isListedInWhitelist(uri, listing) {
    let isListed = false;
    if (typeof uri === "string") {
        listing.forEach((pattern) => {
            if (uri.match(pattern) !== null) {
                isListed = true;
            }
        });
    } else {
        // When URI is null (e.g., when Origin header is missing), decide based on the implementation
        isListed = true; // true accepts null origins, false would reject them
    }
    return isListed;
}

// Event listener for incoming fetch requests
addEventListener("fetch", async event => {
    event.respondWith(handleRequest(event));
});

async function handleRequest(event) {
    const isPreflightRequest = (event.request.method === "OPTIONS");
    const originUrl = new URL(event.request.url);
    const originHeader = event.request.headers.get("Origin");
    const connectingIp = event.request.headers.get("CF-Connecting-IP");

    // Function to modify headers to enable CORS
    function setupCORSHeaders(headers) {
        headers.set("Access-Control-Allow-Origin", originHeader || "*");
        headers.set("Access-Control-Allow-Credentials", "true");
        
        if (isPreflightRequest) {
            headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
            const requestedHeaders = event.request.headers.get("Access-Control-Request-Headers");

            if (requestedHeaders) {
                headers.set("Access-Control-Allow-Headers", requestedHeaders);
            }

            headers.delete("X-Content-Type-Options"); // Remove X-Content-Type-Options header
        }
        return headers;
    }

    // Display home page if no URL is provided
    if (!originUrl.search || !originUrl.search.startsWith("?")) {
        const responseHeaders = new Headers();
        setupCORSHeaders(responseHeaders);

        let country = false;
        let colo = false;
        if (event.request.cf) {
            country = event.request.cf.country || false;
            colo = event.request.cf.colo || false;
        }

        return new Response(
            "CLOUDFLARE-CORS-ANYWHERE\n\n" +
            "By sarkyboy (2025)\n\n" +
            "Usage:\n" +
            originUrl.origin + "/?uri\n\n" +
            "Limits: 100,000 requests/day\n" +
            "          1,000 requests/10 minutes\n\n" +
            (originHeader !== null ? "Origin: " + originHeader + "\n" : "") +
            "IP: " + connectingIp + "\n" +
            (country ? "Country: " + country + "\n" : "") +
            (colo ? "Datacenter: " + colo + "\n" : ""),
            {
                status: 200,
                headers: responseHeaders
            }
        );
    }

    // Get the target URL from the query parameter
    const targetUrl = decodeURIComponent(originUrl.search.substr(1));
    
    // Check if the URL is allowed based on blacklist/whitelist
    if ((!isListedInWhitelist(targetUrl, blacklistUrls)) && (isListedInWhitelist(originHeader, whitelistOrigins))) {
        let customHeaders = {};
        const xCorsHeaders = event.request.headers.get("x-cors-headers");
        
        if (xCorsHeaders) {
            try {
                customHeaders = JSON.parse(xCorsHeaders);
            } catch (e) {
                // Silently fail if header parsing fails
            }
        }

        // Filter out problematic headers
        const filteredHeaders = new Headers();
        for (const [key, value] of event.request.headers.entries()) {
            if (
                !key.match("^origin") &&
                !key.match("eferer") &&
                !key.match("^cf-") &&
                !key.match("^x-forw") &&
                !key.match("^x-cors-headers")
            ) {
                filteredHeaders.set(key, value);
            }
        }

        // Add custom headers if provided
        if (Object.keys(customHeaders).length > 0) {
            Object.entries(customHeaders).forEach(([key, value]) => {
                filteredHeaders.set(key, value);
            });
        }

        // Handle preflight requests
        if (isPreflightRequest) {
            const responseHeaders = new Headers();
            setupCORSHeaders(responseHeaders);
            return new Response(null, {
                status: 200,
                statusText: "OK",
                headers: responseHeaders
            });
        }

        // Forward the request to the target URL
        try {
            const fetchOptions = {
                method: event.request.method,
                headers: filteredHeaders,
                redirect: "follow",
                body: event.request.method !== "GET" && event.request.method !== "HEAD" ? await event.request.clone().arrayBuffer() : undefined
            };

            const response = await fetch(targetUrl, fetchOptions);
            
            // Create a new response with CORS headers
            const responseHeaders = new Headers(response.headers);
            const exposedHeaders = [];
            const allResponseHeaders = {};
            
            for (const [key, value] of response.headers.entries()) {
                exposedHeaders.push(key);
                allResponseHeaders[key] = value;
            }
            
            exposedHeaders.push("cors-received-headers");
            setupCORSHeaders(responseHeaders);
            
            responseHeaders.set("Access-Control-Expose-Headers", exposedHeaders.join(","));
            responseHeaders.set("cors-received-headers", JSON.stringify(allResponseHeaders));
            
            const responseBody = await response.arrayBuffer();
            
            return new Response(responseBody, {
                status: response.status,
                statusText: response.statusText,
                headers: responseHeaders
            });
        } catch (error) {
            return new Response(`Error proxying request: ${error.message}`, {
                status: 500,
                headers: { "Content-Type": "text/plain" }
            });
        }
    } else {
        // Return forbidden if the URL or origin is not allowed
        return new Response(
            "Access Forbidden\n" +
            "CORS Anywhere by sarkyboy (2025)",
            {
                status: 403,
                statusText: 'Forbidden',
                headers: {
                    "Content-Type": "text/plain"
                }
            }
        );
    }
}