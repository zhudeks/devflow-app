import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const packageName = 'com.devflow.client';
const apiBase = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const storageApiBase = 'https://storage.googleapis.com/storage/v1';
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

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }

  row.push(cell);
  if (row.some(value => value.trim())) rows.push(row);
  if (!rows.length) return [];

  const headers = rows.shift().map(header => header.replace(/^\uFEFF/, '').trim());
  return rows.map(values => Object.fromEntries(
    headers.map((header, index) => [header, (values[index] ?? '').trim()]),
  ));
}

function lastReportValue(rows, column, validate) {
  const value = rows.slice().reverse().find(row => validate(row[column] ?? ''))?.[column];
  if (value === undefined) throw new Error(`Play report has no valid "${column}" value.`);
  return value;
}

export function buildPlayStoreMetrics({ ratingsCsv, installsCsv, reviewCsvs, reportsThrough }) {
  const ratingRows = parseCsv(ratingsCsv);
  const installRows = parseCsv(installsCsv);
  const reviewReports = reviewCsvs.map(parseCsv);

  const averageRating = Number(lastReportValue(
    ratingRows,
    'Total Average Rating',
    value => value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 5,
  ));
  const currentInstalls = Number(lastReportValue(
    installRows,
    'Current User Installs',
    value => /^\d+$/.test(value),
  ));
  const reviewCount = reviewReports.reduce((total, rows) => total + rows.filter(row => (
    (row['Star Rating'] ?? '').trim() !== ''
    && ((row['Review Title'] ?? '').trim() !== '' || (row['Review Text'] ?? '').trim() !== '')
  )).length, 0);

  if (!/^\d{6}$/.test(reportsThrough)) {
    throw new Error(`Invalid Play reports month "${reportsThrough}".`);
  }

  return { averageRating, reviewCount, currentInstalls, reportsThrough };
}

export function parsePublicPlayListing(html) {
  const heading = /<h2\b[^>]*>\s*What(?:’|&#39;|&#x27;|')s new\s*<\/h2>/i.exec(html);
  if (!heading) throw new Error('The public Google Play listing has no “What’s new” section.');

  const sectionEnd = html.indexOf('</section>', heading.index + heading[0].length);
  const section = html.slice(heading.index, sectionEnd === -1 ? undefined : sectionEnd);
  const description = /<div\b[^>]*\bitemprop=["']description["'][^>]*>([\s\S]*?)<\/div>/i.exec(section);
  if (!description) throw new Error('The public Google Play listing has no release-note text.');

  const text = description[1]
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, value) => {
      if (value.toLowerCase() === 'amp') return '&';
      if (value.toLowerCase() === 'lt') return '<';
      if (value.toLowerCase() === 'gt') return '>';
      if (value.toLowerCase() === 'quot') return '"';
      if (value.toLowerCase() === 'apos' || value === '#39' || value.toLowerCase() === '#x27') return "'";
      if (value.toLowerCase() === 'nbsp') return ' ';
      const codePoint = value[1].toLowerCase() === 'x'
        ? Number.parseInt(value.slice(2), 16)
        : Number.parseInt(value.slice(1), 10);
      return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : '';
    })
    .trim();

  if (!text) throw new Error('The public Google Play listing has empty release notes.');

  const updatedOn = /<div\b[^>]*>\s*Updated on\s*<\/div>\s*<div\b[^>]*>([^<]+)<\/div>/i.exec(html);
  const dateParts = updatedOn?.[1].trim().match(/^([A-Za-z]{3}) (\d{1,2}), (\d{4})$/);
  const parsedDate = dateParts ? Date.parse(`${dateParts[1]} ${dateParts[2]}, ${dateParts[3]} UTC`) : NaN;
  const lastUpdatedDate = Number.isNaN(parsedDate) ? null : new Date(parsedDate).toISOString().slice(0, 10);

  return {
    releaseNotes: { text, language: 'en-US' },
    lastUpdatedDate,
  };
}

function decodeCsv(buffer) {
  const bytes = new Uint8Array(buffer);
  const isUtf16 = (bytes[0] === 0xff && bytes[1] === 0xfe)
    || (bytes.length > 1 && bytes[1] === 0);
  return new TextDecoder(isUtf16 ? 'utf-16le' : 'utf-8').decode(bytes).replace(/^\uFEFF/, '');
}

