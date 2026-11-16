import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  buildPlayStoreMetrics,
  parseCsv,
  parsePublicPlayListing,
  syncPlayStoreVersion,
} from './sync-play-store-version.mjs';

test('parseCsv handles quoted commas, escaped quotes, and embedded newlines', () => {
  assert.deepEqual(parseCsv(
    'Title,Review Text\r\n"Nice, app","Works ""great""\non mobile"\r\n',
  ), [
    { Title: 'Nice, app', 'Review Text': 'Works "great"\non mobile' },
  ]);
});

test('buildPlayStoreMetrics uses the latest valid averages and counts written reviews', () => {
  const metrics = buildPlayStoreMetrics({
    ratingsCsv: 'Date,Total Average Rating\n2026-10-30,4.7\n2026-10-31,\n',
    installsCsv: 'Date,Current User Installs\n2026-10-30,1234\n2026-10-31,1250\n',
    reviewCsvs: [
      'Star Rating,Review Title,Review Text\n5,Great,Easy to use\n4,,Could be faster\n5,,\n',
      'Star Rating,Review Title,Review Text\n3,Good,\n',
    ],
    reportsThrough: '202610',
  });

  assert.deepEqual(metrics, {
    averageRating: 4.7,
    reviewCount: 3,
    currentInstalls: 1250,
    reportsThrough: '202610',
  });
});

test('buildPlayStoreMetrics rejects invalid Play report values', () => {
  assert.throws(() => buildPlayStoreMetrics({
    ratingsCsv: 'Date,Total Average Rating\n2026-10-31,6.1\n',
    installsCsv: 'Date,Current User Installs\n2026-10-31,1250\n',
    reviewCsvs: [],
    reportsThrough: '202610',
  }), /Total Average Rating/);
});

test('parsePublicPlayListing extracts release notes and the listing update date', () => {
  assert.deepEqual(parsePublicPlayListing(
    '<section><h2>What’s new</h2><div itemprop="description">New &amp; improved<br>• It&#39;s faster</div></section><div>Updated on</div><div>Nov 16, 2026</div>',
  ), {
    releaseNotes: { text: 'New & improved\n• It\'s faster', language: 'en-US' },
    lastUpdatedDate: '2026-11-16',
  });
});

test('syncPlayStoreVersion updates the release notes and preserves cached metrics', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'devflow-play-sync-'));
  const outputFile = path.join(directory, 'app-version.json');
  const originalFetch = globalThis.fetch;
  const originalBucket = process.env.PLAY_REPORTS_BUCKET;
  const requests = [];

  await writeFile(outputFile, JSON.stringify({
    versionName: '7.6.1',
    versionCode: '68',
    releaseStatus: 'published',
    playMetrics: {
      averageRating: 4.5,
      reviewCount: 12,
      currentInstalls: 250,
      reportsThrough: '202609',
    },
  }));
  delete process.env.PLAY_REPORTS_BUCKET;
  globalThis.fetch = async (url, options = {}) => {
    const requestUrl = String(url);
    requests.push({ url: requestUrl, method: options.method ?? 'GET' });

    if (requestUrl.startsWith('https://play.google.com/')) {
      return new Response(
        '<section><h2>What’s new</h2><div itemprop="description">New features</div></section><div>Updated on</div><div>Nov 16, 2026</div>',
        { status: 200 },
      );
    }
    if (requestUrl.endsWith('/tracks/production/releases')) {
      return Response.json({
        releases: [{
          releaseLifecycleState: 'RELEASE_LIFECYCLE_STATE_PUBLISHED',
          releaseName: 'v7.7.0 to master',
          activeArtifacts: [{ versionCode: '69' }],
        }],
      });
    }
    throw new Error(`Unexpected request: ${requestUrl}`);
  };

  try {
    await syncPlayStoreVersion({ token: 'test-token', outputFile });
    const result = JSON.parse(await readFile(outputFile, 'utf8'));

    assert.equal(result.versionName, '7.7.0');
    assert.equal(result.versionCode, '69');
    assert.equal(result.releaseNotes, 'New features');
    assert.equal(result.releaseNotesLanguage, 'en-US');
    assert.equal(result.lastUpdatedDate, '2026-11-16');
    assert.deepEqual(result.playMetrics, {
      averageRating: 4.5,
      reviewCount: 12,
      currentInstalls: 250,
      reportsThrough: '202609',
    });
    assert.ok(requests.some(request => request.url.startsWith('https://play.google.com/')));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBucket === undefined) delete process.env.PLAY_REPORTS_BUCKET;
    else process.env.PLAY_REPORTS_BUCKET = originalBucket;
    await rm(directory, { recursive: true, force: true });
  }
});

