import SignalBars from './SignalBars';

export default function LoadingScreen({ C, mode = 'model', modelName, modelSize, progress }) {
  const isJudge = mode === 'judge';
  const color = isJudge ? C.teal : C.amber;
  return (
    <section style={{
      padding: '14px 16px',
      borderBottom: `1px solid ${C.border}`,
      background: isJudge ? 'rgba(0,207,196,.045)' : 'rgba(200,120,68,.055)',
      flexShrink: 0,
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'auto minmax(0, 1fr)',
        gap: 16,
        alignItems: 'center',
        border: `1px solid ${color}33`,
        background: C.panel,
        borderRadius: 4,
        padding: '13px 15px',
      }}>
        <SignalBars C={C} color={color} label={isJudge ? 'judge evaluation' : 'model initialization'} count={isJudge ? 10 : 12} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, color, letterSpacing: '0.16em', fontWeight: 800, textTransform: 'uppercase', marginBottom: 5 }}>
            {isJudge ? 'Judge Evaluation Waiting State' : 'Model Initialization'}
          </div>
          <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.5 }}>
            {isJudge
              ? 'The local judge model is reviewing the response as evidence. The target model may be reloaded when judging completes.'
              : `${modelName || 'Selected model'}${modelSize ? ` (${modelSize})` : ''} is loading in the browser WebGPU runtime.`}
          </div>
          {progress && (
            <div style={{ marginTop: 6, fontSize: 12, color: C.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {progress}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
