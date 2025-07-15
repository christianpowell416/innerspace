**Product Requirements Document (PRD)**

---

**Product Name:** Empart

---

### 1. Overview

**Purpose:**
Empart is an AI-powered mobile therapy app that helps users explore and reflect on their emotions. The app features a symbolic 3D graph and a structured emotional journal. Users rate their emotions using three symbolic axes:

* Masculine ↔ Feminine
* Light ↔ Dark
* Child ↔ Parent

**Goals:**

* Provide a calming, introspective digital space for emotional exploration.
* Help users identify and reflect on emotional patterns.
* Visualize emotions as dynamic vectors in a 3D space.
* Use AI guidance grounded in Internal Family Systems (IFS) and Jungian psychology.

---

### 2. Features

#### 2.1 Emotion Rating Flow

* Users log emotions manually or through a conversation with an AI therapy agent.
* Users can toggle between manual and AI-assisted input.
* Each emotion is rated from **-3 to 3** across the following axes:

  * Masculine (-3) to Feminine (3)
  * Light (-3) to Dark (3)
  * Child (-3) to Parent (3)
* Users choose an emotion from a **preset list** (e.g., Joy, Fear, Shame, etc.) or create their own.
* Optional: Add a short note or journal entry.

#### 2.2 Emotion Sphere (Graph Page)

* A transparent 3D sphere with three labeled axes:

  * Masculine ↔ Feminine
  * Light ↔ Dark
  * Child ↔ Parent
* Emotions appear as **vectors** starting from the center and extending outward.
* Vectors are **color-coded** based on the Consciousness Scale reference image.
* Hover or tap to view emotion names and metadata.
* Fully interactive (rotate, zoom, pan).
* Designed with a meditative, dark-themed aesthetic.

#### 2.3 Emotion List (List Page)

* Scrollable list of logged emotions.
* Each entry includes:

  * Emotion name
  * 3D vector axis scores
  * Optional journal entry
  * Summary of conversation with AI agent
* Filter and sort by date, emotion type, or dominant axis.

#### 2.4 Navigation

* Bottom navigation bar with three tabs:

  * Emotion Sphere
  * Add emotion
  * Profile
* Tapping on a vector opens associated emotion details.

---

### 3. Design Requirements

* Dark mode UI only.
* Clean typography for low-light legibility.
* Graph and list should feel intuitive, responsive, and emotionally resonant.
* Vector colors correspond to emotional states using the Consciousness Scale (e.g., Joy = yellow, Shame = red).

---

### 4. Technical Requirements

**Tech Stack:**

* **Cursor** – IDE for collaborative development.
* **Claude Code** – AI for code scaffolding and iteration.
* **Expo** – Framework for cross-platform mobile development.
* **Supabase** – Backend (auth, database, API).
* **Stripe** – Payment processing.
* **ChatGPT or Claude AI** – Agent trained in IFS and Jungian frameworks.

**System Behavior:**

* Cross-platform responsiveness.
* Fast state updates when interacting with the graph.
* Secure journal and emotion data storage.

---

### 5. Future Features

* Visualize emotion history over time.
* Voice input and journaling.
* Push notifications for daily mood tracking.
* AI-generated insights based on emotional trends.

---

### 6. Open Questions

* Should users be allowed to remap emotion colors?
* How should custom emotions be mapped to color/scale?
* What privacy protections are required for stored emotional content?

---

### 7. Attachments

* Consciousness Scale Emotion Diagram (used for vector color mapping)

---
