/**
 * Pointer stub.
 *
 * FLUX used this to drag charges and place probes. Statics labs are driven from the Setup panel
 * and define `pointer: null`, so this reports "never dragging" and does nothing else. Kept so a
 * lab that wants a custom pointer later has the same hook to attach to.
 */
export function createChargePointer() {
  return { dragging: false, dispose() {} };
}
