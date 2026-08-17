import { FileText, FlaskConical } from 'lucide-react';

export default function Header({
  C,
  modelReady,
  modelConfigOpen,
  loadedModel,
  loadedModelId,
  guideStep,
  setModelConfigOpen,
  victimModelId,
  setVictimModelId,
  modelStatus,
  running,
  victimModels,
  loadModel,
  judging,
  loadProgress,
  selectedVictimModel,
  advancedMode,
  setAdvancedMode,
  activeTab,
  setActiveTab,
  findingsCount,
}) {
  return (
    <header className="app-header">
      <div className="brand-lockup">
        {/* Text wordmark until brand art exists. */}
        <div className="brand-word" aria-label="SLEEPER Agent Threat and Control Lab">
          <div className="brand-title">SLEEPER</div>
          <div className="brand-subtitle">AGENT THREAT &amp; CONTROL LAB</div>
        </div>
        <span className="brand-context">Local-first agent threat and control lab</span>
      </div>

      <div className="header-divider" style={{ width: 1, height: 24, background: C.border }} />

      <div className="model-bar">
        {modelReady && !modelConfigOpen ? (
          <>
            <span style={{ fontSize: 13, color: C.text2, letterSpacing: 1 }}>TARGET</span>
            <span style={{
              fontSize: 13,
              color: C.text1,
              background: C.surface,
              border: `1px solid ${guideStep === 'target' ? C.brass : C.border}`,
              padding: '4px 8px',
              borderRadius: 2,
            }}>
              {loadedModel?.name || loadedModelId} · READY
            </span>
            <button
              onClick={() => setModelConfigOpen(true)}
              style={{
                padding: '5px 10px', fontSize: 12, fontWeight: 700, letterSpacing: 1,
                background: 'transparent',
                border: `1px solid ${guideStep === 'target' ? C.brass : C.border}`,
                borderBottom: `1px solid ${guideStep === 'target' ? C.brass : C.text3}`,
                color: guideStep === 'target' ? C.brass : C.text3,
                cursor: 'pointer', borderRadius: 2,
              }}
            >
              CHANGE
            </button>
          </>
        ) : (
          <>
            <span style={{ fontSize: 13, color: C.text2, letterSpacing: 1 }}>TARGET MODEL</span>
            <select
              value={victimModelId}
              onChange={e => setVictimModelId(e.target.value)}
              disabled={modelStatus === 'loading' || running}
              style={{
                background: C.surface, border: `1px solid ${guideStep === 'target' ? C.brass : C.border}`,
                color: C.text1, fontSize: 15, padding: '4px 8px',
                borderRadius: 2, cursor: 'pointer',
              }}
            >
              {victimModels.map(m => (
                <option key={m.id} value={m.id}>{m.quickStart ? 'Quick Start - ' : ''}{m.name} ({m.size})</option>
              ))}
            </select>

            <button
              onClick={() => loadModel(victimModelId)}
              disabled={modelStatus === 'loading' || modelStatus === 'ready' && loadedModelId === victimModelId}
              style={{
                padding: '5px 12px', fontSize: 14, fontWeight: 700, letterSpacing: 1,
                background: modelStatus === 'ready' && loadedModelId === victimModelId ? C.brassBg : C.surface,
                border: `1px solid ${guideStep === 'target' ? C.brass : modelStatus === 'ready' && loadedModelId === victimModelId ? C.brass : C.borderHi}`,
                color: modelStatus === 'ready' && loadedModelId === victimModelId ? C.brass : C.text2,
                cursor: 'pointer', borderRadius: 2,
                opacity: modelStatus === 'loading' ? 0.5 : 1,
              }}
            >
              {modelStatus === 'loading' ? 'LOADING...' : modelStatus === 'ready' && loadedModelId === victimModelId ? '● LOADED' : 'LOAD →'}
            </button>
          </>
        )}

        {(modelStatus === 'loading' || judging) && (
          <span style={{ fontSize: 13, color: C.brass, letterSpacing: 0.5, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {loadProgress}
          </span>
        )}
        {modelStatus !== 'loading' && !modelReady && (
          <span style={{ fontSize: 12, color: selectedVictimModel?.quickStart ? C.teal : C.brass, letterSpacing: .2, maxWidth: 330, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedVictimModel?.quickStart ? 'New? Start here: smallest first download.' : `First load downloads ${selectedVictimModel?.size || 'the model'} into this browser.`}
          </span>
        )}
        <button
          onClick={() => setAdvancedMode(p => !p)}
          style={{
            marginLeft: 'auto',
            padding: '5px 10px',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 1,
            background: 'transparent',
            border: `1px solid ${advancedMode ? C.brass : C.border}`,
            borderBottom: `1px solid ${advancedMode ? C.brass : C.text3}`,
            color: advancedMode ? C.brass : C.text3,
            cursor: 'pointer',
            borderRadius: 2,
          }}
        >
          {advancedMode ? 'ADVANCED ON' : 'ADVANCED'}
        </button>
      </div>

      <div className="tab-nav">
        {[
          { tab: 'lab', label: 'LAB', Icon: FlaskConical },
          { tab: 'findings', label: `FINDINGS (${findingsCount})`, Icon: FileText },
        ].map(({ tab, label, Icon }) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', fontSize: 14, fontWeight: 700, letterSpacing: 1,
            background: 'transparent',
            border: `1px solid ${activeTab === tab ? C.brass : C.border}`,
            borderBottom: `1px solid ${activeTab === tab ? C.brass : C.border}`,
            color: activeTab === tab ? C.brass : C.text2, cursor: 'pointer',
            borderRadius: 2,
          }}>
            <Icon size={11} />{label}
          </button>
        ))}
      </div>
    </header>
  );
}
