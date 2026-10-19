/* Tone-mapped feedback mix. Mirrored verbatim in the post-process fragment shader:
     out = 1.0 - exp(-(cur + prev * min(decay, 0.96)))
   The exponential keeps an infinitely re-fed frame below white. */
export const MAX_DECAY = 0.96;
export function mixFeedback(prev, cur, decay) {
  return 1 - Math.exp(-(cur + prev * Math.min(decay, MAX_DECAY)));
}
