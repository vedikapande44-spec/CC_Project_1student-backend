
require('dotenv').config();

const express = require('express');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { z } = require('zod');

const app = express();
app.use(express.json());

function createMcpServer() {
  const server = new McpServer({
    name: 'github-mcp-server',
    version: '1.0.0'
  });

  function githubHeaders() {
    if (!process.env.GITHUB_TOKEN) {
      throw new Error('GitHub token is missing');
    }

    return {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }

  server.tool(
    'check_github_connection',
    'Check GitHub API connection',
    {},
    async () => {
      const response = await fetch('https://api.github.com/user', {
        headers: githubHeaders()
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const user = await response.json();

      return {
        content: [{
          type: 'text',
          text: `Connected to GitHub as ${user.login}`
        }]
      };
    }
  );

  server.tool(
    'list_github_repositories',
    'List repositories of authenticated GitHub user',
    {},
    async () => {
      const response = await fetch(
        'https://api.github.com/user/repos?sort=updated&per_page=20',
        { headers: githubHeaders() }
      );

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const repos = await response.json();

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(
            repos.map(repo => ({
              name: repo.name,
              full_name: repo.full_name,
              private: repo.private,
              url: repo.html_url
            })),
            null,
            2
          )
        }]
      };
    }
  );

  server.tool(
    'get_repository_details',
    'Get details of a GitHub repository',
    {
      owner: z.string(),
      repo: z.string()
    },
    async ({ owner, repo }) => {
      const response = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
        { headers: githubHeaders() }
      );

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            name: data.name,
            description: data.description,
            default_branch: data.default_branch,
            stars: data.stargazers_count,
            url: data.html_url
          }, null, 2)
        }]
      };
    }
  );

  server.tool(
    'create_github_issue',
    'Create a new issue in a GitHub repository',
    {
      owner: z.string(),
      repo: z.string(),
      title: z.string().min(1),
      body: z.string().optional()
    },
    async ({ owner, repo, title, body }) => {
      const response = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
        {
          method: 'POST',
          headers: {
            ...githubHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ title, body })
        }
      );

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const issue = await response.json();

      return {
        content: [{
          type: 'text',
          text: `Issue created successfully: ${issue.html_url}`
        }]
      };
    }
  );

  return server;
}

app.post('/mcp', async (req, res) => {
  let transport;
  let server;

  try {
    server = createMcpServer();

    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('GitHub MCP request error:', error);

    if (!res.headersSent) {
      res.status(500).json({ error: 'GitHub MCP server error' });
    }
  } finally {
    if (transport) await transport.close();
    if (server) await server.close();
  }
});

app.get('/mcp', (req, res) => {
  res.status(405).send('Method not allowed');
});

app.delete('/mcp', (req, res) => {
  res.status(405).send('Method not allowed');
});

const PORT = process.env.PORT || 3003;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`GitHub MCP Server running on port ${PORT}`);
});
