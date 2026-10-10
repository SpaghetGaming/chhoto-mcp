# Chhoto URL MCP Server

An MCP (Model Context Protocol) server that provides AI assistants with tools to interact with a [Chhoto URL](https://github.com/SinTan1729/chhoto-url) shortener instance.

![License: MIT](https://img.shields.io/badge/License-MIT-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)
![MCP SDK](https://img.shields.io/badge/MCP%20SDK-2.0+-purple)

## Overview

This MCP server exposes 8 tools that let AI assistants create, manage, and query shortened URLs through a Chhoto URL instance. It supports both stdio transport (for local hosts like Claude Desktop, Cursor, VS Code) and Streamable HTTP transport (for remote/shared deployments).

## Features

- **8 MCP tools** covering the full Chhoto URL API
- **Dual transport**: stdio (default) or Streamable HTTP
- **Zod validation** for all tool inputs
- **Environment-based configuration** — no config files needed
- **TypeScript** with strict type checking
- **Small footprint** — no heavy dependencies

## Quick Start

### Local Development

```bash
git clone https://github.com/spaghet-tech/chhoto-mcp.git
cd chhoto-mcp
npm install
npm run build
```

### Run with Your Chhoto Instance

```bash
export CHHOTO_URL=http://192.168.1.159:4567
export CHHOTO_API_KEY='your-api-key-here'
npm start
```

## Configuration

All configuration is done via environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CHHOTO_URL` | Yes | `http://localhost:4567` | Base URL of your Chhoto URL instance |
| `CHHOTO_API_KEY` | Yes | (empty) | API key for authentication |
| `TRANSPORT` | No | `stdio` | `stdio` or `streamable-http` |
| `BIND_HOST` | No | `0.0.0.0` | Bind address for HTTP transport |
| `BIND_PORT` | No | `8080` | Bind port for HTTP transport |

## Transport Modes

### Stdio Mode (Default)

Best for local AI hosts (Claude Desktop, Cursor, VS Code, etc.) that spawn the server as a child process.

```bash
CHHOTO_URL=http://your-instance:4567 \
CHHOTO_API_KEY=your-key \
npm start
```

### Streamable HTTP Mode

Best for shared/remote deployments where multiple clients need to connect.

```bash
TRANSPORT=streamable-http \
BIND_HOST=0.0.0.0 \
BIND_PORT=8080 \
CHHOTO_URL=http://your-instance:4567 \
CHHOTO_API_KEY=your-key \
npm start
```

Clients connect to `http://your-host:8080/mcp`.

## Available Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `shorten_url` | Create a new shortened URL | `long_url`, `short_link?`, `expiry_seconds?`, `notes?` |
| `expand_url` | Get info about a shortened URL | `short_link` |
| `edit_url` | Edit an existing short link | `short_link`, `long_url?`, `reset_hits?`, `expiry_seconds?`, `notes?` |
| `delete_url` | Delete a short link | `short_link` |
| `list_urls` | List all short links with filtering | `filter?`, `page_size?`, `page_after?`, `page_no?` |
| `get_version` | Get server version | (none) |
| `get_config` | Get backend configuration | (none) |
| `whoami` | Check authentication role | (none) |

## Usage Examples

### Shorten a URL

```json
{
  "tool": "shorten_url",
  "arguments": {
    "long_url": "https://example.com/very/long/url/path",
    "notes": "Blog post link"
  }
}
```

### Shorten with Custom Slug and Expiry

```json
{
  "tool": "shorten_url",
  "arguments": {
    "long_url": "https://example.com/temp",
    "short_link": "temp-link",
    "expiry_seconds": 86400,
    "notes": "Expires in 24 hours"
  }
}
```

### Expand a Short Link

```json
{
  "tool": "expand_url",
  "arguments": {
    "short_link": "abc123"
  }
}
```

### List All Links

```json
{
  "tool": "list_urls",
  "arguments": {
    "page_size": 20
  }
}
```

### Filter Links

```json
{
  "tool": "list_urls",
  "arguments": {
    "filter": "blog",
    "page_size": 10
  }
}
```

## Integration with AI Hosts

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "chhoto-url": {
      "command": "npx",
      "args": ["-y", "@spaghet/chhoto-mcp"],
      "env": {
        "CHHOTO_URL": "http://your-instance:4567",
        "CHHOTO_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "chhoto-url": {
      "command": "npx",
      "args": ["-y", "@spaghet/chhoto-mcp"],
      "env": {
        "CHHOTO_URL": "http://your-instance:4567",
        "CHHOTO_API_KEY": "your-api-key"
      }
    }
  }
}
```

### VS Code

Install the MCP extension and add to your settings:

```json
{
  "mcp.servers": {
    "chhoto-url": {
      "command": "npx",
      "args": ["-y", "@spaghet/chhoto-mcp"],
      "env": {
        "CHHOTO_URL": "http://your-instance:4567",
        "CHHOTO_API_KEY": "your-api-key"
      }
    }
  }
}
```

## Testing

### MCP Inspector

Test the server interactively with the official MCP Inspector:

```bash
npm run test
```

This opens a browser window where you can call each tool and inspect results.

### Manual Testing

```bash
# Stdio mode: pipe a JSON-RPC request
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | npm start

# HTTP mode: use curl
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

## Development

```bash
npm run dev      # Run with tsx (no build step)
npm run build    # Compile TypeScript
npm start        # Run compiled version
```

## Publishing to npm

```bash
npm version minor
npm publish --access public
```

After publishing, users can run:

```bash
npx @spaghet/chhoto-mcp
```

## License

MIT License — see [LICENSE](LICENSE) for details.

## Related Projects

- [Chhoto URL](https://github.com/SinTan1729/chhoto-url) — The URL shortener this MCP server integrates with
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) — The underlying MCP SDK
