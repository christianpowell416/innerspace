# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Refer to PRD.md

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
6. **Centralized AI Instructions**: ALL AI prompt instructions must be in `assets/flowchart/prompt_instructions.js` - never hardcode instructions elsewhere

## AI Instruction Management

**CRITICAL RULE**: All AI prompt instructions MUST be stored in `assets/flowchart/prompt_instructions.js`. This is the single source of truth for all AI interactions.

### Instructions Structure
The prompt file contains these sections:
- `## System Prompt` - Core AI behavior and role definition
- `## User Instructions` - How to interpret user requests
- `## Response Guidelines` - When and how to respond with JSON
- `## Voice Conversation Guidelines` - Voice-specific interaction rules
- `## Expected Output Format` - JSON structure examples
- `## Final Instructions` - Additional implementation details

### Enforcement Rules
1. **Never hardcode instructions** in TypeScript/JavaScript files
2. **All instruction changes** must be made in the centralized prompt file
3. **All AI services** (voice, text, generation) must read from this file
4. **No fallback instructions** should contain hardcoded prompt logic
5. **Function comments** about AI behavior should reference the prompt file

### Files That Use Centralized Instructions
- `lib/services/voiceFlowchartGenerator.ts` - Voice interactions
- `lib/services/aiFlowchartGenerator.ts` - Text-based generation
- `components/VoiceFlowchartCreator.tsx` - Voice UI interactions

## Configuration Files

- **app.json**: Expo configuration with new architecture enabled, adaptive icons, and splash screen
- **tsconfig.json**: Extends Expo's base config with strict mode and path aliases
- **eslint.config.js**: Uses Expo's flat ESLint configuration