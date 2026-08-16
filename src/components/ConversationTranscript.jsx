import { Clipboard } from 'lucide-react';
import { getVerdictColor, getVerdictLabel } from './VerdictBanner';

export default function ConversationTranscript({
  C,
  victimPrompt,
  payload,
  response,
  running,
  evalResult,
  judgeResult,
  compact = false,
}) {
  const copyEvidence = () => {
    const text = [
      'SYSTEM PROMPT',
      victimPrompt || '',
      '',
      'ATTACK PAYLOAD',
      payload || '',
      '',
      'MODEL RESPONSE',
      response || '',
      '',
      evalResult ? `HEURISTIC: ${getVerdictLabel(evalResult.verdict)} - ${evalResult.reason}` : '',
      judgeResult ? `JUDGE: ${getVerdictLabel(judgeResult.verdict)} - ${judgeResult.text}` : '',
    ].filter(Boolean).join('\n');
    navigator.clipboard?.writeText(text);
  };

  return (
    <section style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 5, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderBottom: `1px solid ${C.border}`, background: 'rgba(255,255,255,.012)' }}>
        <div style={{ fontSize: 11, color: C.text2, letterSpacing: 1.4, fontWeight: 800, textTransform: 'uppercase', flex: 1 }}>Evidence Transcript</div>
        <button onClick={copyEvidence} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          background: C.surface,
          border: `1px solid ${C.borderHi}`,
          color: C.text2,
          borderRadius: 3,
          padding: '4px 8px',
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 800,
        }}>
          <Clipboard size={11} /> COPY
        </button>
      </div>
      <div style={{ display: 'grid', gap: 10, padding: 12 }}>
        <TranscriptBlock C={C} label="Target system prompt" text={victimPrompt} maxHeight={compact ? 88 : 120} dim />
        <TranscriptBlock C={C} label="Attack payload" text={payload} maxHeight={compact ? 110 : 150} accent={C.amber} />
        <TranscriptBlock
          C={C}
          label={running ? 'Model response — live' : 'Model response'}
          text={response || (running ? 'Waiting for first tokens...' : 'No response captured yet.')}
          maxHeight={compact ? 220 : null}
          accent={C.teal}
          bright
          live={running}
        />
        {(evalResult || judgeResult) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
            {evalResult && <EvaluatorCard C={C} label="Heuristic" verdict={evalResult.verdict} text={evalResult.reason} />}
            {judgeResult && <EvaluatorCard C={C} label="LLM judge" verdict={judgeResult.verdict} text={judgeResult.text} />}
          </div>
        )}
      </div>
    </section>
  );
}

function TranscriptBlock({ C, label, text, maxHeight, accent, bright, dim, live }) {
  const isBright = bright && accent;
  return (
    <div>
      <div style={{ fontSize: 11, color: accent || C.text3, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 6, fontWeight: 800 }}>
        {label} {live && <span style={{ color: C.amber, animation: 'blink 1s infinite' }}>●</span>}
      </div>
      <div style={{
        background: isBright ? `${accent}0A` : C.bg,
        border: `1px solid ${accent ? `${accent}55` : C.border}`,
        borderLeft: accent ? `3px solid ${accent}` : `1px solid ${C.border}`,
        borderRadius: 4,
        color: bright ? '#FFFFFF' : dim ? C.text3 : C.text2,
        fontFamily: C.mono,
        fontSize: isBright ? 13.5 : 12,
        lineHeight: 1.7,
        maxHeight: maxHeight ?? undefined,
        overflowY: maxHeight ? 'auto' : 'visible',
        padding: isBright ? '12px 14px' : '9px 10px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {text}
        {live && <span style={{ color: C.amber, animation: 'blink 1s infinite' }}>▋</span>}
      </div>
    </div>
  );
}

function EvaluatorCard({ C, label, verdict, text }) {
  const color = getVerdictColor(verdict, C);
  return (
    <div style={{ background: C.bg, border: `1px solid ${color}44`, borderLeft: `3px solid ${color}`, borderRadius: 4, padding: '9px 10px' }}>
      <div style={{ fontSize: 10, color: C.text3, letterSpacing: 1.3, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 13, color, fontWeight: 900, marginTop: 4 }}>{getVerdictLabel(verdict)}</div>
      <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.45, marginTop: 5 }}>{text}</div>
    </div>
  );
}
