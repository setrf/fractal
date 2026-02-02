/**
 * @fileoverview Mobile-specific header component.
 * 
 * Consolidates sidebar toggles and other global controls into a single
 * top bar for small screens.
 */

import { useState, useMemo, type ChangeEvent } from 'react';
import styles from './MobileHeader.module.css';
import { useStashContext } from '../../context/StashContext';
import { useProbeContext } from '../../context/ProbeContext';
import { useViewModeContext } from '../../context/ViewModeContext';
import { useTheme } from '../../hooks/useTheme';
import { useModelContext } from '../../context/ModelContext';

interface MobileHeaderProps {
  onOpenOnboarding: () => void;
  onCreateNote: () => void;
  onMinimizeAll: () => void;
  onCloseAll: () => void;
}

export function MobileHeader({
  onOpenOnboarding,
  onCreateNote,
  onMinimizeAll,
  onCloseAll,
}: MobileHeaderProps) {
  const { isOpen: stashOpen, setIsOpen: setStashOpen, count: stashCount } = useStashContext();
  const { isOpen: probeOpen, setIsOpen: setProbeOpen, probes } = useProbeContext();
  const { isGraphView, toggleViewMode } = useViewModeContext();
  const { effectiveTheme, toggleTheme } = useTheme();
  const { models, selectedModel, setSelectedModel, isLoading: modelsLoading } = useModelContext();
  const [menuOpen, setMenuOpen] = useState(false);

  const probeCount = probes.length;
  const sortedModels = useMemo(() => models.slice().sort((a, b) => a.localeCompare(b)), [models]);

  const handleModelChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setSelectedModel(value ? value : null);
  };

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <button
          className={`${styles.iconButton} ${stashOpen ? styles.active : ''}`}
          onClick={() => setStashOpen(!stashOpen)}
          aria-label="Toggle stash"
        >
          <span className={styles.icon}>☆</span>
          {stashCount > 0 && <span className={styles.badge}>{stashCount}</span>}
        </button>
      </div>

      <div className={styles.center}>
        <h1 className={styles.title}>Fractal</h1>
      </div>

      <div className={styles.right}>
        <button
          className={styles.iconButton}
          onClick={toggleViewMode}
          aria-label="Toggle view mode"
        >
          <span className={styles.icon}>{isGraphView ? '⌘' : '◈'}</span>
        </button>
        <button
          className={`${styles.iconButton} ${probeOpen ? styles.active : ''}`}
          onClick={() => setProbeOpen(!probeOpen)}
          aria-label="Toggle probe"
        >
          <span className={styles.icon}>⚡</span>
          {probeCount > 0 && <span className={styles.badge}>{probeCount}</span>}
        </button>
        <button
          className={`${styles.iconButton} ${menuOpen ? styles.active : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Open menu"
        >
          <span className={styles.icon}>☰</span>
        </button>
      </div>

      {menuOpen && (
        <div className={styles.menuOverlay} onClick={() => setMenuOpen(false)}>
          <div className={styles.menu} onClick={(e) => e.stopPropagation()}>
            <div className={styles.menuHeader}>
              <span className={styles.menuTitle}>Settings</span>
              <button className={styles.menuCloseBtn} onClick={() => setMenuOpen(false)} aria-label="Close menu">×</button>
            </div>
            
            <div className={styles.menuSection}>
              <button className={styles.menuItem} onClick={() => { onCreateNote(); setMenuOpen(false); }}>
                <span className={styles.menuIcon}>+</span> New Note
              </button>
              <button className={styles.menuItem} onClick={() => { onMinimizeAll(); setMenuOpen(false); }}>
                <span className={styles.menuIcon}>⌄</span> Minimize All
              </button>
              <button className={styles.menuItem} onClick={() => { onCloseAll(); setMenuOpen(false); }}>
                <span className={styles.menuIcon}>×</span> Close All
              </button>
            </div>

            <div className={styles.divider} />

            <div className={styles.menuSection}>
              <button className={styles.menuItem} onClick={toggleTheme}>
                <span className={styles.menuIcon}>{effectiveTheme === 'light' ? '◐' : '◑'}</span>
                {effectiveTheme === 'light' ? 'Dark Mode' : 'Light Mode'}
              </button>
              
              <div className={styles.modelSelectorItem}>
                <label htmlFor="mobile-model-select" className={styles.modelLabel}>Model:</label>
                <select
                  id="mobile-model-select"
                  className={styles.modelSelect}
                  value={selectedModel ?? ''}
                  onChange={handleModelChange}
                  disabled={modelsLoading}
                >
                  <option value="">Auto</option>
                  {sortedModels.map((model) => (
                    <option key={model} value={model}>{model.split('/').pop()}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.divider} />

            <div className={styles.menuSection}>
              <button className={styles.menuItem} onClick={() => { onOpenOnboarding(); setMenuOpen(false); }}>
                <span className={styles.menuIcon}>?</span> Help & Onboarding
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
