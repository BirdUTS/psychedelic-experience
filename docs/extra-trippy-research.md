# EXTRA: real-time visual journey

## Research and implemented approach

Trippy imagery is not one algorithm. This experiment combines procedural curves, recursive image feedback, temporal modulation, and audio-driven parameters. Hydra's original implementation and learning materials demonstrate scale/rotate/kaleidoscope transforms, output-buffer feedback, and FFT-driven controls:

- https://github.com/hydra-synth/hydra
- https://hydra.ojack.xyz/docs/docs/learning/video-synth-basics/modulate/
- https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode
- https://conwaylife.com/wiki/Conway%27s_Game_of_Life

The implemented Canvas pipeline draws a faded, slightly enlarged and rotated previous frame, then new procedural geometry. Slow oscillations vary scale while integrated hue and angle continue to move. Exponential smoothing and decay use elapsed seconds. Frame deltas are capped to avoid large jumps after inactivity. A two-second snapshot crossfade softens model changes. This is a visual synthesis experiment, not a simulation or measurement of a psychedelic experience.

## Audio decisions

Microphone FFT bands: 20–250 Hz, 250–2000 Hz, and 2000–12000 Hz. A sensitivity control scales the band averages. Noise suppression, echo cancellation and automatic gain control are requested off to preserve music dynamics, although browser/device support can vary. Nothing is connected to speakers, recorded, or uploaded.

A local heuristic detects bass onsets above a moving energy baseline, with a 300 ms refractory interval. This is an onset estimate, not accurate BPM tracking or emotion inference. Smoothed energy drives speed, size and rotation; upper-band activity drives color and line/particle count. The UI displays current band values and the dynamic speed multiplier (in addition to the user's base time speed).

Auto journey chooses a scene on a detected onset after 16 seconds, or after 26 seconds without one. A repeated candidate advances to the next scene. Silence still progresses through scenes. Choosing a scene manually disables auto scene selection while preserving continuous parameter modulation. No JEV integration is claimed: the name and interface are not yet specified.

## Game of Life

A 72×72 toroidal board uses synchronous B3/S23 updates with eight neighbors and double buffering. Sound changes generation rate and rendering, not birth/survival rules. Color reflects cell age. The board can settle naturally; “重生細胞” explicitly starts a new random seed. Other modes preserve its state. No hidden random injection changes the simulation.

## Controls and validation

Open extra-math-lab.html through localhost. Auto journey starts on. Use “模擬聲音” for a synthetic drum envelope or “啟用麥克風” for real music. Adjust journey intensity, microphone sensitivity and feedback amount. Pause freezes animation, scene timing and cell generations. Reduced-motion preference starts paused. Immersive mode hides controls except the exit tools; Escape restores them. A zero base time speed stops procedural time and Life; camera/color/director motion is independently controlled by pause.

Run `node --test tests/extra-dynamics.test.cjs` for deterministic Life and audio-director checks. Real microphone permissions and device capture require a user/device test; simulated input is explicitly labeled.
