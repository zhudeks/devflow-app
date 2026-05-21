# DevFlow — One-Page Website Plan

> **Goal:** A modern, fast, single-page marketing website for DevFlow (Azure DevOps Android Client).
> **Play Store URL:** https://play.google.com/store/apps/details?id=com.devflow.client

---

## 0. Hosting Decision

| | Decision |
|--|--|
| **Hosting** | GitHub Pages (free) |
| **Repo type** | Separate dedicated repo (not inside the Android app repo) |
| **Repo name** | `devflow-app` |
| **Live URL** | `https://your-username.github.io/devflow-app` |
| **Custom domain** | None — free GitHub Pages subdomain |
| **Browser tab title** | `DevFlow — Azure DevOps Client for Android` |
| **Brand name** | `DevFlow` |

### GitHub Pages Setup Steps
1. Create new **public** GitHub repo named `devflow-app`
2. Push `index.html` + `assets/` to the `main` branch root
3. Go to repo **Settings → Pages → Source:** `main` branch, folder `/`
4. Site will be live at `https://your-username.github.io/devflow-app`

---

## 1. Design Direction

| Attribute      | Decision |
|----------------|----------|
| Style          | Dark-first, glassmorphism cards, subtle gradient background |
| Color palette  | Mirrors Aero Flux — teal `#0A7EA4`, amber `#B45309`, deep navy `#0F172A` background |
| Typography     | Inter (headings bold), Geist Mono (code/labels) |
| Feel           | Clean, developer-focused, no stock photo fluff |
| Animations     | Scroll-triggered fade-in + slide-up (Intersection Observer), subtle parallax on hero |
| Responsive     | Mobile-first, single breakpoint at 768 px |

---

## 2. Page Sections (top → bottom)

### 2.1 — Navbar (sticky)
- Logo: `</> DevFlow` wordmark in teal
- Links: Features · Screenshots · Download
- CTA button: **Get it on Google Play** (badge style)
- Transparent → blurred glass on scroll

---

### 2.2 — Hero Section
- **Headline:** `Your Azure DevOps. In your pocket.`
- **Sub-headline:** `DevFlow is the full-featured Android client for Azure DevOps — work items, pipelines, repos, test cases, wikis and more. All native. All offline-capable.`
- **CTA:** Google Play badge (official SVG) → links to Play Store
- **Visual:** Mockup of phone showing the Work Items dashboard (Aero Flux dark theme)
- **Badge row:** `Material 3` · `Jetpack Compose` · `OAuth 2.0` · `v7.0.0`

---

### 2.3 — Stats Bar (full-width stripe)
Three numbers that show scale:

| Stat | Value |
|------|-------|
| Feature screens | 40+ |
| ADO API areas covered | 20+ |
| Min Android version | Android 7.0+ |

---

### 2.4 — Feature Highlights (6 cards grid, 2×3 or 3×2)
Each card: icon + title + 2-line description.

| # | Icon | Title | Description |
|---|------|-------|-------------|
| 1 | 🗂️ | **Work Items** | View, edit, bulk-update, and search across all work items with advanced multi-filter search and saved filters. |
| 2 | 🔀 | **Pull Requests** | Browse PRs, create new ones with reviewer assignment, draft toggle, and live policy status badges. |
| 3 | ⚙️ | **Pipelines & CI/CD** | Monitor builds, queue new runs, inspect logs & artifacts, browse YAML pipelines and variable groups. |
| 4 | 📊 | **Analytics & Charts** | Burndown charts, Cumulative Flow Diagrams, Lead/Cycle Time, and pipeline pass-rate trends — all OData-driven. |
| 5 | 📁 | **Repositories** | Full file tree, syntax-highlighted file viewer, branch management, and side-by-side commit diff viewer. |
| 6 | 📋 | **Test Cases** | Browse test plans & suites, execute tests, attach screenshots to results, and export to CSV. |

---

### 2.5 — Full Feature List (expandable accordion or two-column list)
Grouped into categories. Collapsed by default, expand with "See all features" button.

**Categories:**
- Work Management (Work Items, Bulk Ops, Saved Filters, WIQL Queries, Backlog, Kanban, Delivery Plans, Sprints)
- Code & Repos (Repositories, Branch Management, Diff Viewer, Code Search)
- CI/CD (Pipelines, YAML Runner, Variable Groups, Service Connections, Environments, Agent Pools, Deployment Groups)
- Quality (Test Cases, Test Execution, Screenshot Attachments)
- Collaboration (Pull Requests, PR Policies, Wiki, Comments, Following, Notifications)
- Organization (Directory, Teams, Projects, Dashboards, Extensions, Permission Checker)
- Developer Tools (WIQL Queries, Field Explorer, Process Explorer, Profile, Settings)
- Security (OAuth 2.0 + PAT, Encrypted storage, Play Integrity API)

