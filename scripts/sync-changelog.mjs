import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function compareVersions(left, right) {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function isValidDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isExcludedSection(title) {
  return /\b(?:technical|internal|implementation notes?|developer notes?|architecture|certificate pinning)\b/i
    .test(title);
}

function stripMarkdown(value) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/[`*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function filterTechnicalDetails(content) {
  const lines = [];
  let codeBlock = false;
  let skippedBulletIndent = null;

  for (const line of content) {
    if (line.trim().startsWith('```')) {
      codeBlock = !codeBlock;
      continue;
    }
    if (codeBlock) continue;

    const bullet = line.match(/^(\s*)[-*+]\s+(.*)$/);
    if (skippedBulletIndent !== null) {
      if (!line.trim()) continue;
      const indentation = line.match(/^\s*/)[0].length;
      if (indentation > skippedBulletIndent) continue;
      skippedBulletIndent = null;
    }

    if (bullet) {
      const indentation = bullet[1].replace(/\t/g, '  ').length;
      if (/\b(?:versionCode|versionName|endpoint|Retrofit|ViewModel|Gradle|Room DB|coroutines|ADO_API_STATUS|API Repository Pattern)\b|`[^`]+\.(?:kt|java|xml|gradle|md)`|\b(?:GET|POST|PATCH|DELETE)\s+(?:endpoint|route)\b/i
        .test(bullet[2])) {
        skippedBulletIndent = indentation;
        continue;
      }
      if (/\bFeature \d+:.*\bfull implementation\b/i.test(bullet[2])) continue;
    }
    lines.push(line);
  }

  return lines;
}

function finalizeSection(release, section) {
  if (!section) return;
  const lines = filterTechnicalDetails(section.lines).join('\n').trim();
  if (lines && lines.split(/\r?\n/).some(line => line.trim() && !/^#{3,6}\s/.test(line))) {
    release.sections.push({ title: section.title, content: lines });
  }
}

function finalizeRelease(releases, release, section) {
  if (!release) return;
  finalizeSection(release, section);
  release.highlights = release.sections
    .flatMap(item => item.content.split(/\r?\n/))
    .filter(line => /^\s*[-*+]\s+/.test(line))
    .map(line => stripMarkdown(line.replace(/^\s*[-*+]\s+/, '')))
    .filter(Boolean)
    .slice(0, 3);
  if (release.sections.length) releases.push(release);
}

export function parseChangelog(markdown, publishedVersion) {
  if (!/^\d+(?:\.\d+){1,2}$/.test(publishedVersion)) {
    throw new Error(`Invalid published version: ${publishedVersion}`);
  }

  const releases = [];
  let release = null;
  let section = null;
  let skippedHeadingLevel = null;
  let sourceOrder = 0;

  for (const line of markdown.split(/\r?\n/)) {
    const releaseHeading = line.match(/^##\s+\[([^\]]+)\].*$/);
    if (releaseHeading) {
      finalizeRelease(releases, release, section);
      release = null;
      section = null;
      skippedHeadingLevel = null;

      const version = releaseHeading[1];
      if (/^\d+(?:\.\d+){1,2}$/.test(version)
        && compareVersions(version, publishedVersion) <= 0) {
        const date = line.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1];
        if (!date || !isValidDate(date)) {
          throw new Error(`Release ${version} has a missing or invalid date`);
        }
        release = { version, date, sections: [], sourceOrder: sourceOrder++ };
      }
      continue;
    }

    if (!release) continue;

    const sectionHeading = line.match(/^(#{3,4})\s+(.+?)\s*$/);
    if (sectionHeading) {
      const level = sectionHeading[1].length;
      const title = sectionHeading[2];

      if (level === 3) {
        finalizeSection(release, section);
        section = null;
        skippedHeadingLevel = isExcludedSection(title) ? 3 : null;
        if (!skippedHeadingLevel) section = { title, lines: [] };
      } else if (level === 4) {
        if (skippedHeadingLevel === 3) continue;
        skippedHeadingLevel = isExcludedSection(title) ? 4 : null;
        if (section && !skippedHeadingLevel) section.lines.push(line);
      } else if (!skippedHeadingLevel) {
        section?.lines.push(line);
      }
      continue;
    }

    if (!skippedHeadingLevel) section?.lines.push(line);
  }

  finalizeRelease(releases, release, section);

  if (!releases.some(item => item.version === publishedVersion)) {
    throw new Error(`Changelog does not contain published version ${publishedVersion}`);
  }

  return releases
    .sort((left, right) => right.date.localeCompare(left.date)
      || compareVersions(right.version, left.version)
      || left.sourceOrder - right.sourceOrder)
    .map(({ sourceOrder: _sourceOrder, ...item }) => item);
}

export async function syncChangelog({
  sourceFile,
  outputFile = path.join(rootDirectory, 'changelog-data.json'),
  versionFile = path.join(rootDirectory, 'app-version.json'),
}) {
  if (!sourceFile) throw new Error('Provide the app changelog path with --source');

  const [markdown, versionJson] = await Promise.all([
    readFile(sourceFile, 'utf8'),
    readFile(versionFile, 'utf8'),
  ]);
  const playVersion = JSON.parse(versionJson);
  if (playVersion.releaseStatus !== 'published') {
    throw new Error('The Google Play version is not marked as published');
  }

  const data = {
    publishedVersion: playVersion.versionName,
    releases: parseChangelog(markdown, playVersion.versionName),
  };
  await writeFile(outputFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return data;
}

function getArgument(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? null : process.argv[index + 1] ?? null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const data = await syncChangelog({
      sourceFile: getArgument('--source'),
      outputFile: getArgument('--output') ?? undefined,
      versionFile: getArgument('--version-file') ?? undefined,
    });
    console.log(`Generated ${data.releases.length} public releases through v${data.publishedVersion}.`);
  } catch (error) {
    console.error(`Unable to generate the public changelog: ${error.message}`);
    process.exitCode = 1;
  }
}
