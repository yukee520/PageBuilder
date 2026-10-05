/**
 * A tiny registry that ensures only one audio source plays at a time.
 *
 * Used by BgmPlayer and MusicListRenderer so that:
 *   - Tapping a music track stops background music.
 *   - Resuming background music pauses any playing music list.
 *
 * There is no global state — just a Map of subscribers keyed by owner ID.
 * Any module can subscribe; the last one to call `takeOver` wins, and every
 * other subscriber is told to stop.
 */

type StopHandler = () => void;

const subscribers = new Map<string, StopHandler>();
let activeOwner: string | null = null;

/**
 * Register a stop handler. The handler fires when a *different* owner
 * takes over audio playback. Returns an unsubscribe function.
 */
export function subscribe(ownerId: string, onStop: StopHandler): () => void {
  subscribers.set(ownerId, onStop);
  return () => {
    subscribers.delete(ownerId);
    if (activeOwner === ownerId) {
      activeOwner = null;
    }
  };
}

/**
 * Claim audio ownership. Every other subscriber's stop handler fires.
 * The caller becomes the active owner.
 *
 * Safe to call repeatedly with the same ownerId — no notification is sent
 * to other subscribers if the owner hasn't changed.
 */
export function takeOver(ownerId: string): void {
  if (activeOwner === ownerId) return;
  activeOwner = ownerId;
  subscribers.forEach((handler, id) => {
    if (id === ownerId) return;
    try {
      handler();
    } catch {
      // best-effort — never let a subscriber break the takeover
    }
  });
}

/**
 * Release audio ownership if the caller currently owns it. Does not
 * notify other subscribers — releasing just means "I'm done playing,
 * nobody has to change state."
 */
export function release(ownerId: string): void {
  if (activeOwner === ownerId) {
    activeOwner = null;
  }
}

/**
 * Diagnostic helper. Returns the current owner, or null.
 */
export function getActiveOwner(): string | null {
  return activeOwner;
}