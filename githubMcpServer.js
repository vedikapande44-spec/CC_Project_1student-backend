require('dotenv').config();

const express = require('express');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { z } = require('zod');

const app = express();
app.use(express.json());

const DEFAULT_OWNER = process.env.DEFAULT_GITHUB_OWNER || 'vedikapande44-spec';
const DEFAULT_REPO = process.env.DEFAULT_GITHUB_REPO || 'CC_Project_1student-backend';

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

function createMcpServer() {
  const server = new McpServer({
    name: 'github-mcp-server',
    version: '1.0.0'
  });

  server.tool(
    'check_github_connection',
    'Check GitHub API connection and get authenticated user information',
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
          text: `Connected to GitHub as ${user.login} (${user.html_url})`
        }]
      };
    }
  );

  server.tool(
    'list_github_repositories',
    'List repositories of the authenticated GitHub user',
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
              url: repo.html_url,
              description: repo.description
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
      owner: z.string().optional().describe(`Repository owner (default: ${DEFAULT_OWNER})`),
      repo: z.string().optional().describe(`Repository name (default: ${DEFAULT_REPO})`)
    },
    async ({ owner, repo }) => {
      const repoOwner = owner || DEFAULT_OWNER;
      const repoName = repo || DEFAULT_REPO;

      const response = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}`,
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
            full_name: data.full_name,
            description: data.description,
            default_branch: data.default_branch,
            stars: data.stargazers_count,
            open_issues_count: data.open_issues_count,
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
      owner: z.string().optional().describe(`Repository owner (default: ${DEFAULT_OWNER})`),
      repo: z.string().optional().describe(`Repository name (default: ${DEFAULT_REPO})`),
      title: z.string().min(1).describe('Issue title'),
      body: z.string().optional().describe('Issue description / body markdown')
    },
    async ({ owner, repo, title, body }) => {
      const repoOwner = owner || DEFAULT_OWNER;
      const repoName = repo || DEFAULT_REPO;

      const response = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}/issues`,
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
        const errorBody = await response.text();
        throw new Error(`GitHub API error (${response.status}): ${errorBody}`);
      }

      const issue = await response.json();

      return {
        content: [{
          type: 'text',
          text: `Issue #${issue.number} created successfully: ${issue.html_url}`
        }]
      };
    }
  );

  server.tool(
    'list_github_issues',
    'List recent issues for a GitHub repository',
    {
      owner: z.string().optional().describe(`Repository owner (default: ${DEFAULT_OWNER})`),
      repo: z.string().optional().describe(`Repository name (default: ${DEFAULT_REPO})`),
      state: z.enum(['open', 'closed', 'all']).optional().describe('Issue state (default: open)')
    },
    async ({ owner, repo, state = 'open' }) => {
      const repoOwner = owner || DEFAULT_OWNER;
      const repoName = repo || DEFAULT_REPO;

      const response = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}/issues?state=${state}&per_page=15`,
        { headers: githubHeaders() }
      );

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const issues = await response.json();

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(
            issues.map(iss => ({
              number: iss.number,
              title: iss.title,
              state: iss.state,
              user: iss.user?.login,
              url: iss.html_url,
              created_at: iss.created_at
            })),
            null,
            2
          )
        }]
      };
    }
  );

  server.tool(
    'close_github_issue',
    'Close an open issue in a GitHub repository',
    {
      issue_number: z.number().int().positive().describe('The issue number to close'),
      owner: z.string().optional().describe(`Repository owner (default: ${DEFAULT_OWNER})`),
      repo: z.string().optional().describe(`Repository name (default: ${DEFAULT_REPO})`),
      comment: z.string().optional().describe('Optional closing comment')
    },
    async ({ issue_number, owner, repo, comment }) => {
      const repoOwner = owner || DEFAULT_OWNER;
      const repoName = repo || DEFAULT_REPO;

      if (comment) {
        await fetch(
          `https://api.github.com/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}/issues/${issue_number}/comments`,
          {
            method: 'POST',
            headers: {
              ...githubHeaders(),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ body: comment })
          }
        );
      }

      const response = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}/issues/${issue_number}`,
        {
          method: 'PATCH',
          headers: {
            ...githubHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ state: 'closed' })
        }
      );

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const issue = await response.json();

      return {
        content: [{
          type: 'text',
          text: `Issue #${issue.number} marked as closed: ${issue.html_url}`
        }]
      };
    }
  );

  server.tool(
    'get_recent_commits',
    'Get recent commits from a GitHub repository',
    {
      owner: z.string().optional().describe(`Repository owner (default: ${DEFAULT_OWNER})`),
      repo: z.string().optional().describe(`Repository name (default: ${DEFAULT_REPO})`)
    },
    async ({ owner, repo }) => {
      const repoOwner = owner || DEFAULT_OWNER;
      const repoName = repo || DEFAULT_REPO;

      const response = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}/commits?per_page=5`,
        { headers: githubHeaders() }
      );

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const commits = await response.json();

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(
            commits.map(c => ({
              sha: c.sha.substring(0, 7),
              message: c.commit.message,
              author: c.commit.author.name,
              date: c.commit.author.date,
              url: c.html_url
            })),
            null,
            2
          )
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

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GitHub MCP Server running on port ${PORT}`);
  });
}

module.exports = { createMcpServer };
