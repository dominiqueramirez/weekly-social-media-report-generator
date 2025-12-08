# Weekly Social Media Report Generator

A single-page React application that processes Hootsuite Analytics export files (zip format) and generates formatted weekly social media performance reports for the @SecVetAffairs X/Twitter account.

## Features

- **Drag-and-drop file upload** - Upload zip files containing Hootsuite CSV exports
- **Automatic CSV identification** - Automatically identifies tweets and metrics CSV files
- **Report generation** - Creates formatted weekly reports with top performing posts
- **Copy to clipboard** - Copies report with formatting preserved

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Run the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Building for Production

Build the app:
```bash
npm run build
```

The build output will be in the `dist` folder.

### Deploying to GitHub Pages

1. Update the `homepage` field in `package.json` to match your GitHub Pages URL:
   ```json
   "homepage": "https://yourusername.github.io/your-repo-name"
   ```

2. Update `vite.config.js` base path if deploying to a subdirectory:
   ```js
   base: '/your-repo-name/',
   ```

3. Deploy:
   ```bash
   npm run deploy
   ```

## Usage

1. Export your analytics data from Hootsuite as a zip file containing:
   - **Tweets CSV** - Contains columns: Tweet Text, Tweet Permalink, Engagements, Retweets, Impressions, Likes
   - **Account Metrics CSV** - Contains daily metrics for followers, mentions, impressions

2. Upload the zip file using drag-and-drop or click to browse

3. Click "Generate Report" to create the weekly summary

4. Click "Copy to Clipboard" to copy the formatted report

## Tech Stack

- React 18
- Vite
- Tailwind CSS
- JSZip (loaded from CDN)
- Lucide React Icons
