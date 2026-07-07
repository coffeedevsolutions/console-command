// api/dspDebug.js
// TEMPORARY bench-testing instrumentation for the DSP BLE bridge.
// Every DSP read/write/poll routes through dlog() so you can watch the exact
// REST traffic (and its payloads) in the Metro/console log while calibrating
// the TPT-SP4BT on the bench. Flip DSP_DEBUG to false — or delete this file and
// its imports — once the bridge is verified. Grep tag: [DSP].
//
// Tags:  →  write intent (method + path + body)
//        ✓  response ok
//        ✗  request failed
//        ↺  state poll
//        ⚑  local mirror changed (optimistic edit)

export let DSP_DEBUG = true;         // master switch for all DSP logs
export let DSP_DEBUG_POLL = false;   // noisier: log every /api/state poll tick

export function setDspDebug(on) { DSP_DEBUG = !!on; }
export function setDspDebugPoll(on) { DSP_DEBUG_POLL = !!on; }

function stamp() {
  const d = new Date();
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

export function dlog(tag, msg, data) {
  if (!DSP_DEBUG) return;
  const head = `[DSP ${stamp()}] ${tag} ${msg}`;
  if (data !== undefined) console.log(head, data);
  else console.log(head);
}

export function dpoll(msg, data) {
  if (!DSP_DEBUG || !DSP_DEBUG_POLL) return;
  dlog('↺', msg, data);
}
