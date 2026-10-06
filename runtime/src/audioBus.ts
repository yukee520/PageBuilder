/**
 * A tiny registry that ensures only one audio source plays at a time, and
 * that the previous source resumes when the current one stops.
 *
 * Used by:
 *   - BgmPlayer       (owner id: "bgm")
 *   - MusicListRenderer (owner id: "music:<componentId>")
 *   - Video renderer   (owner id: "video:<componentId>")
 *
 * Model:
 *   - Each audio source subscribes with a unique owner ID and provides a
 *     callback that runs when it should stop (pause playback).
 *   - `takeOver(id)` pushes the caller onto the top of the stack. Whoever
 *     was on top gets told to stop.
 *   - `release(id, { resumePrevious })` pops the caller off the stack. If
 *     `resumePrevious` is true and there is a previous owner still on the
 *     stack, that previous owner is notified to resume (via its `onResume`
 *     callback, if it registered one).
 *
 * Behavior this produces:
 *   - BGM is playing. User taps a music track.
 *       Music takes over. BGM gets told to stop.
 *   - Music naturally ends its last track and loops back to the first.
 *       Music never releases, so BGM stays paused. Correct.
 *   - User pauses the music.
 *       Music releases with resumePrevious=true. BGM resumes.
 *   - User resumes the music.
 *       Music takes over again. BGM stops.
 *   - User navigates to a new page.
 *       Old page's music/video unmounts and releases with resumePrevious=false.
 *       New page's BGM subscribes and takes over if it has BGM configured.
 *
 * There is no global state outside this module. All coordination is via
 * subscribe/notify.
 */

type StopHandler = () => void;
type ResumeHandler = () => void;

interface Subscriber {
  onStop: StopHandler;
  onResume?: ResumeHandler;
}

const subscribers = new Map<string, Subscriber>();
const ownerStack: string[] = [];

/**
 * Register an audio source. Returns an unsubscribe function.
 *
 * `onStop` is called when a *different* owner takes over and this one
 * should pause.
 *
 * `onResume` (optional) is called when the current owner releases with
 * `resumePrevious: true` and this subscriber is the next one on the stack.
 */
export function subscribe(
  ownerId: string,
  onStop: StopHandler,
  onResume?: ResumeHandler,
): () => void {
  subscribers.set(ownerId, { onStop, onResume });
  return () => {
    subscribers.delete(ownerId);
    // Remove from the stack if the component went away while owning audio.
    const idx = ownerStack.lastIndexOf(ownerId);
    if (idx !== -1) {
      ownerStack.splice(idx, 1);
    }
  };
}

/**
 * Claim audio ownership. Any other owner currently on top is told to stop.
 * If the caller is already the top of the stack, this is a no-op.
 */
export function takeOver(ownerId: string): void {
  if (ownerStack[ownerStack.length - 1] === ownerId) {
    return; // already on top
  }

  // If the caller is somewhere deeper in the stack, move it to the top.
  const existingIdx = ownerStack.lastIndexOf(ownerId);
  if (existingIdx !== -1) {
    ownerStack.splice(existingIdx, 1);
  }
  ownerStack.push(ownerId);

  // Notify everyone else that they should stop.
  subscribers.forEach((sub, id) => {
    if (id === ownerId) return;
    try {
      sub.onStop();
    } catch {
      // best-effort — never let a subscriber break the takeover
    }
  });
}

/**
 * Release audio ownership. Pops the caller off the stack if it is on top.
 *
 * If `resumePrevious` is true and another owner remains on the stack,
 * that owner's `onResume` handler is called (if it registered one).
 */
export function release(
  ownerId: string,
  opts: { resumePrevious?: boolean } = {},
): void {
  const { resumePrevious = false } = opts;

  const top = ownerStack[ownerStack.length - 1];
  if (top !== ownerId) {
    // Not the current owner — nothing to release. Still scrub any deeper
    // stack entry just in case.
    const idx = ownerStack.lastIndexOf(ownerId);
    if (idx !== -1) ownerStack.splice(idx, 1);
    return;
  }

  ownerStack.pop();

  if (resumePrevious) {
    const prev = ownerStack[ownerStack.length - 1];
    if (prev) {
      const sub = subscribers.get(prev);
      if (sub?.onResume) {
        try {
          sub.onResume();
        } catch {
          // best-effort
        }
      }
    }
  }
}

/**
 * Diagnostic helper. Returns the current top-of-stack owner, or null.
 */
export function getActiveOwner(): string | null {
  return ownerStack[ownerStack.length - 1] ?? null;
}

/**
 * Diagnostic helper. Returns the full stack, top of stack last.
 */
export function getOwnerStack(): readonly string[] {
  return ownerStack.slice();
}