import { PaletteError } from 'palette-react-native/src/errors';
import type { AbortSignalLike } from 'palette-react-native/src/types';

/** Rejects with `ABORTED` when the signal aborts. The work continues and completes its cleanup. */
export function withAbort<T>(signal: AbortSignalLike | undefined, work: Promise<T>): Promise<T> {
  if (signal === undefined) {
    return work;
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new PaletteError('ABORTED', 'The request was aborted.'));
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener('abort', onAbort);
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}
