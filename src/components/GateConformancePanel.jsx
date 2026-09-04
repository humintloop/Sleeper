// A runnable mode for exercising Sleeper's own authorization gate directly —
// synthetic proposals straight into runToolAuthorizationGate, no target, no
// model, no case run. Same discipline as Sample Replay's own framing ("it
// demonstrates the harness and claims nothing about a model"), but narrower
// still: this demonstrates the gate and claims nothing about ANY target,
// live or replayed. See src/harness/gateConformance.js for the case list and
// the evidence-scope note this panel renders verbatim.
import { useState } from 'react';
import { CheckCircle2, ChevronRight, ShieldCheck, XCircle } from 'lucide-react';
import { runGateConformanceSuite } from '../harness/gateConformance';

function ResultRow({ C, result }) {
  const [open, setOpen] = useState(false);
  const tone = result.passed ? C.green : C.red;
  return (
    <div style={{ borderTop: `1px solid ${C.border}` }}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{
          width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer',
          padding: '8px 0', display: 'flex', alignItems: 'center', gap: 9,
        }}
      >
        <ChevronRight size={12} color={C.text3} style={{ transform: open ? 'rotate(90deg)' : 'none', flexShrink: 0 }} />
        {result.passed
          ? <CheckCircle2 size={14} color={tone} style={{ flexShrink: 0 }} />
          : <XCircle size={14} color={tone} style={{ flexShrink: 0 }} />}
        <span style={{ color: C.text1, fontSize: C.size.small, flex: 1, minWidth: 0 }}>{result.description}</span>
        <span style={{ color: tone, fontSize: C.size.micro, fontWeight: 800, fontFamily: C.mono, flexShrink: 0 }}>
          {result.passed ? 'PASS' : 'FAIL'}
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 0 12px 21px', fontSize: C.size.micro, color: C.text3, fontFamily: C.mono, lineHeight: 1.6 }}>
          <div>id: {result.id}</div>
          <div>field checked: {result.field}</div>
          <div>expected: {String(result.expected)} · actual: {String(result.actual)}</div>
        </div>
      )}
    </div>
  );
}

export default function GateConformancePanel({ C, cardStyle }) {
  const [report, setReport] = useState(null);

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <ShieldCheck size={14} color={C.brass} />
        <div style={{ fontSize: C.size.small, color: C.brass, fontWeight: 900, letterSpacing: .2 }}>
          Gate conformance suite
        </div>
      </div>
      <div style={{ color: C.text2, fontSize: C.size.small, lineHeight: 1.55, marginBottom: 10 }}>
        The authorization gate is deterministic — it does not need a model to fall for bait to be testable.
        This runs a battery of synthetic tool-call proposals straight into the gate and checks its own
        decision on each one. No target, no model, no network call, done in under a second.
      </div>

      <button
        onClick={() => setReport(runGateConformanceSuite())}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', cursor: 'pointer',
          background: C.surface, border: `1px solid ${C.borderHi}`, borderRadius: 2, color: C.text1,
          fontSize: C.size.small, fontWeight: 800, letterSpacing: .3, marginBottom: report ? 12 : 0,
        }}
      >
        RUN GATE CONFORMANCE SUITE
      </button>

      {report && (
        <>
          <div role="status" style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', marginBottom: 8,
            background: report.summary.failed === 0 ? C.greenBg : C.redBg,
            border: `1px solid ${(report.summary.failed === 0 ? C.green : C.red)}55`, borderRadius: 2,
          }}>
            <span style={{ color: report.summary.failed === 0 ? C.green : C.red, fontWeight: 900, fontFamily: C.mono, fontSize: C.size.small }}>
              {report.summary.passed} / {report.summary.total} PASSED
            </span>
            <span style={{ color: C.text3, fontSize: C.size.micro }}>{new Date(report.generated_at).toLocaleTimeString()}</span>
          </div>

          <div style={{ fontSize: C.size.micro, color: C.text3, lineHeight: 1.5, marginBottom: 10, fontStyle: 'italic' }}>
            {report.claim_scope}
          </div>

          <div>
            {report.results.map(result => <ResultRow key={result.id} C={C} result={result} />)}
          </div>
        </>
      )}
    </div>
  );
}