async function fetchReport(token, bucket, objectName) {
  const url = `${storageApiBase}/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectName)}?alt=media`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Google Play report download failed (${response.status}): ${details}`);
  }
  return decodeCsv(await response.arrayBuffer());
}

async function listReports(token, bucket, prefix) {
  const objects = [];
  let pageToken;

  do {
    const url = new URL(`${storageApiBase}/b/${encodeURIComponent(bucket)}/o`);
    url.searchParams.set('prefix', prefix);
    url.searchParams.set('pageSize', '1000');
    url.searchParams.set('fields', 'items(name),nextPageToken');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const page = await apiRequest(url, token);
    objects.push(...(page.items ?? []).map(item => item.name));
    pageToken = page.nextPageToken;
  } while (pageToken);

  return objects;
}

function monthlyOverviewReports(objectNames, prefix) {
  const reports = new Map();
  for (const name of objectNames) {
    if (!name.startsWith(prefix)) continue;
    const match = name.match(/_(\d{6})(?:_overview)?\.csv$/);
    if (!match) continue;

    const month = match[1];
    const isOverview = name.endsWith('_overview.csv');
    const existing = reports.get(month);
    if (!existing || isOverview) reports.set(month, name);
  }
  return reports;
}

async function syncPlayStoreMetrics(token, bucket) {
  const ratingsPrefix = `stats/ratings/ratings_${packageName}_`;
  const installsPrefix = `stats/installs/installs_${packageName}_`;
  const reviewsPrefix = `reviews/reviews_${packageName}_`;
  const [ratingObjects, installObjects, reviewObjects] = await Promise.all([
    listReports(token, bucket, ratingsPrefix),
    listReports(token, bucket, installsPrefix),
    listReports(token, bucket, reviewsPrefix),
  ]);
  const ratingReports = monthlyOverviewReports(ratingObjects, ratingsPrefix);
  const installReports = monthlyOverviewReports(installObjects, installsPrefix);
  const commonMonths = [...ratingReports.keys()]
    .filter(month => installReports.has(month))
    .sort()
    .reverse();

  if (!commonMonths.length) {
    throw new Error('No matching monthly overview reports were found for ratings and installs.');
  }

  const reportsThrough = commonMonths[0];
  const reviewFiles = reviewObjects
    .filter(name => {
      const match = name.match(/_(\d{6})\.csv$/);
      return name.startsWith(reviewsPrefix) && match && match[1] <= reportsThrough;
    })
    .sort();
  const [ratingsCsv, installsCsv, ...reviewCsvs] = await Promise.all([
    fetchReport(token, bucket, ratingReports.get(reportsThrough)),
    fetchReport(token, bucket, installReports.get(reportsThrough)),
    ...reviewFiles.map(name => fetchReport(token, bucket, name)),
  ]);

  return buildPlayStoreMetrics({ ratingsCsv, installsCsv, reviewCsvs, reportsThrough });
}

async function readPublicListing() {
  try {
    const response = await fetch(
      `https://play.google.com/store/apps/details?id=${packageName}&hl=en_US`,
    );
    if (!response.ok) {
      throw new Error(`Public listing request failed with status ${response.status}`);
    }
    const listing = parsePublicPlayListing(await response.text());
    if (!listing.lastUpdatedDate) {
      console.warn('The public Google Play listing did not include a valid “Updated on” date.');
    }
    return listing;
  } catch (error) {
    console.warn(`Unable to read Google Play listing details: ${error.message}`);
    return null;
  }
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
  const listing = await readPublicListing();
  let playMetrics = current.playMetrics ?? null;

  if (process.env.PLAY_REPORTS_BUCKET) {
    try {
      playMetrics = await syncPlayStoreMetrics(token, process.env.PLAY_REPORTS_BUCKET);
    } catch (error) {
      console.warn(`Unable to refresh Google Play report metrics: ${error.message}`);
    }
  } else {
    console.warn('PLAY_REPORTS_BUCKET is not configured; keeping the last available Play report metrics.');
  }

  const next = {
    versionName,
    versionCode: release.latestVersionCode,
    releaseStatus: 'published',
    releaseNotes: listing?.releaseNotes.text ?? null,
    releaseNotesLanguage: listing?.releaseNotes.language ?? null,
    lastUpdatedDate: listing?.lastUpdatedDate ?? null,
    playMetrics,
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
