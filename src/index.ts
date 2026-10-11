import { McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { toNodeHandler } from '@modelcontextprotocol/node';
import * as http from 'http';
import * as z from 'zod/v4';

// Environment configuration
const CHHOTO_URL = process.env.CHHOTO_URL || 'http://localhost:4567';
const CHHOTO_API_KEY = process.env.CHHOTO_API_KEY || '';
const TRANSPORT = (process.env.TRANSPORT || 'stdio').toLowerCase();
const BIND_HOST = process.env.BIND_HOST || '0.0.0.0';
const BIND_PORT = parseInt(process.env.BIND_PORT || '8080', 10);

console.error(`Chhoto MCP Server`);
console.error(`  Transport: ${TRANSPORT}`);
console.error(`  Chhoto URL: ${CHHOTO_URL}`);
console.error(`  API Key: ${CHHOTO_API_KEY ? 'configured' : 'not set'}`);
if (TRANSPORT === 'streamable-http') {
  console.error(`  Bind: ${BIND_HOST}:${BIND_PORT}`);
}

// API client helper
async function chhotoApi(path: string, options: RequestInit = {}) {
  const url = `${CHHOTO_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'chhoto-mcp/1.0.0',
  };
  if (CHHOTO_API_KEY) {
    headers['X-API-Key'] = CHHOTO_API_KEY;
  }

  try {
    const response = await fetch(url, { ...options, headers });
    const text = await response.text();

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { success: response.ok, error: !response.ok, reason: text };
    }

    if (!response.ok) {
      return { success: false, error: true, reason: json.reason || `HTTP ${response.status}: ${text}` };
    }

    return json;
  } catch (err) {
    return { success: false, error: true, reason: `Request failed: ${err}` };
  }
}

// Server factory
function createServer(): McpServer {
  const server = new McpServer({ name: 'chhoto-url', version: '1.0.0' });

  // Tool: Shorten URL
  server.registerTool(
    'shorten_url',
    {
      description: 'Create a new shortened URL. Optionally specify a custom short link, expiry time, and notes.',
      inputSchema: z.object({
        long_url: z.string().url().describe('The long URL to shorten'),
        short_link: z.string().optional().describe('Optional custom short link. If omitted, one is generated.'),
        expiry_seconds: z.number().int().positive().optional().describe('Optional expiry time in seconds (max 5 years = 157680000). 0 or omitted = no expiry.'),
        notes: z.string().optional().describe('Optional notes to attach to the link.')
      })
    },
    async ({ long_url, short_link, expiry_seconds, notes }) => {
      const body: Record<string, unknown> = { longlink: long_url };
      if (short_link) body.shortlink = short_link;
      if (expiry_seconds) body.expiry_delay = expiry_seconds;
      if (notes) body.notes = notes;

      const result = await chhotoApi('/api/new', {
        method: 'POST',
        body: JSON.stringify(body)
      });

      if (result.success) {
        return {
          content: [{
            type: 'text',
            text: `Shortened URL created: ${CHHOTO_URL}/${result.shorturl}\nOriginal: ${long_url}\n${result.expiry_time ? `Expires: ${new Date(result.expiry_time * 1000).toISOString()}` : 'No expiry'}`
          }]
        };
      }
      return {
        content: [{ type: 'text', text: `Failed to shorten URL: ${result.reason}` }],
        isError: true
      };
    }
  );

  // Tool: Expand URL
  server.registerTool(
    'expand_url',
    {
      description: 'Get information about a shortened URL including the original URL, hit count, expiry time, and notes.',
      inputSchema: z.object({
        short_link: z.string().describe('The short link to expand (without domain)')
      })
    },
    async ({ short_link }) => {
      const result = await chhotoApi('/api/expand', {
        method: 'POST',
        body: short_link
      });

      if (result.success) {
        return {
          content: [{
            type: 'text',
            text: `Short link: ${CHHOTO_URL}/${short_link}\nOriginal URL: ${result.longurl}\nHits: ${result.hits}\n${result.expiry_time ? `Expires: ${new Date(result.expiry_time * 1000).toISOString()}` : 'No expiry'}\n${result.notes ? `Notes: ${result.notes}` : ''}`
          }]
        };
      }
      return {
        content: [{ type: 'text', text: `Failed to expand URL: ${result.reason}` }],
        isError: true
      };
    }
  );

  // Tool: Edit URL
  server.registerTool(
    'edit_url',
    {
      description: 'Edit an existing shortened URL. Can change the destination, reset hits, set expiry, or update notes.',
      inputSchema: z.object({
        short_link: z.string().describe('The short link to edit'),
        long_url: z.string().url().optional().describe('New destination URL'),
        reset_hits: z.boolean().optional().describe('Reset hit counter to 0'),
        expiry_seconds: z.number().int().positive().optional().describe('New expiry time in seconds from now'),
        notes: z.string().optional().describe('New notes')
      })
    },
    async ({ short_link, long_url, reset_hits, expiry_seconds, notes }) => {
      const body: Record<string, unknown> = { shortlink: short_link };
      if (long_url) body.longlink = long_url;
      if (reset_hits !== undefined) body.reset_hits = reset_hits;
      if (expiry_seconds) body.expiry_time = Math.floor(Date.now() / 1000) + expiry_seconds;
      if (notes !== undefined) body.notes = notes;

      const result = await chhotoApi('/api/edit', {
        method: 'PUT',
        body: JSON.stringify(body)
      });

      if (result.success) {
        return {
          content: [{ type: 'text', text: `Successfully edited short link: ${short_link}` }]
        };
      }
      return {
        content: [{ type: 'text', text: `Failed to edit URL: ${result.reason}` }],
        isError: true
      };
    }
  );

  // Tool: Delete URL
  server.registerTool(
    'delete_url',
    {
      description: 'Delete a shortened URL permanently.',
      inputSchema: z.object({
        short_link: z.string().describe('The short link to delete')
      })
    },
    async ({ short_link }) => {
      const result = await chhotoApi(`/api/del/${encodeURIComponent(short_link)}`, {
        method: 'DELETE'
      });

      if (result.success) {
        return {
          content: [{ type: 'text', text: `Successfully deleted short link: ${short_link}` }]
        };
      }
      return {
        content: [{ type: 'text', text: `Failed to delete URL: ${result.reason}` }],
        isError: true
      };
    }
  );

  // Tool: List URLs
  server.registerTool(
    'list_urls',
    {
      description: 'List all shortened URLs with optional filtering and pagination.',
      inputSchema: z.object({
        filter: z.string().optional().describe('Filter links by text in short link, long URL, or notes (min 3 chars)'),
        page_size: z.number().int().positive().optional().describe('Number of results per page (default 10)'),
        page_after: z.string().optional().describe('Pagination cursor - short link to start after'),
        page_no: z.number().int().positive().optional().describe('Alternative pagination by page number')
      })
    },
    async ({ filter, page_size, page_after, page_no }) => {
      let path = '/api/all';
      const params: string[] = [];
      if (filter) params.push(`filter=${encodeURIComponent(filter)}`);
      if (page_size) params.push(`page_size=${page_size}`);
      if (page_after) params.push(`page_after=${encodeURIComponent(page_after)}`);
      if (page_no) params.push(`page_no=${page_no}`);
      if (params.length > 0) path += '?' + params.join('&');

      const result = await chhotoApi(path);

      if (Array.isArray(result)) {
        if (result.length === 0) {
          return { content: [{ type: 'text', text: 'No short links found.' }] };
        }
        const lines = result.map(link =>
          `${link.shortlink} -> ${link.longlink} (hits: ${link.hits})${link.notes ? ' - ' + link.notes : ''}`
        );
        return {
          content: [{ type: 'text', text: `Found ${result.length} short link(s):\n\n${lines.join('\n')}` }]
        };
      }

      return {
        content: [{ type: 'text', text: `Failed to list URLs: ${result.reason || 'Unknown error'}` }],
        isError: true
      };
    }
  );

  // Tool: Get Version
  server.registerTool(
    'get_version',
    {
      description: 'Get the version of the Chhoto URL server.',
      inputSchema: z.object({})
    },
    async () => {
      const result = await chhotoApi('/api/version');
      const version = typeof result === 'object' ? (result.reason || result.version || JSON.stringify(result)) : String(result);
      return {
        content: [{ type: 'text', text: `Chhoto URL server version: ${version}` }]
      };
    }
  );

  // Tool: Get Config
  server.registerTool(
    'get_config',
    {
      description: 'Get the backend configuration of the Chhoto URL instance.',
      inputSchema: z.object({})
    },
    async () => {
      const result = await chhotoApi('/api/getconfig');
      if (result.success) {
        return {
          content: [{
            type: 'text',
            text: `Chhoto URL Configuration:\nVersion: ${result.version}\nSite URL: ${result.site_url}\nPublic Mode: ${result.public_mode}\nSlug Style: ${result.slug_style}\nSlug Length: ${result.slug_length}\nAllow Capital Letters: ${result.allow_capital_letters}`
          }]
        };
      }
      return {
        content: [{ type: 'text', text: `Failed to get config: ${result.reason}` }],
        isError: true
      };
    }
  );

  // Tool: Whoami
  server.registerTool(
    'whoami',
    {
      description: 'Check the current authentication role (admin, public, etc.).',
      inputSchema: z.object({})
    },
    async () => {
      const result = await chhotoApi('/api/whoami');
      const role = typeof result === 'object' ? (result.role || result.reason || JSON.stringify(result)) : String(result);
      return {
        content: [{ type: 'text', text: `Current role: ${role}` }]
      };
    }
  );

  return server;
}

if (TRANSPORT === 'streamable-http') {
  const handler = createMcpHandler(() => createServer());
  const nodeHandler = toNodeHandler(handler);
  const server = http.createServer((req, res) => {
    void nodeHandler(req, res);
  });
  server.listen(BIND_PORT, BIND_HOST, () => {
    console.error(`Chhoto MCP server running on http://${BIND_HOST}:${BIND_PORT}`);
  });
} else {
  serveStdio(createServer);
  console.error('Chhoto MCP server running on stdio');
}
