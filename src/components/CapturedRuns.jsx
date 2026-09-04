// Verified captures: a completed LIVE run (a real model decision, evidence
// class E3) saved locally so it can be shown again — in a demo, in a review
// meeting — without depending on a live API call succeeding again, or on the
// model reproducing the same decision on cue. Deliberately not a new Target
// type: "replay" here means setting the run/verdict/contract straight from
// what was actually recorded, the same way a scene handoff already does.
//
// The gate on what may be saved (target_type === 'live' and
// max_class_claimed === 'E3') lives here, in the UI, not in storage.js — the
// storage layer persists whatever it is given, same pattern as saveAgentRun.
import { useState } from 'react';
import { Download, FolderCheck, Save, Trash2 } from 'lucide-react';
import { saveCapturedRun } from '../storage';
import { targetSummary } from './RunContextSummary';
import { getVerdictColor, getVerdictLabel } from './VerdictBanner';

function downloadJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function ghostBtn(C) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px',
    background: 'transparent', border: `1px solid ${C.borderHi}`, color: C.text2,
    fontSize: C.size.micro, fontWeight: 700, letterSpacing: .5, cursor: 'pointer', borderRadius: 2,
  };
}

export function isCapturable(result) {
  return result?.configuration?.target_type === 'live'
    && result?.contract?.evidence?.max_class_claimed === 'E3';
}

/**
 * Shown only when the currently displayed result is both live and reached
 * E3 — a scripted Sample Replay or a local model never satisfies this, so
 * this button is simply absent for them rather than present and disabled.
 */
export function SaveCaptureButton({ C, result, caseId, caseTitle, profileId, profileLabel, onSaved }) {
  const [saved, setSaved] = useState(false);

  if (!isCapturable(result)) return null;

  const handleSave = async () => {
    const record = {
      manifestDigest: result.manifestDigest,
      caseId,
      caseTitle,
      profileId,
      profileLabel,
      targetLabel: targetSummary(result.configuration),
      outcome: result,
    };
    const updated = await saveCapturedRun(record);
    onSaved?.(updated);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };

  return (
    <button onClick={handleSave} style={{ ...ghostBtn(C), borderColor: C.agent, color: saved ? C.green : C.agent }}>
      <Save size={13} /> {saved ? 'SAVED — REPLAYABLE WITHOUT ANOTHER API CALL' : 'SAVE AS VERIFIED CAPTURE'}
    </button>
  );
}

function CaptureRow({ C, capture, onReplay, onDelete }) {
  const verdict = capture.outcome?.verdict?.verdict;
  const color = getVerdictColor(verdict, C);
  return (
    <div style={{ borderTop: `1px solid ${C.border}`, padding: '9px 0', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ color: C.text1, fontSize: C.size.small }}>{capture.caseTitle}</div>
        <div style={{ color: C.text3, fontSize: C.size.micro, fontFamily: C.mono, marginTop: 2 }}>
          {capture.profileLabel} · {capture.targetLabel} · {capture.capturedAt ? new Date(capture.capturedAt).toLocaleString() : ''}
        </div>
      </div>
      <span style={{
        color, border: `1px solid ${color}55`, background: `${color}12`, borderRadius: C.radius,
        padding: '1px 6px', fontSize: C.size.micro, fontWeight: 800, fontFamily: C.mono, whiteSpace: 'nowrap',
      }}>
        {getVerdictLabel(verdict)}
      </span>
      <button onClick={() => onReplay(capture)} style={ghostBtn(C)}>REPLAY</button>
      <button
        onClick={() => downloadJson(capture, `captured-${capture.caseId || 'run'}-${capture.captureId}.json`)}
        style={ghostBtn(C)}
        aria-label="Download this capture as JSON"
      >
        <Download size={13} />
      </button>
      <button onClick={() => onDelete(capture.captureId)} style={{ ...ghostBtn(C), color: C.red }} aria-label="Delete this capture">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

export default function CapturedRunsList({ C, captures, onReplay, onDelete, cardStyle }) {
  if (!captures || captures.length === 0) return null;
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <FolderCheck size={13} color={C.agent} />
        <div style={{ fontSize: C.size.micro, color: C.text3, letterSpacing: 1.2, fontWeight: 700, textTransform: 'uppercase' }}>
          Verified captures &middot; real model decisions, saved from this browser
        </div>
      </div>
      <div style={{ color: C.text3, fontSize: C.size.micro, lineHeight: 1.5, marginBottom: 4 }}>
        Each one reached evidence class E3 against a live model. Replaying shows the recorded
        outcome again without another API call; it does not run the model a second time.
      </div>
      <div>
        {captures.map(capture => (
          <CaptureRow key={capture.captureId} C={C} capture={capture} onReplay={onReplay} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}
