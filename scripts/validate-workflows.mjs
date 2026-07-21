import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';

const workflowDirectory = path.resolve('.github/workflows');
const files = (await readdir(workflowDirectory)).filter((file) => /\.ya?ml$/i.test(file));
const expected = new Map([
  ['ci.yml', null],
  ['release-en.yml', 'en-v*'],
  ['release-zh-cn.yml', 'zh-cn-v*']
]);
const errors = [];

for (const [file, tagPattern] of expected) {
  if (!files.includes(file)) {
    errors.push(`Missing workflow ${file}`);
    continue;
  }
  let workflow;
  try {
    workflow = YAML.parse(await readFile(path.join(workflowDirectory, file), 'utf8'));
  } catch (error) {
    errors.push(`${file} is not valid YAML: ${error.message}`);
    continue;
  }
  if (!workflow.name || !workflow.on || !workflow.jobs) errors.push(`${file} is missing name, on, or jobs`);
  if (tagPattern) {
    const tags = workflow.on?.push?.tags ?? [];
    if (!tags.includes(tagPattern)) errors.push(`${file} must trigger on ${tagPattern}`);
    if (workflow.permissions?.contents !== 'write') errors.push(`${file} must grant only the required contents write permission`);
    if (!workflow.jobs.release) errors.push(`${file} is missing its release job`);
  } else if (workflow.permissions?.contents !== 'read') {
    errors.push(`${file} CI permissions must be read-only`);
  }
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}
console.log(`Validated ${expected.size} GitHub Actions workflow files.`);
