# Project Orion

## Overview

**Project Orion** is a browser-based abstract 3D audio visualizer that transforms uploaded songs into luminous motion across a spatial node topology.

The goal is not to build a traditional bar-style equalizer. Orion should make music feel like it is moving through a living 3D map. Beats, bass, treble, loudness, and major energy changes should activate nodes, launch pulses, create trails, trigger bursts, and make the scene glow in a way that feels synchronized, spatial, and ethereal.

The first version is both a creative learning sandbox and a portfolio-oriented programming project. Long-term, Orion may evolve into an interactive music visualization app, a VJ/performance tool, or a gesture-controlled visual instrument. For now, the MVP should stay focused: upload a song, play it, analyze it in real time, and render a full 3D audio-reactive node field.

---

## Core Vision

Orion should feel like:

> A song coming to life visually through 3D space.

The visual experience should be dark, glassy, refractive, slightly neural, and spatial. The user should see visible nodes floating in a 3D environment. When the song plays, energy should shoot between nodes as luminous bolts or pulses, leaving trails and activating the surrounding topology.

The project should avoid looking like:

- a generic EDM visualizer
- bars moving up and down
- a cluttered technical graph
- a cheesy sci-fi HUD
- random particles with no structure
- excessive neon with no restraint

The visual language should lean toward:

- glass/light/refraction
- dark minimal atmosphere
- neural/constellation-like structure
- visible glowing nodes
- pulses, trails, bursts, branching, shimmer, glow, and node expansion

---

## MVP Goal

The MVP should allow a user to:

1. Open the browser app.
2. Upload an audio file.
3. Press play/pause.
4. See a 3D node map waiting in an idle state.
5. Watch the song activate the map in real time.
6. Drag the mouse to rotate/orbit the camera around the visualization.

A successful 20-second demo should show a song being selected, played, and then visually “shooting” through a 3D node field while the user rotates around the scene.

---

## In Scope for Version 1

Version 1 should include:

- Browser-based app
- Uploaded audio file input
- Play/pause controls
- Web Audio API integration
- `AudioContext`
- `AnalyserNode`
- Live frequency data extraction
- Basic audio feature extraction:
  - bass energy
  - mid energy
  - treble energy
  - loudness
  - beat/onset-like spikes
  - rough energy/section changes if feasible
- Full 3D scene
- Visible 3D nodes
- Faint aesthetic edges between nodes
- Beat-triggered pulses moving between nodes
- Fading trails
- Bursts on strong hits
- Bass-driven expansion/glow
- Treble-driven shimmer
- Loudness-driven global intensity
- Mouse camera rotation/orbit

---

## Out of Scope for Version 1

Do **not** build these in v1:

- Hand tracking
- Gesture control
- Shazam-like song recognition
- Spotify integration
- YouTube integration
- User accounts
- Video export
- Real ML embeddings
- True music similarity mapping
- Advanced BPM detection
- Accurate chorus/verse/bridge detection
- Database/backend services

These may be explored later, but they should not distract from the first working visualizer.

---

## Recommended Tech Stack

Preferred stack:

- **Vite**
- **React**
- **React Three Fiber**
- **Drei**
- **Three.js**
- **Web Audio API**

The project should be structured so that audio analysis, feature extraction, topology state, and rendering are separated cleanly.

