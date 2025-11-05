# Neonatal Bilirubin Risk Calculator

A lightweight React + Vite app to estimate neonatal hyperbilirubinemia risk using the Bhutani nomogram and AAP phototherapy/exchange transfusion thresholds. Supports gestational age and AAP neurotoxicity risk factors; falls back to Maisels thresholds for <35 weeks.

## Features

- Bhutani risk zone classification (up to 144 hours of life)
- AAP phototherapy and exchange transfusion thresholds (≥35 weeks)
- Maisels thresholds for <35 weeks
- Gestational age input (weeks + days) and risk factor toggle
- Copy-to-clipboard summary for charting/notes

## Getting Started

Prerequisite: Node.js (LTS recommended)

1. Install dependencies:
   - `npm install`
2. Start the dev server:
   - `npm run dev`
3. Open the app in your browser (default `http://localhost:3000`).

Build for production:

- `npm run build`
- `npm run preview` (optional local preview)

## Usage

- Enter Birth Date & Time and Measurement Date & Time in the format `yyyy/mm/dd - hh:mm` (24h). Use the Now button to auto-fill measurement time.
- Provide TcB value (mg/dL), gestational age, and toggle AAP neurotoxicity risk factors as applicable.
- Click Calculate to view Bhutani zone, thresholds, and status. Use the copy button to copy a concise summary.

## Tech Stack

- React, TypeScript, Vite
- Tailwind CSS
- No backend dependencies

## Notes

- Dates are normalized for reliable parsing; ensure birth precedes measurement.
- Bhutani zones are not applied beyond 144 hours of life.
