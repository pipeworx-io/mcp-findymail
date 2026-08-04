# mcp-findymail

Findymail MCP — B2B email finder & reverse-email lookup (findymail.com)

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `findymail_find_email` | Find the work email for a person by name + company domain — give a person's full name and their company domain and get their verified business email (with job title and LinkedIn when available). B2B prospecting / outreach. Example: findymail_find_email({ name: "Patrick Collison", domain: "stripe.com", _apiKey: "your-findymail-key" }) |
| `findymail_reverse_email` | Look up the person/LinkedIn profile behind an email address — give an email and get the person's name, company, job title, and LinkedIn URL when available. Reverse-email enrichment. Example: findymail_reverse_email({ email: "patrick@stripe.com", _apiKey: "your-findymail-key" }) |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "findymail": {
      "url": "https://gateway.pipeworx.io/findymail/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Findymail data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
