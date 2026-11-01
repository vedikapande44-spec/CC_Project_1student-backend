require('dotenv').config();

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');

const server = new McpServer({
  name: 'github-mcp-server',
  version: '1.0.0'
});

// 1. Check GitHub connection
server.tool(
  'check_github_connection',
  'Check GitHub API connection',
  {},
  async () => {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json'
      }
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

// 2. List repositories
server.tool(
  'list_github_repositories',
  'List repositories of authenticated GitHub user',
  {},
  async () => {
    const response = await fetch(
      'https://api.github.com/user/repos?sort=updated&per_page=20',
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json'
        }
      }
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

// 3. Get repository details
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
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json'
        }
      }
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

// 4. Create an issue
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
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
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

async function main() {
  if (!process.env.GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN is missing from .env');
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(error => {
  console.error('GitHub MCP Server Error:', error.message);
  process.exit(1);
});