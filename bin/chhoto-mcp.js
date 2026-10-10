#!/usr/bin/env node
import('../dist/index.js').catch(err => {
  console.error('Failed to start chhoto-mcp:', err);
  process.exit(1);
});
