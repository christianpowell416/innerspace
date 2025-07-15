# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Expo React Native app called "Empart" built with:
- **Framework**: Expo 53 with React Native 0.79.5 and React 19
- **Navigation**: Expo Router with file-based routing and typed routes
- **Architecture**: Tab-based navigation with Stack navigator
- **Platform Support**: iOS, Android, and Web
- **TypeScript**: Strict mode enabled with path aliases (@/*)

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm start
# or
npx expo start

# Platform-specific development
npm run android    # Android emulator
npm run ios        # iOS simulator  
npm run web        # Web browser

# Code quality
npm run lint       # ESLint with Expo config

# Reset project (moves starter code to app-example/, creates blank app/)
npm run reset-project
```

## Project Structure

- **app/**: File-based routing directory using Expo Router
  - `_layout.tsx`: Root layout with theme provider and font loading
  - `(tabs)/`: Tab navigation group
    - `_layout.tsx`: Tab layout configuration with haptic feedback
    - `index.tsx`: Home tab
    - `explore.tsx`: Explore tab
  - `+not-found.tsx`: 404 page
- **components/**: Reusable UI components
  - `ui/`: Platform-specific UI components (IconSymbol, TabBarBackground)
  - Themed components (ThemedText, ThemedView)
  - Interactive components (HapticTab, Collapsible)
- **hooks/**: Custom React hooks for color scheme and theming
- **constants/**: App-wide constants (Colors)
- **assets/**: Images and fonts

## Key Architecture Patterns

1. **Theme System**: Automatic light/dark mode support using `@react-navigation/native` themes and custom `useColorScheme` hook
2. **Path Aliases**: Uses `@/*` imports pointing to root directory
3. **Platform-Specific Components**: Separate `.ios.tsx` files for iOS-specific implementations
4. **Haptic Feedback**: Custom HapticTab component for enhanced user experience
5. **Typed Routes**: Expo Router experimental typed routes enabled for type-safe navigation

## Empart Product Context

Empart is an AI-powered mobile therapy app focused on emotional exploration through:

1. **3D Emotion Visualization**: Transparent sphere with three symbolic axes:
   - Masculine (-3) ↔ Feminine (3)
   - Light (-3) ↔ Dark (3) 
   - Child (-3) ↔ Parent (3)

2. **Core Features**:
   - Emotion rating flow (manual or AI-assisted)
   - 3D vectors plotted in sphere, color-coded by consciousness scale
   - Emotion history list with filtering/sorting
   - AI therapy agent using IFS and Jungian psychology

3. **Tech Requirements**:
   - Dark mode UI only
   - Supabase backend (auth, database)
   - Stripe payments for premium features
   - Cross-platform responsiveness

4. **Current Development Phase**: MVP 1 - UI Skeleton
   - Navigation structure: "Emotion Sphere" and "Emotions List" tabs
   - 28 open GitHub issues prioritized by feature area

## Configuration Files

- **app.json**: Expo configuration with new architecture enabled, adaptive icons, and splash screen
- **tsconfig.json**: Extends Expo's base config with strict mode and path aliases
- **eslint.config.js**: Uses Expo's flat ESLint configuration