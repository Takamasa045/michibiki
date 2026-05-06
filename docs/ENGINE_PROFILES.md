# Engine Profiles

This document summarizes the practical strengths of Remotion, HyperFrames, and Editframe for Michibiki routing and agent responses. Use it with `engineFits`, `selectionGuide`, and the root agent rules.

Sources checked: 2026-05-04.

## Remotion

Use Remotion when the video benefits from React/TypeScript composition, frame-accurate coded motion, custom choreography, or programmatic variants.

Good uses:

- One-off high-polish motion graphics, not only reusable templates.
- Kinetic typography, animated callouts, spring/easing driven transitions, title sequences, and scene choreography.
- HTML-in-canvas DOM post-processing: draw live DOM nodes into canvas for blur, glitch, shader/WebGL/WebGPU-style effects, magnifier/vintage-screen treatments, and custom transition blending.
- React component reuse, typed props, API-driven content, data-driven variants, and batch rendering.
- Audio/captions, Lottie-style motion, Three.js / React Three Fiber flourishes, transitions, shapes, fonts, and cloud rendering.

Proposal angle:

- "Remotion can make this a frame-accurate animated promo with kinetic title reveals, staged detail callouts, custom transitions, depth/parallax, and optional props for future reuse."

Watch-outs:

- React/TypeScript and bundling add project structure.
- HTML-in-canvas is experimental. Studio preview needs Chrome Canary 149+ with `chrome://flags/#canvas-draw-element` enabled; renders are supported by Remotion v4.0.455+ through Remotion's bundled Canary path, and WebGL shader effects may need `--gl=angle` or `Config.setChromiumOpenGlRenderer("angle")`.
- Do not nest `<HtmlInCanvas>` inside another `<HtmlInCanvas>`; combine effects into one paint callback instead.
- Company/commercial use may need current Remotion license review.
- Existing web/LP DOM or GSAP-heavy work may still be faster to express in HyperFrames unless the request specifically needs React-controlled canvas post-processing or shader-style DOM effects.

Official references:

- https://www.remotion.dev/docs
- https://www.remotion.dev/docs/sequence
- https://www.remotion.dev/docs/animation-utils
- https://www.remotion.dev/docs/three
- https://www.remotion.dev/docs/transitions
- https://www.remotion.dev/docs/captions
- https://www.remotion.dev/docs/lottie
- https://www.remotion.dev/docs/html-in-canvas

## HyperFrames

Use HyperFrames when the source or desired expression is closest to a web page: HTML, CSS, JavaScript, LP sections, GSAP, Lottie, CSS animations, or existing DOM that should become video.

Good uses:

- Website/LP-to-video work where page structure, design tokens, typography, sections, and UI states should become motion.
- HTML-first agent workflows: plain HTML/CSS/JS with timing data attributes, no React rewrite, no custom DSL.
- GSAP, Lottie, CSS, Motion One, CodePen-style browser effects, and seekable animation runtimes.
- Deterministic frame-by-frame capture in headless Chrome and FFmpeg encoding.

Proposal angle:

- "HyperFrames can turn the page itself into a video: capture sections, convert them into timed panels, animate with GSAP/CSS/Lottie, and render deterministic frames from the browser."

Watch-outs:

- Less natural for React component reuse or strongly typed TSX motion systems.
- Current Michibiki adapter generates the HTML project itself, then renders through official HyperFrames CLI / producer / engine backends.
- Footage-heavy timelines, caption/audio editorial rhythm, and NLE-like workflows may fit Editframe better.

Official references:

- https://hyperframes.heygen.com/introduction
- https://hyperframes.heygen.com/guides/website-to-video
- https://hyperframes.heygen.com/guides/hyperframes-vs-remotion
- https://hyperframes.heygen.com/packages/engine
- https://hyperframes.heygen.com/guides/gsap-animation

## Editframe

Use Editframe when the video should be shaped as a timeline: paced scenes, captions, audio, waveform-informed edits, transitions, overlays, and media layers. This is not limited to existing footage.

Good uses:

- Timeline-first promos with scene sequencing, overlaps, crossfades, zooms, lower thirds, captions, and B-roll or generated visual layers.
- HTML web components or React compositions built from timegroups: sequence, fixed, and layered sections.
- Media-heavy composition with video, audio, images, text, captions, waveform, transitions, render API, and editor UI concepts.
- Text animation split by word, character, or line with stagger, easing, deterministic CSS variables, and custom animations.

Proposal angle:

- "Editframe can make this feel edited rather than just animated: build a beat-by-beat timeline, sync captions to narration/music, layer page captures or generated stills, and use transitions/overlays to create editorial rhythm."

Watch-outs:

- Current Michibiki adapter emits timeline handoff and local preview; full official SDK/CLI integration remains a future step.
- Pure code-first templates or data-driven variants may fit Remotion better.
- Existing web/LP DOM with no editorial audio/caption plan may fit HyperFrames better.

Official references:

- https://editframe.com/docs
- https://editframe.com/skills/editframe-composition/getting-started
- https://editframe.com/skills/editframe-composition/text
- https://editframe.com/skills/editframe-composition/captions
- https://editframe.com/skills/editframe-composition/transitions
- https://editframe.com/skills/editframe-composition/scripting
