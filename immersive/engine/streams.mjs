/* Routes the audio graph's two streams into the Director's input.
   The music stream feeds the beat clock; the room stream feeds Agency. When the microphone is the only
   source it plays both roles: its own speech-likeness and onsets count as the room. Pure. */
export function directorInput({ frames, musicF, roomF, latency, gestures = 0, user, online = true, paused = false }) {
  const music = frames.music
    ? { E: musicF.E, onset: musicF.onset, B: musicF.B, C: musicF.C, bpm: musicF.bpm, latency: latency.music }
    : null;
  let room = null;
  if (frames.room) room = { onset: roomF.onset, speech: roomF.speech };
  else if (frames.music && frames.source === 'mic') room = { onset: musicF.onset, speech: musicF.speech };
  return { music, room, gestures, user, online, paused };
}
