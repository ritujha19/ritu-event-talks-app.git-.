# BigQuery Release Notes Explorer & X/Twitter Share Portal

A premium, glassmorphic single-page web application built with **plain vanilla HTML, CSS, and JavaScript** designed to fetch, filter, and explore official Google Cloud BigQuery release notes and instantly share individual updates to X (Twitter).

## 🌟 Key Features

*   **Granular Update Extraction**: Automatically parses day-long feed entries and splits them into distinct cards (e.g. splitting a single day's notes into individual Feature, Change, or Bug Fix updates) for precise readability.
*   **Robust CORS & Network Bypass**: Orchestrates a 4-tier fetch system that checks:
    1. Direct Atom feed URL
    2. CORS-proxy 1 (`corsproxy.io`)
    3. CORS-proxy 2 (`allorigins.win`)
    4. Local cached backup (`backup-feed.xml`) in case of offline usage
*   **High-Contrast Search & Categories**: Live filter tabs organize notes by type. Includes a real-time keyword search engine that safely highlights matching terms inside HTML nodes without breaking tags.
*   **Interactive Twitter Composer**: Pre-populates a custom post card modal that validates lengths using X's short-link calculation guidelines (links count as 23 characters), provides one-tap hashtag injectors, and links directly to Twitter's web intent platform.

## 🛠️ Built With

*   **Core**: HTML5, Vanilla ES6+ JavaScript, Custom CSS Variables
*   **Fonts**: [Outfit](https://fonts.google.com/specimen/Outfit) (Headers) & [Inter](https://fonts.google.com/specimen/Inter) (Body)
*   **Icons**: [FontAwesome 6.4.0 Free CDN](https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css)

## 🚀 Getting Started

### 1. Requirements
You only need **Node.js** (for running the local development server).

### 2. Run Locally
Clone or open the directory in your terminal and run:
```bash
# Start the local development web server
npm run dev
```

The application will launch on **[http://127.0.0.1:8080](http://127.0.0.1:8080)**.

Alternatively, since it is a static website, you can simply open the `index.html` file in any modern web browser.

## 📁 Project Structure

```text
├── index.html          # Shell layout & interactive modal markup
├── style.css           # Premium cyber dark-mode design system & animations
├── app.js              # State manager, RSS parser, & Twitter intent encoder
├── backup-feed.xml     # Offline feed cache
├── package.json        # NPM startup command configuration
└── .gitignore          # Repository blocklist settings
```

## 📝 License
This project is open-source and free to distribute.
