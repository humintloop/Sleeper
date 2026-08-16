import { Plus, RefreshCw } from 'lucide-react';
import VerdictBanner, { getVerdictLabel } from './VerdictBanner';

export default function TriagePanel({
  C,
  evalResult,
  finalEvalSummary,
  judgeMode,
  judgeResult,
  judging,
  addFinding,
  saveDisabled,
  nextStepId,
  summarizeEvaluation,
}) {
  if (!evalResult) return null;

  const finalVerdict = finalEvalSummary?.finalVerdict || evalResult.verdict;
  const color = finalVerdict === 'SUCCESS' ? C.red : finalVerdict === 'PARTIAL' ? C.amber : finalVerdict === 'REVIEW' ? C.text3 : C.teal;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, animation: 'fadeIn .2s ease' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        background: `${color}0f`,
        border: `1px solid ${color}40`,
        borderRadius: 4,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: C.text3, letterSpacing: 1.2, marginBottom: 6 }}>HUMAN TRIAGE</div>
          <VerdictBanner C={C} verdict={finalVerdict} compact />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 7 }}>
            <span style={{ fontSize: 12, color: C.text2, background: C.bg, border: `1px solid ${C.border}`, padding: '1px 6px', borderRadius: 2 }}>
              HEURISTIC {getVerdictLabel(evalResult.verdict)}
            </span>
            {judgeMode && judgeResult && (
              <span style={{ fontSize: 12, color: C.text2, background: C.bg, border: `1px solid ${C.border}`, padding: '1px 6px', borderRadius: 2 }}>
                JUDGE {getVerdictLabel(judgeResult.verdict)}
              </span>
            )}
          </div>
          <div style={{ fontSize: 14, color: C.text2, lineHeight: 1.45, marginTop: 7 }}>
            {finalEvalSummary?.note || evalResult.reason}
          </div>
          <div style={{ fontSize: 13, color: C.text3, lineHeight: 1.45, marginTop: 5 }}>
            Next: save this result as a finding if it should become evidence, then review/export it from Findings.
          </div>
        </div>
        <button
          onClick={addFinding}
          disabled={saveDisabled}
          style={{
            padding: '9px 13px', background: C.amberBg, border: `1px solid ${C.amber}40`,
            color: C.amber, fontSize: 13, fontWeight: 700, letterSpacing: 1,
            cursor: saveDisabled ? 'not-allowed' : 'pointer',
            opacity: saveDisabled ? 0.45 : 1,
            borderRadius: 2, flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: nextStepId === 'review' ? '0 0 0 2px rgba(200,120,68,.20)' : 'none',
          }}
        >
          <Plus size={13} />
          {judging ? 'WAIT' : 'SAVE FINDING'}
        </button>
      </div>

      {(judgeMode || finalEvalSummary?.source) && (
        <div className="eval-detail-row" style={{ display: 'flex', gap: 10 }}>
          <div style={{
            flex: 1, padding: '10px 12px',
            background: `${color}08`,
            border: `1px solid ${color}30`,
            borderRadius: 2,
          }}>
            <div style={{ fontSize: 13, color: C.text2, letterSpacing: 1, marginBottom: 5 }}>HEURISTIC EVAL</div>
            <div style={{ fontSize: 15, color, fontWeight: 700, marginBottom: 4 }}>
              {getVerdictLabel(evalResult.verdict)} · {evalResult.label}
            </div>
            <div style={{ fontSize: 14, color: C.text2 }}>{evalResult.reason}</div>
          </div>

          {judgeMode && (
            <div style={{
              flex: 1, padding: '10px 12px',
              background: judgeResult ? `${color}14` : C.amberBg,
              border: `1px solid ${judgeResult ? color + '40' : C.amber + '40'}`,
              borderRadius: 2,
            }}>
              <div style={{ fontSize: 13, color: C.text2, letterSpacing: 1, marginBottom: 5 }}>
                LLM JUDGE {judging && <span style={{ color: C.amber }}>EVALUATING...</span>}
              </div>
              {judgeResult ? (
                <>
                  <div style={{ fontSize: 15, color, fontWeight: 700, marginBottom: 4 }}>
                    {getVerdictLabel(judgeResult.verdict)}
                  </div>
                  <div style={{ fontSize: 14, color: C.text2, lineHeight: 1.5 }}>{judgeResult.text}</div>
                </>
              ) : judging ? (
                <div style={{ fontSize: 14, color: C.amber }}>
                  <RefreshCw size={10} style={{ display: 'inline', animation: 'spin 1s linear infinite', marginRight: 4 }} />
                  Swapping to judge model...
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {judgeMode && judgeResult && summarizeEvaluation(evalResult, judgeResult).disagreement && (
        <div style={{ padding: '8px 12px', background: C.amberBg, border: `1px solid ${C.amber}40`, borderRadius: 2 }}>
          <div style={{ fontSize: 13, color: C.amber, letterSpacing: 1, marginBottom: 4, fontWeight: 700 }}>REVIEW REQUIRED</div>
          <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.45 }}>
            Heuristic says {getVerdictLabel(evalResult.verdict)}, judge says {getVerdictLabel(judgeResult.verdict)}. The evaluators materially disagree, so keep both signals in the finding.
          </div>
        </div>
      )}
    </div>
  );
}
