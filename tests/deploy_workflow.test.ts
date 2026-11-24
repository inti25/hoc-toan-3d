import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function extractJobsSection(yaml: string): Record<string, string> {
  const jobsMatch = yaml.match(/^jobs:\r?\n([\s\S]*)$/m);
  assert.ok(jobsMatch, 'Workflow must define a jobs section');

  const lines = jobsMatch[1].split(/\r?\n/);
  const jobs: Record<string, string[]> = {};
  let currentJob: string | null = null;

  for (const line of lines) {
    const jobHeader = line.match(/^  ([a-zA-Z0-9_-]+):\s*$/);
    if (jobHeader) {
      currentJob = jobHeader[1];
      jobs[currentJob] = [];
      continue;
    }
    if (currentJob) {
      jobs[currentJob].push(line);
    }
  }

  return Object.fromEntries(
    Object.entries(jobs).map(([name, body]) => [name, body.join('\n')])
  );
}

test('GitHub Pages workflow separates build upload and deploy into distinct jobs to avoid artifact lookup race', () => {
  const workflowPath = path.join(process.cwd(), '.github/workflows/deploy.yml');
  assert.ok(fs.existsSync(workflowPath), 'Expected .github/workflows/deploy.yml to exist');

  const yaml = fs.readFileSync(workflowPath, 'utf8');
  const jobs = extractJobsSection(yaml);
  const jobNames = Object.keys(jobs);

  assert.ok(jobNames.includes('build'), 'Expected a "build" job');
  assert.ok(jobNames.includes('deploy'), 'Expected a separate "deploy" job');

  assert.match(jobs.build, /actions\/upload-pages-artifact@v\d+/, 'build job must upload pages artifact');
  assert.doesNotMatch(
    jobs.build,
    /actions\/deploy-pages@/,
    'build job must not run deploy-pages in the same job as upload-pages-artifact'
  );

  assert.match(jobs.deploy, /\bneeds:\s*build\b/, 'deploy job must wait for build job via needs: build');
  assert.match(jobs.deploy, /actions\/deploy-pages@v\d+/, 'deploy job must run actions/deploy-pages');
  assert.match(jobs.deploy, /environment:\s*[\s\S]*?name:\s*github-pages/, 'deploy job must target github-pages environment');

  assert.match(yaml, /pages:\s*write/, 'Workflow must grant pages: write permission');
  assert.match(yaml, /id-token:\s*write/, 'Workflow must grant id-token: write permission');
  assert.match(yaml, /concurrency:\s*[\s\S]*?group:\s*["']?pages["']?/, 'Workflow should serialize Pages deployments via concurrency group');
});
