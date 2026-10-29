---
name: gmp-common-grounding
description: Use this skill to access rules and specifications for the Google Maps Platform Grounding Lite service and its Model Context Protocol (MCP) tools for AI applications.
license: Apache-2.0
metadata:
  version: 1.0.57
---

> [!IMPORTANT] **Core Dependency:** This skill requires active context from
> [google-maps-platform/SKILL.md](https://www.gstatic.com/googlemapsplatform-agent-skills/google-maps-platform/SKILL.md).

## Google Maps Platform Grounding Lite

Google Maps Platform Grounding Lite is a service that provides Model Context
Protocol (MCP) support to ground AI applications with trusted geospatial data
from Google Maps. It allows Large Language Models (LLMs) to access capabilities
for places, weather, and routes through a dedicated MCP server.

The service is subject to the Google Maps Platform Terms of Service, including
service-specific terms, and requires compliance with attribution rules.

### Available Tools

Maps Grounding Lite exposes five primary tools through its MCP server
(`https://mapstools.googleapis.com/mcp`):

*   **`search_places`**: Finds places, businesses, addresses, and points of
    interest.
    *   **Input**: Requires a mandatory `text_query` and optional
        `location_bias` (a `circle` object for center point/radius),
        `language_code`, and `region_code`.
    *   **Constraint**: The search must contain sufficient location information,
        either in the `text_query` or via `location_bias`.
*   **`lookup_weather`**: Retrieves comprehensive weather data, including
    current conditions, hourly, and daily forecasts.
    *   **Location**: The location is a mandatory 'oneof' structure, accepting
        either `lat_lng`, `place_id`, or `address`.
    *   **Forecasting**: Supports current weather, hourly forecast (up to 120
        hours out or 24 hours back), and daily forecast (up to 10 days out).
    *   **Units**: Defaults to `METRIC`; use `units_system: "IMPERIAL"` for US
        standards.
*   **`compute_routes`**: Computes distance and duration for a travel route
    between an origin and destination.
    *   **Input**: Requires both `origin` and `destination`, each specified by
        `address`, `lat_lng`, or `place_id`.
    *   **Travel Modes**: Supported modes are `DRIVE` (default) and `WALK`. Note
        that Maps Grounding Lite does not provide step-by-step routing or
        navigation.

#### Resolution API (Experimental)

The Resolution API provides batch processing REST endpoints (also exposed as MCP
tools) to resolve location text and URLs to structured Place IDs. This API is in
the Experimental (pre-GA) stage and is currently provided at no charge.

*   **`resolve_names` (MCP Tool) / `v1alpha:resolveNames` (REST)**
    *   **Function**: Resolves a batch of specific location queries (names or
        exact addresses) into canonical Google Maps Place IDs.
    *   **Constraint**: Queries must be specific (e.g., `'Eiffel Tower,
        Paris'`). General searches (e.g., `'restaurants'`) or generic chain
        names are not supported.
*   **`resolve_maps_urls` (MCP Tool) / `v1alpha:resolveMapsUrls` (REST)**
    *   **Function**: Resolves a batch of valid, single-place Google Maps URLs
        into canonical Google Maps Place IDs.
    *   **Supported URLs**: Standard place URLs
        (`https://www.google.com/maps/place/...`) and shortened URLs
        (`https://maps.app.goo.gl/...`). General query-based URLs are not
        supported.

#### Batch Processing and Error Handling

For `resolve_names` and `resolve_maps_urls`:

*   **Batch Limit**: A maximum of **20 items** (queries or URLs) is allowed per
    request.
*   **Partial Success**: The tool returns a result list that maps 1:1 with the
    input. If an item fails, its corresponding entry in the output will be
    empty, and the failure details will be in the `failedRequests` map.
*   **Top-Level Failure**: A top-level HTTP error is only returned for request
    validation failures (e.g., exceeding the 20-item limit).

### Technical Integration

To use Maps Grounding Lite, you must first enable the *Maps Grounding Lite* API
service on a Google Cloud project with billing enabled.

#### MCP Server Endpoint

The global endpoint for the Maps Grounding Lite MCP server is:
`https://mapstools.googleapis.com/mcp`

#### Authentication

The Maps Grounding Lite Resolution API supports both API Key and OAuth 2.0
authentication.

*   **API Key**: Pass the API key in the `X-Goog-Api-Key` header when
    configuring the MCP tool, or append it to the REST URL via the
    `?key=YOUR_API_KEY` parameter. (See
    [API Key Management](https://www.gstatic.com/googlemapsplatform-agent-skills/gmp-common-api-keys/SKILL.md)
    for key setup).
*   **OAuth 2.0**: Required scope is
    `https://www.googleapis.com/auth/maps-platform.mapstools`.

#### Gemini CLI Configuration

To configure the Maps Grounding Lite MCP server with the Gemini CLI:

```text
gemini mcp add -s user -t http -H 'X-Goog-Api-Key: API_KEY' maps-grounding-lite-mcp https://mapstools.googleapis.com/mcp
```

### Attribution Requirements

When presenting results from Maps Grounding Lite, you **must** include the
associated Google Maps sources (provided in the `attribution` field of the
response).

*   **Placement**: Sources must immediately follow the generated "Grounded
    Output" that they support.
*   **Accessibility**: Sources must be viewable within one user interaction.
*   **Display**: A link preview must be generated for each source, displaying
    the `title` and linking to the `url` provided in the response. Attribution
    must be styled according to the Google Maps text attribution guidelines.

### References

*   https://cloud.google.com/maps-platform/terms?utm_campaign=gmp_git_agentskills_v1
*   https://cloud.google.com/maps-platform/terms/maps-service-terms?utm_campaign=gmp_git_agentskills_v1
*   https://developers.google.com/maps/ai/grounding-lite?utm_campaign=gmp_git_agentskills_v1
*   https://developers.google.com/maps/ai/grounding-lite/attribution?utm_campaign=gmp_git_agentskills_v1
*   https://developers.google.com/maps/ai/grounding-lite/reference/mcp?utm_campaign=gmp_git_agentskills_v1
*   https://developers.google.com/maps/ai/grounding-lite/reference/mcp/compute_routes?utm_campaign=gmp_git_agentskills_v1
*   https://developers.google.com/maps/ai/grounding-lite/reference/mcp/lookup_weather?utm_campaign=gmp_git_agentskills_v1
*   https://developers.google.com/maps/ai/grounding-lite/reference/mcp/resolve_maps_urls?utm_campaign=gmp_git_agentskills_v1
*   https://developers.google.com/maps/ai/grounding-lite/reference/mcp/resolve_names?utm_campaign=gmp_git_agentskills_v1
*   https://developers.google.com/maps/ai/grounding-lite/reference/mcp/search_places?utm_campaign=gmp_git_agentskills_v1
*   https://developers.google.com/maps/ai/grounding-lite/resolution-api?utm_campaign=gmp_git_agentskills_v1
*   https://developers.google.com/maps/launch-stages?utm_campaign=gmp_git_agentskills_v1
