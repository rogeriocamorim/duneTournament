# 🏜️ Dune Imperium Bloodlines Tournament Manager

A beautiful, dramatic tournament management system for Dune Imperium Bloodlines board game competitions, featuring Swiss-style pairing with no-repeat matchups and Dune-themed animations.

![Dune Theme](https://img.shields.io/badge/Theme-Dune-orange)
![React](https://img.shields.io/badge/React-18-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind](https://img.shields.io/badge/Tailwind-4-cyan)

## ✨ Features

### Tournament Management
- **Swiss-Style Pairing**: Intelligent pairing algorithm that matches players with similar scores
- **No-Repeat Matchups**: Players never face the same opponent twice across 4 rounds
- **Automatic Scoring**: 5-3-2-1 point system with victory point tracking
- **Smart Tie-Breaking**: Multi-level tie-breaking (total points → victory points → 1st places)

### User Experience
- 🎬 **Dramatic Table Reveals**: Animated draft sequences with Dune quotes and effects
- 🎨 **Immersive Dune Theme**: Custom color palette inspired by the movies
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile
- 💾 **Auto-Save**: Tournament state automatically saved to browser
- 📤 **Export/Import**: Download and restore tournaments as JSON files

### Technical Features
- ⚡ Built with React 18 + TypeScript for type safety
- 🎭 Framer Motion animations for smooth transitions
- 🎨 Tailwind CSS with custom Dune design system
- 🔄 Context API for state management
- 💾 LocalStorage persistence

## 🚀 Quick Start

### Prerequisites
- Node.js 20 or higher
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/tournament.git
cd tournament/dune-tournament

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Building for Production

```bash
npm run build
```

## 📖 Usage Guide

### 1. Tournament Setup
- Enter a tournament name
- Add players (must be a multiple of 4, minimum 8 players)
- Valid counts: 8, 16, 20, 24, 28, 32, etc.
- Click "Begin Tournament" to start

### 2. Table Draft
- Watch the dramatic reveal of table assignments
- Dune quotes rotate with animated effects
- Skip animation option available
- Continue to start the round

### 3. Round Play
- View all table assignments
- Check current standings between rounds
- Record results when games complete

### 4. Results Entry
- Enter placement (1st-4th) for each player at each table
- Enter victory points for tie-breaking
- Validation ensures all placements are unique

### 5. Standings
- View current rankings after each round
- Automatic tie detection and marking
- Export standings at any time

### 6. Final Results
- Celebration screen with podium display
- Full rankings with all statistics
- Download complete results
- Start a new tournament

## 🎮 Tournament Rules

### Scoring
- **1st Place**: 5 points
- **2nd Place**: 3 points
- **3rd Place**: 2 points
- **4th Place**: 1 point

### Tie-Breaking (in order)
1. Total tournament points
2. Total victory points (from all rounds)
3. Number of 1st place finishes
4. Alphabetical order (if still tied)

### Pairing Algorithm
- **Round 1**: Random assignment
- **Rounds 2-4**: Swiss pairing by standings, avoiding previous opponents
- Uses backtracking to find valid pairings

## 🚢 Deployment

### GitHub Pages
The project is configured for automatic deployment to GitHub Pages.

1. Push to main branch
2. GitHub Actions will automatically build and deploy
3. Access at: `https://yourusername.github.io/tournament/`

### Manual Deployment
```bash
npm run deploy
```

## 🛠️ Development

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run deploy` - Deploy to GitHub Pages

## 📝 License

MIT License - feel free to use for your tournaments!

---

**"The spice must flow..."** - Run your tournaments with style! 🏜️
