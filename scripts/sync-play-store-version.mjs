import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const packageName = 'com.devflow.client';
const apiBase = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const versionFile = path.resolve('app-version.json');

export function selectLatestPublishedRelease(response) {
  const releases = (response.releases ?? [])
    .filter(release => release.releaseLifecycleState === 'RELEASE_LIFECYCLE_STATE_PUBLISHED')
    .map(release => ({
      ...release,
      latestVersionCode: (release.activeArtifacts ?? [])
        .map(artifact => String(artifact.versionCode))
        .sort((left, right) => {
          const a = BigInt(left);
          const b = BigInt(right);
          return a === b ? 0 : a > b ? -1 : 1;
        })[0],
    }))
    .filter(release => release.latestVersionCode);

  releases.sort((left, right) => {
    const a = BigInt(left.latestVersionCode);
    const b = BigInt(right.latestVersionCode);
    return a === b ? 0 : a > b ? -1 : 1;
  });

  if (!releases.length) {
    throw new Error('No published production release was found.');
  }

  return releases[0];
}

export function parseVersionName(releaseName) {
  const match = String(releaseName ?? '').match(/\bv?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/);
  if (!match) {
    throw new Error(`Production release name "${releaseName ?? ''}" does not include a version such as v7.6.1.`);
  }
  return match[1];
}

async function apiRequest(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Google Play API request failed (${response.status}): ${details}`);
  }

  if (response.status === 204) return {};
  return response.json();
}

export async function syncPlayStoreVersion({ token, outputFile = versionFile }) {
  if (!token) throw new Error('PLAY_API_ACCESS_TOKEN is required.');

  const track = await apiRequest(
    `${apiBase}/applications/${packageName}/tracks/production/releases`,
    token,
  );
  const release = selectLatestPublishedRelease(track);
  const versionName = parseVersionName(release.releaseName);
  const current = JSON.parse(await readFile(outputFile, 'utf8'));
  const next = {
    versionName,
    versionCode: release.latestVersionCode,
    releaseStatus: 'published',
  };

  if (JSON.stringify(current) !== JSON.stringify(next)) {
    await writeFile(outputFile, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    console.log(`Updated public site version to ${versionName} (code ${release.latestVersionCode}).`);
  } else {
    console.log(`Public site already shows the latest production version ${versionName}.`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  syncPlayStoreVersion({ token: process.env.PLAY_API_ACCESS_TOKEN }).catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
