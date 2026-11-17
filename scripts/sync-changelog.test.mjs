import assert from 'node:assert/strict';
import test from 'node:test';
import { parseChangelog } from './sync-changelog.mjs';

test('parseChangelog excludes unpublished versions and technical sections', () => {
  const releases = parseChangelog(`## [3.0.0] — 2026-03-20

### Added
- **Published feature** — Keeps the app up to date.

#### Certificate Pinning
- Internal connectivity implementation.

### Technical Details
- Internal implementation notes.

## [2.0.0] — 2026-03-10

### Fixed
- A user-facing fix.

## [4.0.0] — 2026-04-01

### Added
- A future release that is not public yet.
`, '3.0.0');

  assert.deepEqual(releases, [
    {
      version: '3.0.0',
      date: '2026-03-20',
      sections: [{
        title: 'Added',
        content: '- **Published feature** — Keeps the app up to date.',
      }],
      highlights: ['Published feature — Keeps the app up to date.'],
    },
    {
      version: '2.0.0',
      date: '2026-03-10',
      sections: [{ title: 'Fixed', content: '- A user-facing fix.' }],
      highlights: ['A user-facing fix.'],
    },
  ]);
});

test('parseChangelog removes implementation-only bullets but keeps user-facing details', () => {
  const [release] = parseChangelog(`## [1.0.0] — 2026-03-10

### Added
- **Feature 1: Projects Screen** — Full implementation:
  - Browse teams and see member counts.
  - Added \`ProjectsViewModel.kt\` and API endpoint coverage.
- **Load details** — Added GET endpoint for the project details API.
- **Browse projects** — See projects from the organization.
`, '1.0.0');

  assert.equal(release.sections[0].content,
    '- Browse teams and see member counts.\n'
    + '- **Browse projects** — See projects from the organization.');
  assert.deepEqual(release.highlights, [
    'Browse teams and see member counts.',
    'Browse projects — See projects from the organization.',
  ]);
});

test('parseChangelog keeps dated duplicate releases and sorts them newest first', () => {
  const releases = parseChangelog(`## [2.0.0] — 2026-03-15

### Added
- Later release entry.

## [2.0.0] — 2026-03-10

### Fixed
- Earlier release entry.
`, '2.0.0');

  assert.deepEqual(releases.map(({ version, date }) => ({ version, date })), [
    { version: '2.0.0', date: '2026-03-15' },
    { version: '2.0.0', date: '2026-03-10' },
  ]);
});

test('parseChangelog rejects a missing published release or invalid release date', () => {
  assert.throws(() => parseChangelog('## [1.0.0] — 2026-03-10\n\n### Added\n- Old\n', '2.0.0'),
    /does not contain published version 2\.0\.0/);
  assert.throws(() => parseChangelog('## [2.0.0] — 2026-02-30\n\n### Added\n- Invalid\n', '2.0.0'),
    /missing or invalid date/);
});
