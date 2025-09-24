Product Requirements Document (PRD) – Inflection

1. Vision & Purpose

1a. Core Purpose

Inflection is an internal reflection app designed to help users map their internal parts based on Internal Family Systems (IFS) theory. It connects these parts to emotions and associated bodily sensations, providing users with customized healing practices and modalities.

1b. Problem Statement

Self-help often feels inaccessible and overwhelming, particularly for individuals who aren't ready or able to speak with another person. Existing apps focus either on connecting users with therapists or use rudimentary AI/UX. Inflection solves this by offering a deeply introspective, personalized, and AI-assisted self-help experience.

1c. Goals (6–12 Months)

Launch the MVP on iOS and Android

Deliver core functionality: AI conversations, emotion/parts/needs mapping, and body overlays

Generate >$10k/month in revenue, ideally >$30k/month

2. Target Audience

2a. Ideal Users

Broadly accessible — intended for the average person, regardless of background. The product is inclusive by design and suitable for anyone interested in emotional wellness.

2b. Use Context

Users engage with the app to process emotions, uncover internal needs, and reflect on their inner parts without external judgment.

2c. Competitive Landscape

No direct competitors. BetterHelp is a leading player in digital therapy, but Inflection differentiates through AI-guided introspection. Existing AI therapy apps are considered basic and underdeveloped.

3. Core Features & Functionality

3a. Must-Have Features (MVP)

1. AI-Guided Emotional Conversations

Users initiate text-based conversations with a Claude-powered AI agent.

The AI is trained on IFS, Jungian psychology, and other models to guide users through reflective inquiry.

Users may begin a conversation based on a single part, need, or emotion.

The AI helps the user identify related parts, underlying needs, emotional patterns, and potential protectors/exiles.

2. Automatic Internal Mapping (Flowchart Generator)

The AI dynamically generates a hierarchical flowchart that visually organizes parts (top layer), emotions (middle layer), and needs (core layer).

Each node includes editable attributes: name, description, sensations/memories/beliefs, and tags.

3. Interactive Zoomable Maps

Tapping a part reveals its emotions.

Tapping an emotion reveals underlying needs.

Smooth navigation between levels.

4. Body Mapping Overlay

Prompts users to identify physical locations for emotions.

Displays this data on a human body diagram.

Visualizes recurring emotion-body patterns.

5. Map Editing & History

AI-generated maps are user-editable.

Includes version history and change tracking.

Users can save and export map snapshots.

6. User Profile & State Tracking

Personal profile stores all maps, entries, and metadata.

Timeline view displays trends in emotion and part activity.

Journaling features included.

7. Onboarding & First Session Wizard

Walkthrough of app purpose and functionality.

Guided session for creating the first part/emotion/need.

Generates initial map and body overlay.

3b. Nice-to-Have Features

1. Customized Healing Modalities

AI suggests personalized practices (e.g., somatic work, journaling, breathwork).

2. Daily Check-In Reminders

Push notifications for reflection prompts or practices.

3. Integration with Wearables (Future)

Apple Health, Oura, or similar for physiological/emotional syncing.

3c. Out-of-Scope Features

Live therapist chats

User-to-user forums

3D emotion sphere (postponed)

Gamification features unrelated to introspection

4. User Journey

4a. First-Time Experience

Onboarding flow introduces core ideas.

First conversation with the AI about a part, need, or emotion.

Generates first interactive map.

4b. Daily Use Case

Users return to reflect on evolving emotional states.

Update or review maps, parts, or journals.

4c. Retention Complex

Increased depth and accuracy in maps leads to more trust and continued use.

5. Emotional Framework

5a. Theoretical Basis

Internal Family Systems (IFS)

Jungian Psychology

NUMMENMAA LAB – Human Emotion Systems Lab

Kelly’s Personal Construct Theory

5b. Data Model & Mapping Structure

Needs (innermost layer)

Emotions (middle layer)

Parts (outermost layer)

Tap to zoom into each nested structure.

Includes collective maps of all needs, emotions, or parts.

Visualized with bubble maps and body overlays.

5c. Coordinate System

3D mapping postponed

6. Data & Sync

6a. Data Storage

Supabase

6b. Synchronization

Supabase Realtime

6c. Data Privacy

Private by default

Optional anonymous sharing for model training

7. Platform & Tech

7a. Platforms

iOS and Android (Expo)

7b. Tech Stack

Expo, Supabase, Claude

7c. Integrations

Google Auth, Apple Auth, Stripe

8. Design & UX

8a. Visual Theme

Minimalist

Comforting

Modern

Natural

Dark palette

8b. Emotional Tone

Calm

Approachable

Advanced yet minimal

8c. Accessibility

No current considerations

9. Metrics for Success

9a. KPIs

TBD

9b. Product-Market Fit

App should appeal to average users, not just the self-help savvy

9c. User Behavior Signals

TBD

10. Constraints & Assumptions

10a. Constraints

Solo founder/developer

$200–500/month pre-launch budget

10b. Assumptions

Claude will generate all required code

10c. Risks

N/A at this time