---

### 2.6 — Screenshots / App Showcase
- Horizontal scroll strip of phone mockups (5–7 screens)
- Suggested screens to show:
  1. Work Items list (dark theme)
  2. Work Item detail with comments
  3. Kanban board
  4. Pipeline detail
  5. Repo diff viewer
  6. Sprint burndown chart
  7. Pull Request creation
- Auto-scroll carousel on mobile, static grid on desktop

---

### 2.7 — Auth & Security Section
Two-column layout with icon list:

**"Enterprise-grade security"**
- 🔐 OAuth 2.0 via Microsoft Entra ID — no app registration needed
- 🔑 Personal Access Token (PAT) — stored in encrypted SharedPreferences
- 🛡️ Google Play Integrity API attestation
- 🔒 No data stored on third-party servers — direct ADO API only

---

### 2.8 — Tech Stack Strip (subtle, for developer credibility)
Horizontal logo/badge row:
`Kotlin` · `Jetpack Compose` · `Material 3` · `Hilt` · `Retrofit` · `Room` · `Coroutines` · `Paging 3`

---

### 2.9 — Download CTA (full-width section)
- **Headline:** `Ready to manage your DevOps on the go?`
- Large Google Play badge
- Smaller text: `Free · Android 7.0+ · v7.0.0`
- Background: teal-to-navy gradient

---

### 2.10 — Footer
- App name + tagline
- Links: Privacy Policy · Google Play · GitHub
- Copyright: `© 2026 DevFlow`

---

## 3. Technical Implementation Plan

### Stack: Plain HTML + Tailwind CSS + vanilla JS
✅ **Decided** — one file, zero build step, deploys to GitHub Pages instantly.

### File Structure (repo root)
```
devflow-app/                        ← GitHub repo root (separate repo)
├── index.html                      ← entire one-page site
├── assets/
│   ├── screenshots/                ← app screenshots (.webp)
│   ├── logo.svg                    ← DevFlow logo
│   └── google-play-badge.svg
└── README.md
```

---

## 4. SEO & Meta
```html
<title>DevFlow — Azure DevOps Client for Android</title>
<meta name="description" content="Full-featured native Android app for Azure DevOps. Work items, pipelines, repos, test cases, wikis and more. Free on Google Play.">
<meta property="og:image" content="assets/og-preview.png">  <!-- 1200×630 -->
```

**Keywords to target:** `azure devops android app`, `ado mobile client`, `devops android`, `azure devops app`

---

## 5. Build Order (implementation steps)

- [x] **Step 1** — Create GitHub repo `devflow-app` (public), enable GitHub Pages from `main` root
- [x] **Step 2** — Create `index.html` skeleton with Tailwind CDN + `assets/` folder
- [x] **Step 3** — Build Navbar + Hero section
- [x] **Step 4** — Stats bar + Feature cards grid
- [x] **Step 5** — Full feature accordion
- [x] **Step 6** — Screenshots carousel (7 real screenshots, gradient background, hover glow)
- [x] **Step 7** — Auth/Security + Tech stack sections
- [x] **Step 8** — Download CTA + Footer (Privacy Policy, Google Play, GitHub, Contact)
- [x] **Step 9** — Add real screenshots + logo (`assets/screenshots/`, `assets/logo.png`)
- [x] **Step 10** — Polish animations (scroll fade-in, hover lift, side fade gradients)
- [ ] **Step 11** — Test on mobile, optimize images to WebP
- [ ] **Step 12** — Push to `devflow-app` repo → verify live at `zhudeks.github.io/devflow-app`

### Additional completed (beyond original plan)
- [x] Pricing section — Free vs Premium ($3.99/month · $29.99/year · free trial)
- [x] SEO — canonical, OG tags, Twitter Card, JSON-LD SoftwareApplication schema
- [x] Contacts — email + GitHub in footer
- [x] Favicon

---

## 6. Assets Needed

- [x] App screenshots — 7 real screenshots added (`assets/screenshots/`)
- [x] DevFlow logo — `assets/logo.png` (512×512)
- [ ] OG preview image (1200×630 px) — currently using work-items.png as fallback
- [x] Google Play badge — inline SVG used directly in HTML
