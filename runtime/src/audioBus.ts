// Returns an unsubscribe function.
subscribe(ownerId: string, onStop: () => void): () => void;

// Call before you start playing. Any other owner that was active gets
// told to stop. Becomes the new active owner.
takeOver(ownerId: string): void;

// Call when you stop (track finished, user paused, component unmounts).
release(ownerId: string): void;