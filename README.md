# DevFlow - Azure DevOps Client for Android

One-page marketing website for DevFlow - the full-featured native Android client for Azure DevOps.

## Live Site

https://zhudeks.github.io/devflow-app

## Structure

```
 devflow-app/
 +-  index.html       <- full one-page site (HTML + Tailwind CDN + vanilla JS)
 +-  assets/
 |   +-  logo.png                <- app logo (512x512)
 |   +-  screenshots/
 |       +-  work-items.png
 |       +-  work-item-detail.png
 |       +-  kanban.png
 |       +-  pipeline.png
 |       +-  repo-diff.png
 |       +-  burndown.png
 |       +-  pull-request.png
 |       +-  test-cases.png
 +-  README.md
-  sitemap.xml      <- canonical page URL for search engines
+-  plan.md
```

## Page Sections

1. Sticky Navbar (logo + links + CTA)
2. Hero (headline, screenshot, Play badge)
3. Stats Bar (40+ screens, 20+ API areas, Android 7+)
4. Feature Highlights (6 cards)
5. Full Feature Accordion (8 categories)
6. Screenshots Carousel (8 real app screenshots)
7. Security Section (OAuth 2.0, PAT, Play Integrity)
8. Tech Stack Strip
9. Pricing (Free vs Premium — $3.99/month or $29.99/year)
10. Download CTA
11. Footer (Privacy Policy, Google Play, GitHub, Contact)

## GitHub Pages Setup

1. Go to repo Settings -> Pages
2. Source: main branch, folder /
3. Site live at https://zhudeks.github.io/devflow-app

## Search indexing

After deployment, verify the site in Google Search Console and submit
`https://zhudeks.github.io/devflow-app/sitemap.xml`. GitHub Pages project sites
live under a path, so a `robots.txt` in this repository would not be served at
the hostname root where search engines look for it.

## Automatic Google Play version

The site displays the latest published production version from
`app-version.json`. The `Sync Google Play version` GitHub Actions workflow
checks the production track daily and can also be started manually from the
Actions tab. When the version changes, the workflow commits the updated JSON
file to `main`, which updates the GitHub Pages site.

To configure it:

1. Enable the Google Play Android Developer API in a Google Cloud project.
   Also enable the IAM Service Account Credentials API.
2. Create a service account and add it as a user in Play Console with
   **View app information (read-only)** access to this app.
3. In Google Cloud IAM, grant that service account the
   **Service Account Token Creator** role (`roles/iam.serviceAccountTokenCreator`)
   on itself. The auth workflow needs this to mint its short-lived API token.
4. Create a service account JSON key and add its contents as the repository
   Actions secret `PLAY_SERVICE_ACCOUNT_JSON` under **Settings → Secrets and
   variables → Actions**. Never commit or share the key.
5. Ensure production release names include the version (for example,
   `v7.6.1 to master`). The workflow ignores releases that aren't published
   and fails rather than publishing an unrecognized version name.

The workflow reads “What’s new” and the **Updated on** date directly from the
public Google Play listing, so no additional Play Console permission is needed
for those details. If the listing is unavailable or its markup changes, it
logs a warning rather than showing stale release data.

### Google Play report metrics

The site can show the average rating, current user installs, and written review
count from Google Play's monthly reports. To enable them:

1. Give the service account **View app information (read-only)** access with
   **Global** scope in Play Console. This is broader than app-specific access
   and can expose reporting data for every app in the developer account.
2. Enable the Cloud Storage JSON API in the Google Cloud project.
3. In Play Console's **Download reports → Statistics**, copy the reporting
   bucket URI (`gs://pubsite_prod_rev_...`) and add only its bucket name as the
   repository Actions variable `PLAY_REPORTS_BUCKET`.

The workflow uses the `devstorage.read_only` OAuth scope and reads only this
app's rating, install, and review CSV reports. Reports are monthly and may be
delayed by several days. The displayed review count includes written reviews,
not every star-only rating; the install figure is current user installs, not
lifetime installs. The site labels the month through which the reports are
available. If the bucket or report access is unavailable, the workflow logs a
warning and retains the most recent successfully synced metrics.

### Website install attribution

Google Play links on the website include `utm_source=devflow_website` and a
placement-specific `utm_campaign` (for example `hero`, `faq`, or
`pricing_free`). In Play Console, use the store listing acquisition reports
and filter by UTM source or campaign to compare aggregate listing visits and
acquisitions. This does not measure every website button click and does not
add an analytics SDK or tracking cookie to the site.

## Tech

Plain HTML, Tailwind CSS CDN, Vanilla JS - No build step required.