test('syncPlayStoreVersion imports monthly Play reports from the reporting bucket', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'devflow-play-reports-'));
  const outputFile = path.join(directory, 'app-version.json');
  const originalFetch = globalThis.fetch;
  const originalBucket = process.env.PLAY_REPORTS_BUCKET;
  const csvFiles = new Map([
    ['stats/ratings/ratings_com.devflow.client_202610_overview.csv',
      'Date,Total Average Rating\n2026-10-31,4.6\n'],
    ['stats/installs/installs_com.devflow.client_202610_overview.csv',
      'Date,Current User Installs\n2026-10-31,350\n'],
    ['reviews/reviews_com.devflow.client_202610.csv',
      'Star Rating,Review Title,Review Text\n5,Great,Very useful\n'],
  ]);
  const prefixes = {
    'stats/ratings/ratings_com.devflow.client_': [
      'stats/ratings/ratings_com.devflow.client_202610_overview.csv',
    ],
    'stats/installs/installs_com.devflow.client_': [
      'stats/installs/installs_com.devflow.client_202610_overview.csv',
    ],
    'reviews/reviews_com.devflow.client_': [
      'reviews/reviews_com.devflow.client_202610.csv',
    ],
  };

  await writeFile(outputFile, JSON.stringify({
    versionName: '7.7.0',
    versionCode: '69',
    releaseStatus: 'published',
  }));
  process.env.PLAY_REPORTS_BUCKET = 'test-report-bucket';
  globalThis.fetch = async (url, options = {}) => {
    const requestUrl = new URL(String(url));
    if (requestUrl.hostname === 'play.google.com') {
      return new Response(
        '<section><h2>What’s new</h2><div itemprop="description">New features</div></section><div>Updated on</div><div>Nov 16, 2026</div>',
        { status: 200 },
      );
    }
    if (requestUrl.hostname === 'androidpublisher.googleapis.com') {
      if (requestUrl.pathname.endsWith('/tracks/production/releases')) {
        return Response.json({
          releases: [{
            releaseLifecycleState: 'RELEASE_LIFECYCLE_STATE_PUBLISHED',
            releaseName: 'v7.7.0 to master',
            activeArtifacts: [{ versionCode: '69' }],
          }],
        });
      }
    }

    if (requestUrl.hostname === 'storage.googleapis.com') {
      if (requestUrl.searchParams.has('prefix')) {
        const prefix = requestUrl.searchParams.get('prefix');
        return Response.json({ items: (prefixes[prefix] ?? []).map(name => ({ name })) });
      }

      const objectName = decodeURIComponent(requestUrl.pathname.split('/o/')[1] ?? '');
      const csv = csvFiles.get(objectName);
      if (csv) {
        const bytes = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(csv, 'utf16le')]);
        return new Response(bytes);
      }
    }
    throw new Error(`Unexpected request: ${requestUrl} (${options.method ?? 'GET'})`);
  };

  try {
    await syncPlayStoreVersion({ token: 'test-token', outputFile });
    const result = JSON.parse(await readFile(outputFile, 'utf8'));

    assert.deepEqual(result.playMetrics, {
      averageRating: 4.6,
      reviewCount: 1,
      currentInstalls: 350,
      reportsThrough: '202610',
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBucket === undefined) delete process.env.PLAY_REPORTS_BUCKET;
    else process.env.PLAY_REPORTS_BUCKET = originalBucket;
    await rm(directory, { recursive: true, force: true });
  }
});
