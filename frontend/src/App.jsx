import { useEffect, useMemo, useRef, useState } from "react";
import { getMaintenanceRecommendation, healthCheck, loadSampleAnalytics, uploadAnalyticsFile, uploadManualFile } from './api/client';
import PanelCard from './components/PanelCard';

function App() {
  const [excelFile, setExcelFile] = useState(null);
  const [manualFile, setManualFile] = useState(null);
  const [uploadedManualName, setUploadedManualName] = useState('');
  const [status, setStatus] = useState('Checking backend connection...');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState('');
  const [analyticsResult, setAnalyticsResult] = useState(null);
  const [recommendationResult, setRecommendation] = useState(null);
  const [error, setError] = useState('');
  const errorBannerRef = useRef(null);
  const topbarRef = useRef(null);

  const scrollToTop = () => {
    if (topbarRef.current) {
      topbarRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  const [activeAircraft, setActiveAircraft] = useState('AIR-001');
  const [availableAircraft, setAvailableAircraft] = useState(['AIR-001', 'AIR-002', 'AIR-003', 'AIR-004', 'AIR-005']);
  const [signalSearch, setSignalSearch] = useState('');
  const [signalFilter, setSignalFilter] = useState('ALL');
  const [activeAiTab, setActiveAiTab] = useState('all');
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [zuluTime, setZuluTime] = useState('');
  const [localTime, setLocalTime] = useState('');

  // Live aerospace UTC Zulu & Local time clocks
  useEffect(() => {
    const updateClocks = () => {
      const now = new Date();
      setZuluTime(now.toISOString().slice(11, 19) + 'Z');
      setLocalTime(now.toLocaleTimeString([], { hour12: false }));
    };
    updateClocks();
    const clockTimer = setInterval(updateClocks, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // Backend connection check & auto-load initial sample flight
  useEffect(() => {
    let isMounted = true;
    const initApp = async () => {
      try {
        const health = await healthCheck();
        if (isMounted) {
          setStatus(`Systems Nominal · ${health.service || 'ATX200 API Active'}`);
          // Auto-load AIR-001 for instant visual showcase
          try {
            const initialSample = await loadSampleAnalytics('AIR-001');
            if (isMounted) {
              setAnalyticsResult(initialSample);
              setActiveAircraft(initialSample.aircraft_id || 'AIR-001');
              if (initialSample.available_aircraft) {
                setAvailableAircraft(initialSample.available_aircraft);
              }
            }
          } catch {
            // Ignore auto-load failure
          }
        }
      } catch (err) {
        if (isMounted) {
          setStatus('Backend Offline · Run start.bat on port 8000');
          setError(err.message);
        }
      }
    };

    initApp();
    const pingInterval = setInterval(async () => {
      try {
        await healthCheck();
        if (isMounted) setStatus('Systems Nominal · ATX200 API Active');
      } catch {
        if (isMounted) setStatus('Backend Offline · Start FastAPI on port 8000');
      }
    }, 20000);

    return () => {
      isMounted = false;
      clearInterval(pingInterval);
    };
  }, []);

  // Auto-scroll smoothly up to error banner whenever an error is triggered
  useEffect(() => {
    if (error) {
      const scrollTimer = setTimeout(() => {
        if (errorBannerRef.current) {
          errorBannerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 50);
      return () => clearTimeout(scrollTimer);
    }
  }, [error]);

  // Load specific aircraft from fleet
  const handleSelectAircraft = async (aircraftId) => {
    setIsLoading(true);
    setLoadingPhase('analytics');
    setError('');
    setRecommendation(null);
    setActiveAircraft(aircraftId);
    setCompletedSteps(new Set());
    setManualFile(null);
    setUploadedManualName('');
    setExcelFile(null);

    try {
      const response = await loadSampleAnalytics(aircraftId);
      setAnalyticsResult(response);
      if (response.available_aircraft) {
        setAvailableAircraft(response.available_aircraft);
      }
      setStatus(`Telemetry Active: Aircraft ${aircraftId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      setLoadingPhase('');
    }
  };

  // Upload user telemetry Excel file and/or maintenance manual PDF
  const handleSubmitUpload = async (event) => {
    event.preventDefault();
    if (!excelFile && !manualFile) {
      setError('Please select at least an Excel flight telemetry file (.xlsx/.xls) or a PDF maintenance manual/report (.pdf) before processing.');
      setStatus('Upload Error: No files selected');
      setTimeout(() => {
        if (errorBannerRef.current) {
          errorBannerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          scrollToTop();
        }
      }, 50);
      return;
    }

    // Smoothly scroll up to the top command bar, radar HUD & decision board
    scrollToTop();

    setIsLoading(true);
    setLoadingPhase('analytics');
    setError('');
    setCompletedSteps(new Set());

    try {
      let customManualFilename = uploadedManualName;
      let currentAnalytics = analyticsResult;

      // 1. If a custom PDF manual or airworthiness report was selected, upload it
      if (manualFile) {
        setStatus(`Uploading document: ${manualFile.name}...`);
        const manualRes = await uploadManualFile(manualFile);
        customManualFilename = manualRes.filename;
        setUploadedManualName(manualRes.filename);

        // If the uploaded PDF is a Google AI / certified Airworthiness Status Report, adopt its analytics
        if (manualRes.is_airworthiness_report && manualRes.analytics) {
          currentAnalytics = manualRes.analytics;
          setAnalyticsResult(manualRes.analytics);
          setActiveAircraft(manualRes.analytics.aircraft_id || 'N5142B');
          if (manualRes.analytics.available_aircraft) {
            setAvailableAircraft(manualRes.analytics.available_aircraft);
          }
        }
      }

      // 2. If an Excel telemetry file or status report was selected, process it
      if (excelFile) {
        setStatus(`Analyzing dataset: ${excelFile.name}...`);
        const analyticsRes = await uploadAnalyticsFile(excelFile);
        currentAnalytics = analyticsRes;
        setAnalyticsResult(analyticsRes);
        setActiveAircraft(analyticsRes.aircraft_id || 'CUSTOM');
        if (analyticsRes.available_aircraft) {
          setAvailableAircraft(analyticsRes.available_aircraft);
        }
      }

      // 3. If we have analytics, automatically run the maintenance recommendation with the manual
      if (currentAnalytics) {
        setLoadingPhase('ai');
        setStatus(`Evaluating against maintenance manual & airworthiness standards...`);
        const recRes = await getMaintenanceRecommendation(currentAnalytics, customManualFilename);
        setRecommendation(recRes);
        setStatus(`Analysis complete: ${currentAnalytics.aircraft_id || 'Flight'} benchmarked against airworthiness standards`);
      } else {
        setStatus(`Manual ${manualFile.name} ready. Load sample or upload Excel.`);
      }

      // Re-confirm smooth position at the top to showcase updated Tactical Radar & Decision Board
      scrollToTop();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      setLoadingPhase('');
    }
  };

  // Generate AI / ATX200 Recommendation
  const handleGenerateRecommendation = async () => {
    if (!analyticsResult) {
      setError('Load or generate aircraft analytics first.');
      return;
    }

    setIsLoading(true);
    setLoadingPhase('ai');
    setError('');

    try {
      const response = await getMaintenanceRecommendation(analyticsResult, uploadedManualName || null);
      setRecommendation(response);
      setStatus('AI ATX200 Maintenance Decision Generated');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      setLoadingPhase('');
    }
  };

  const toggleChecklistStep = (step) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(step)) next.delete(step);
      else next.add(step);
      return next;
    });
  };

  const handlePrintWorkOrder = () => {
    window.print();
  };

  const currentRecord = analyticsResult?.summary?.current_record || {};
  const historicalAnalysis = analyticsResult?.summary?.historical_analysis || [];
  const recommendationSummary = recommendationResult?.report || null;

  // Dynamic flight metadata for Route, Landed, Gate, Standard
  const flightInfo = useMemo(() => {
    const tail = analyticsResult?.aircraft_id || activeAircraft || 'AIR-001';
    const isReport = Boolean(
      analyticsResult?.summary?.is_airworthiness_report ||
      recommendationResult?.report?.is_airworthiness_report ||
      tail.startsWith('N') ||
      tail.toLowerCase().includes('cessna')
    );

    // 1. STANDARD
    let standard = 'AeroTech ATX200 Rev 4.2';
    if (recommendationResult?.report?.manual_source) {
      standard = recommendationResult.report.manual_source.replace(/\.pdf$/i, '');
    } else if (uploadedManualName) {
      standard = uploadedManualName.replace(/\.pdf$/i, '');
    } else if (isReport) {
      const basis = analyticsResult?.summary?.profile?.certification_basis;
      standard = basis || 'FAA TCDS 3A12 / Cessna 172S Manual';
    }

    // 2. Full Aircraft Model
    const rawModel = currentRecord?.Aircraft_Model || (isReport ? 'Cessna 172S Skyhawk SP' : 'A320neo');
    const lower = rawModel.toLowerCase();
    const model = lower.includes('airbus') || lower.includes('boeing') || lower.includes('cessna')
      ? rawModel
      : (rawModel.startsWith('A') ? `Airbus ${rawModel}` : rawModel.startsWith('B') ? `Boeing ${rawModel}` : rawModel);

    // 3. Route, Landed, Gate
    if (isReport || tail === 'N5142B') {
      const lastDate = currentRecord?.Last_Maintenance_Date;
      return {
        tail,
        model,
        route: 'KBJC → KAPA',
        originCode: 'KBJC',
        destCode: 'KAPA',
        waypoint: 'ROCKY MTNS',
        landed: lastDate ? `Landed ${lastDate} (Logbook Verified)` : '22m ago',
        gate: 'FBO Ramp Stand 14A',
        standard,
        statusTag: 'AIRWORTHINESS RECORD TOUCHDOWN CONFIRMED',
      };
    }

    switch (tail) {
      case 'AIR-002':
        return {
          tail,
          model,
          route: 'CDG → LHR',
          originCode: 'CDG',
          destCode: 'LHR',
          waypoint: 'CHANNEL',
          landed: '28m ago',
          gate: 'T5 Stand 512',
          standard,
          statusTag: 'AIRBORNE TOUCHDOWN CONFIRMED',
        };
      case 'AIR-003':
        return {
          tail,
          model,
          route: 'LHR → JFK',
          originCode: 'LHR',
          destCode: 'JFK',
          waypoint: 'ATLANTIC',
          landed: '42m ago',
          gate: 'Gate B26 (T4)',
          standard,
          statusTag: 'LONG-HAUL ARRIVAL CONFIRMED',
        };
      case 'AIR-004':
        return {
          tail,
          model,
          route: 'DXB → BOM',
          originCode: 'DXB',
          destCode: 'BOM',
          waypoint: 'ARABIAN SEA',
          landed: '19m ago',
          gate: 'Bay V18 (T2)',
          standard,
          statusTag: 'AIRBORNE TOUCHDOWN CONFIRMED',
        };
      case 'AIR-005':
        return {
          tail,
          model,
          route: 'ORD → JFK',
          originCode: 'ORD',
          destCode: 'JFK',
          waypoint: 'GREAT LAKES',
          landed: '35m ago',
          gate: 'Gate 8 (T1)',
          standard,
          statusTag: 'DOMESTIC ARRIVAL CONFIRMED',
        };
      case 'AIR-001':
      default: {
        const dest = currentRecord?.Airport_Code || 'DEL';
        const origin = dest === 'DEL' ? 'BOM' : (dest === 'BOM' ? 'DEL' : 'DXB');
        return {
          tail,
          model,
          route: `${origin} → ${dest}`,
          originCode: origin,
          destCode: dest,
          waypoint: 'WAYPOINT',
          landed: '14m ago',
          gate: 'Apron Stand 42B',
          standard,
          statusTag: 'AIRBORNE TOUCHDOWN CONFIRMED',
        };
      }
    }
  }, [analyticsResult, activeAircraft, recommendationResult, uploadedManualName, currentRecord]);

  // Filtered signal trends
  const filteredSignals = useMemo(() => {
    return historicalAnalysis.filter((sig) => {
      if (!sig) return false;
      const colName = sig.column || sig.signal || '';
      const query = (signalSearch || '').toLowerCase().trim();
      const matchesSearch = !query ||
        colName.toLowerCase().includes(query.replace(/\s+/g, '_')) ||
        colName.toLowerCase().includes(query);
      const trendDir = sig.trend_direction || sig.trend || 'STABLE';
      if (signalFilter === 'ALL') return matchesSearch;
      return matchesSearch && trendDir === signalFilter;
    });
  }, [historicalAnalysis, signalSearch, signalFilter]);

  // Executive KPI Metrics
  const metrics = useMemo(() => {
    if (!analyticsResult?.summary) return [];

    const summary = analyticsResult.summary;
    const analysis = summary.historical_analysis || [];
    const riskSignal = analysis.find((item) => (item.column === 'Risk_Score' || item.signal?.includes('Risk')));
    const vibrationSignal = analysis.find((item) => (item.column === 'Engine_Vibration' || item.signal?.includes('Vibration')));
    const rulSignal = analysis.find((item) => (item.column === 'Remaining_Useful_Life' || item.signal?.includes('Life') || item.signal?.includes('Remaining')));
    const record = summary.current_record || {};

    const riskVal = riskSignal ? (riskSignal.latest_value ?? riskSignal.value) : (record.Risk_Score ?? 0);
    const rulVal = rulSignal ? (rulSignal.latest_value ?? rulSignal.value) : (record.Remaining_Useful_Life ?? 0);
    const vibVal = vibrationSignal ? (vibrationSignal.latest_value ?? vibrationSignal.value) : (record.Engine_Vibration ?? 0);

    return [
      {
        icon: '✈️',
        label: 'Aircraft Tail',
        value: analyticsResult.aircraft_id || 'N/A',
        sub: record.Aircraft_Model || 'Airbus A320neo',
        accent: 'cyan',
        badge: 'ACTIVE TAIL',
      },
      {
        icon: '⚙️',
        label: 'Propulsion Unit',
        value: record.Engine_Model || 'CFM LEAP-1A',
        sub: `Airport Base: ${record.Airport_Code || 'DEL'}`,
        accent: 'blue',
        badge: 'TURBOFAN',
      },
      {
        icon: '🔄',
        label: 'Flight Cycle',
        value: summary.latest_flight_cycle != null ? Number(summary.latest_flight_cycle).toLocaleString() : 'N/A',
        sub: `${record.Flight_Hours || 0} flight hours total`,
        accent: 'sky',
        badge: 'CYCLES',
      },
      {
        icon: '🔧',
        label: 'Since Overhaul',
        value: record.Cycles_Since_Overhaul != null ? `${record.Cycles_Since_Overhaul} cyc` : 'N/A',
        sub: `Last: ${record.Last_Maintenance_Date || '2026-10-28'}`,
        accent: 'teal',
        badge: 'INSPECTED',
      },
      {
        icon: '⚠️',
        label: 'Composite Risk',
        value: riskVal ? `${Number(riskVal).toFixed(1)}` : 'N/A',
        sub: riskSignal ? `${riskSignal.change_percent > 0 ? '+' : ''}${riskSignal.change_percent.toFixed(1)}% vs baseline` : 'Telemetry index',
        accent: riskVal > 70 ? 'red' : riskVal > 50 ? 'amber' : 'green',
        badge: riskVal > 70 ? 'CRITICAL' : riskVal > 50 ? 'CAUTION' : 'NOMINAL',
      },
      {
        icon: '🛡️',
        label: 'Remaining Life',
        value: rulVal ? `${rulVal} cyc` : 'N/A',
        sub: rulSignal ? `${rulSignal.change_percent > 0 ? '+' : ''}${rulSignal.change_percent.toFixed(1)}% delta` : 'Cycles to retirement',
        accent: rulVal <= 15 ? 'red' : rulVal <= 35 ? 'amber' : 'green',
        badge: rulVal <= 15 ? 'EXPIRING' : rulVal <= 35 ? 'SCHEDULE' : 'HEALTHY',
      },
      {
        icon: '📳',
        label: 'Shaft Vibration',
        value: vibVal ? `${Number(vibVal).toFixed(2)} mm/s` : 'N/A',
        sub: vibrationSignal ? `Trend: ${vibrationSignal.trend_direction}` : 'Max limit: 5.50 mm/s',
        accent: vibVal > 5.5 ? 'red' : vibVal > 4.5 ? 'orange' : 'teal',
        badge: vibVal > 5.5 ? 'BREACH' : vibVal > 4.5 ? 'CAUTION' : 'STABLE',
      },
      {
        icon: '📡',
        label: 'Monitored Signals',
        value: historicalAnalysis.length,
        sub: `Rolling window: ${analyticsResult.summary.historical_window_size || 10} flights`,
        accent: 'violet',
        badge: 'AVIONICS',
      },
      {
        icon: '🌡️',
        label: 'Ambient / Cabin',
        value: currentRecord.Ambient_Temperature != null ? `${Number(currentRecord.Ambient_Temperature).toFixed(1)}°C` : 'N/A',
        sub: `Relative Humidity: ${currentRecord.Humidity ?? 'N/A'}%`,
        accent: 'sky',
        badge: 'WEATHER',
      },
    ];
  }, [analyticsResult, currentRecord, historicalAnalysis]);

  // Engine Gauges with precision warnings
  const engineGauges = useMemo(() => {
    if (!currentRecord) return [];
    return [
      { label: 'Engine Temp', value: currentRecord.Engine_Temperature, unit: '°C', max: 900, warn: 750, crit: 820 },
      { label: 'Exhaust Gas (EGT)', value: currentRecord.Exhaust_Gas_Temperature, unit: '°C', max: 850, warn: 700, crit: 760 },
      { label: 'Scavenge Oil Temp', value: currentRecord.Oil_Temperature, unit: '°C', max: 150, warn: 110, crit: 135 },
      { label: 'Main Oil Pressure', value: currentRecord.Oil_Pressure, unit: 'psi', max: 70, minWarn: 45, minCrit: 35, isMinCheck: true },
      { label: 'Core N1 / N2 RPM', value: currentRecord.Engine_RPM, unit: 'RPM', max: 12000, warn: 10200, crit: 11000 },
      { label: 'Fuel Flow Rate', value: currentRecord.Fuel_Flow, unit: 'kg/h', max: 3200, warn: 2700, crit: 3000 },
      { label: 'Compressor Press.', value: currentRecord.Compressor_Pressure, unit: 'psi', max: 55, warn: 48, crit: 52 },
      { label: 'Hydraulic System', value: currentRecord.Hydraulic_Pressure, unit: 'psi', max: 3600, warn: 3250, minCrit: 2600, crit: 3400 },
    ];
  }, [currentRecord]);

  const getGaugeStatus = (gauge) => {
    const val = gauge.value;
    if (val == null) return { level: 'level-ok', statusText: 'NORMAL', pct: 0 };

    if (gauge.isMinCheck) {
      if (val < (gauge.minCrit || 35)) return { level: 'level-danger', statusText: 'CRITICAL LOW', pct: Math.min((val / gauge.max) * 100, 100) };
      if (val < (gauge.minWarn || 45)) return { level: 'level-warn', statusText: 'CAUTION LOW', pct: Math.min((val / gauge.max) * 100, 100) };
      return { level: 'level-ok', statusText: 'OPTIMAL', pct: Math.min((val / gauge.max) * 100, 100) };
    }

    if (val >= (gauge.crit || 99999)) return { level: 'level-danger', statusText: 'LIMIT EXCEEDED', pct: Math.min((val / gauge.max) * 100, 100) };
    if (val >= (gauge.warn || 99999)) return { level: 'level-warn', statusText: 'WARNING THRESHOLD', pct: Math.min((val / gauge.max) * 100, 100) };
    return { level: 'level-ok', statusText: 'NOMINAL', pct: Math.min((val / gauge.max) * 100, 100) };
  };

  const getDecisionBadge = (decisionObj) => {
    const decision = typeof decisionObj?.decision === 'string' ? decisionObj.decision : String(decisionObj || '');
    if (decision.includes('GROUND')) {
      return {
        bg: 'decision-ground',
        icon: '🚫',
        title: 'AIRCRAFT GROUNDED — MANDATORY MAINTENANCE REQUIRED',
        desc: 'Immediate maintenance intervention required. All flight releases are revoked until corrective work order sign-off.',
      };
    }
    if (decision.includes('MAINTENANCE') || decision.includes('REPAIR')) {
      return {
        bg: 'decision-maint',
        icon: '⚠️',
        title: 'MAINTENANCE REQUIRED BEFORE NEXT FLIGHT',
        desc: 'Inspection and borescope surveys required before subsequent flight release.',
      };
    }
    if (decision.includes('MONITOR')) {
      return {
        bg: 'decision-monitor',
        icon: '🟡',
        title: 'CLEARED TO FLY WITH ACTIVE TELEMETRY MONITORING',
        desc: 'Cleared for commercial revenue flight with enhanced sensor telemetry recording.',
      };
    }
    return {
      bg: 'decision-cleared',
      icon: '✅',
      title: 'CLEARED TO FLY — AIRWORTHY',
      desc: 'All monitored mechanical, thermal, and hydraulic parameters satisfy ATX200 manual standards.',
    };
  };

  const decisionBadgeInfo = recommendationSummary?.final_flight_decision
    ? getDecisionBadge(recommendationSummary.final_flight_decision)
    : null;

  return (
    <div className="app-shell">
      {/* ============================================================== */}
      {/* 1. TOP COMMAND BAR                                             */}
      {/* ============================================================== */}
      <header ref={topbarRef} className="topbar">
        <div className="topbar-glow" aria-hidden="true" />
        <div className="brand-zone">
          <div className="brand-logo" aria-hidden="true">
            <svg viewBox="0 0 42 42" width="42" height="42" className="hud-logo-svg">
              <circle cx="21" cy="21" r="20" fill="none" stroke="rgba(34, 211, 238, 0.25)" strokeWidth="1.5" strokeDasharray="4 2" />
              <circle cx="21" cy="21" r="14" fill="none" stroke="rgba(167, 139, 250, 0.4)" strokeWidth="1" />
              <circle cx="21" cy="21" r="3" fill="#22d3ee" className="hud-center-dot" />
              <line x1="21" y1="1" x2="21" y2="7" stroke="#22d3ee" strokeWidth="1.5" />
              <line x1="21" y1="35" x2="21" y2="41" stroke="#22d3ee" strokeWidth="1.5" />
              <line x1="1" y1="21" x2="7" y2="21" stroke="#22d3ee" strokeWidth="1.5" />
              <line x1="35" y1="21" x2="41" y2="21" stroke="#22d3ee" strokeWidth="1.5" />
              <path d="M21 10 L24 20 L32 24 L24 25 L23 31 L21 29 L19 31 L18 25 L10 24 L18 20 Z" fill="url(#logoGrad)" />
              <defs>
                <linearGradient id="logoGrad" x1="0" y1="0" x2="42" y2="42">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="50%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#a78bfa" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="brand-text">
            <div className="brand-title-row">
              <span className="brand-name-aero">AERO</span>
              <span className="brand-name-care">CARE</span>
              <span className="brand-badge-pro">INTELLIGENCE</span>
            </div>
            <p className="brand-sub">Post-Landing Fleet Telemetry & Predictive Maintenance Ground Station</p>
          </div>
        </div>

        {/* Telemetry Clocks & System Status */}
        <div className="topbar-right">
          <div className="clock-capsule">
            <div className="clock-item">
              <span className="clock-label">UTC ZULU</span>
              <span className="clock-time mono">{zuluTime || '00:00:00Z'}</span>
            </div>
            <div className="clock-divider" />
            <div className="clock-item">
              <span className="clock-label">LOCAL IST</span>
              <span className="clock-time mono">{localTime || '00:00:00'}</span>
            </div>
          </div>

          <div className="status-capsule">
            <span className="status-ping-ring" />
            <span className="status-text">{status}</span>
          </div>
        </div>
      </header>

      {/* ============================================================== */}
      {/* 2. FLEET SELECTOR & TACTICAL HUD STRIP                        */}
      {/* ============================================================== */}
      <section className="fleet-hud-strip">
        <div className="fleet-tabs-bar">
          <span className="fleet-tab-label">FLEET SQUADRON:</span>
          <div className="fleet-pills">
            {availableAircraft.map((tail) => {
              const isSelected = activeAircraft === tail;
              return (
                <button
                  key={tail}
                  className={`fleet-pill ${isSelected ? 'active' : ''}`}
                  onClick={() => handleSelectAircraft(tail)}
                  disabled={isLoading}
                >
                  <span className="fleet-pill-icon">✈️</span>
                  <span className="fleet-pill-id">{tail}</span>
                  {tail === 'AIR-001' && <span className="fleet-pill-tag tag-ground">ALERT</span>}
                  {tail !== 'AIR-001' && <span className="fleet-pill-tag tag-warn">MAINT</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tactical Radar HUD Display */}
        <div className="hud-radar-card">
          <div className="hud-radar-left">
            <div className="hud-callout-tag">{flightInfo.statusTag}</div>
            <h3>
              Flight {flightInfo.tail} ({flightInfo.model})
            </h3>
            <div className="hud-flight-details">
              <span>📍 Route: <strong>{flightInfo.route}</strong></span>
              <span>⏱️ Landed: <strong>{flightInfo.landed}</strong></span>
              <span>GATE: <strong>{flightInfo.gate}</strong></span>
              <span>STANDARD: <strong>{flightInfo.standard}</strong></span>
            </div>
          </div>

          <div className="hud-radar-visual">
            <svg viewBox="0 0 340 100" className="tactical-svg" preserveAspectRatio="xMidYMid meet">
              <defs>
                <linearGradient id="vectorGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.2" />
                  <stop offset="50%" stopColor="#2dd4bf" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#34d399" stopOpacity="0.4" />
                </linearGradient>
                <radialGradient id="beaconGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="1" />
                  <stop offset="60%" stopColor="#22d3ee" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Grid radar rings */}
              <circle cx="170" cy="50" r="45" fill="none" stroke="rgba(56, 189, 248, 0.08)" strokeDasharray="3 3" />
              <circle cx="170" cy="50" r="30" fill="none" stroke="rgba(56, 189, 248, 0.12)" strokeDasharray="2 2" />

              {/* Flight descent trajectory */}
              <path d="M 20 75 Q 120 10 200 48 T 320 28" fill="none" stroke="url(#vectorGrad)" strokeWidth="2.5" strokeDasharray="6 3" />

              {/* Origin node */}
              <circle cx="20" cy="75" r="4" fill="#38bdf8" />
              <text x="20" y="92" fontSize="9" fill="#7a9bbd" textAnchor="middle" fontFamily="monospace">
                {flightInfo.originCode}
              </text>

              {/* En route waypoint */}
              <circle cx="200" cy="48" r="4" fill="#2dd4bf" />
              <text x="200" y="65" fontSize="8" fill="#516a85" textAnchor="middle" fontFamily="monospace">
                {flightInfo.waypoint}
              </text>

              {/* Touchdown node */}
              <circle cx="320" cy="28" r="5" fill="#34d399" />
              <text x="320" y="45" fontSize="9" fill="#34d399" textAnchor="middle" fontWeight="bold" fontFamily="monospace">
                {flightInfo.destCode} (LANDED)
              </text>

              {/* Moving Airplane SVG Icon */}
              <g className="animated-aircraft-vector">
                <circle cx="200" cy="48" r="14" fill="url(#beaconGlow)" opacity="0.6" />
                <path d="M 194 48 L 198 42 L 204 42 L 208 48 L 206 50 L 202 50 L 200 54 L 198 54 L 199 50 L 195 50 Z" fill="#e0f2fe" />
              </g>
            </svg>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 3. EXECUTIVE KPI METRICS DECK (3x3 Grid)                       */}
      {/* ============================================================== */}
      <section className="metrics-deck">
        <div className="metric-row">
          {metrics.map((metric) => (
            <div className={`metric-card ${metric.accent}`} key={metric.label}>
              <div className="metric-header-row">
                <span className="metric-icon">{metric.icon}</span>
                <span className="metric-badge-tag">{metric.badge}</span>
              </div>
              <span className="metric-label">{metric.label}</span>
              <strong className="metric-value mono">{metric.value}</strong>
              <small className="metric-sub">{metric.sub}</small>
            </div>
          ))}
        </div>
      </section>

      {/* Error notification if any */}
      {error && (
        <div ref={errorBannerRef} className="error-banner">
          <span className="error-icon">⚠️</span>
          <div className="error-text">
            <strong>System Advisory:</strong> {error}
          </div>
          <button className="error-dismiss-btn" onClick={() => setError('')}>✕</button>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. MAIN DUAL COMMAND DASHBOARD (Analytics & Maintenance AI)   */}
      {/* ============================================================== */}
      <div className="split-view">
        {/* ------------------------------------------------------------ */}
        {/* LEFT COLUMN: TELEMETRY & ENGINEERING GAUGES                  */}
        {/* ------------------------------------------------------------ */}
        <div className="command-col">
          <PanelCard
            title="Telemetry Diagnostics & Sensor Feeds"
            subtitle="Continuous sensor telemetry stream compared against baseline window"
            accent="cyan"
            badge={<span className="panel-badge-pill">SENSORS ONLINE</span>}
          >
            {/* Aircraft Header Bar */}
            <div className="aircraft-header">
              <div className="aircraft-avatar">✈️</div>
              <div className="aircraft-info">
                <h4>
                  {analyticsResult?.aircraft_id || 'AIR-001'} — {currentRecord?.Aircraft_Model || 'Airbus A320neo'}
                </h4>
                <div className="aircraft-meta">
                  <span>🔧 CFM LEAP-1A Turbofan</span>
                  <span>📍 Hub: {currentRecord?.Airport_Code || 'DEL'}</span>
                  <span>🔄 Cycle #{analyticsResult?.summary?.latest_flight_cycle || '100'}</span>
                  <span>⏱️ {currentRecord?.Flight_Hours || 340} Total Hours</span>
                </div>
              </div>
            </div>

            {/* 8 Avionics Engine Gauges */}
            <div className="section-title-row">
              <h5>PRIMARY PROPULSION & HYDRAULIC MONITORS</h5>
              <span className="section-note">8 ACTIVE SENSORS</span>
            </div>

            <div className="gauge-grid">
              {engineGauges.map((gauge) => {
                const { level, statusText, pct } = getGaugeStatus(gauge);
                return (
                  <div className={`gauge-card ${level}`} key={gauge.label}>
                    <div className="gauge-top-row">
                      <span className="gauge-label">{gauge.label}</span>
                      <span className={`gauge-status-chip ${level}`}>{statusText}</span>
                    </div>

                    <div className="gauge-value-row">
                      <span className="gauge-value mono">
                        {gauge.value != null ? Number(gauge.value).toLocaleString() : 'N/A'}
                      </span>
                      <span className="gauge-unit">{gauge.unit}</span>
                    </div>

                    <div className="gauge-bar-track">
                      <div className={`gauge-bar-fill ${level}`} style={{ width: `${Math.max(pct, 5)}%` }} />
                    </div>

                    <div className="gauge-threshold-labels">
                      <span>0 {gauge.unit}</span>
                      <span>MAX {gauge.max}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Multi-Flight Trend Analysis Table */}
            <div className="section-title-row" style={{ marginTop: '20px' }}>
              <h5>STATISTICAL HISTORICAL TRENDS (10-FLIGHT WINDOW)</h5>
              <span className="section-note">{filteredSignals.length} SIGNALS</span>
            </div>

            {/* Filter & Search Bar */}
            <div className="signal-controls-bar">
              <div className="search-input-wrapper">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Search sensor (e.g. Vibration, Oil, EGT)..."
                  value={signalSearch}
                  onChange={(e) => setSignalSearch(e.target.value)}
                  className="signal-search-input"
                />
              </div>

              <div className="filter-pill-group">
                {['ALL', 'INCREASING', 'DECREASING', 'STABLE'].map((f) => (
                  <button
                    key={f}
                    className={`filter-chip ${signalFilter === f ? 'active' : ''}`}
                    onClick={() => setSignalFilter(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Signal Trends List */}
            <div className="signal-list">
              <div className="signal-row table-head">
                <span>TELEMETRY PARAMETER</span>
                <span style={{ textAlign: 'right' }}>RECORDED</span>
                <span style={{ textAlign: 'right' }}>HIST. AVG</span>
                <span style={{ textAlign: 'right' }}>DELTA</span>
                <span style={{ textAlign: 'center' }}>DIRECTION</span>
              </div>

              {filteredSignals.map((item, idx) => {
                const colName = item.column || item.signal || `Signal_${idx}`;
                const dir = item.trend_direction || item.trend || 'STABLE';
                const isInc = dir === 'INCREASING';
                const isDec = dir === 'DECREASING';
                const delta = item.change_percent ?? item.slope ?? 0;
                const latestVal = item.latest_value ?? item.projected_next ?? item.value;

                return (
                  <div key={colName} className="signal-row">
                    <span className="signal-name">{String(colName).replace(/_/g, ' ')}</span>
                    <span className="signal-value mono">{latestVal != null ? Number(latestVal).toLocaleString() : 'N/A'}</span>
                    <span className="signal-avg mono">{item.historical_average != null ? Number(item.historical_average).toLocaleString() : 'N/A'}</span>
                    <span className={`signal-change mono ${delta > 0 ? 'positive' : delta < 0 ? 'negative' : ''}`}>
                      {delta > 0 ? '+' : ''}{Number(delta).toFixed(1)}%
                    </span>
                    <span className={`trend-badge ${dir.toLowerCase()}`}>
                      <span className="trend-arrow">{isInc ? '↑' : isDec ? '↓' : '→'}</span>
                      {dir}
                    </span>
                  </div>
                );
              })}
            </div>
          </PanelCard>

          {/* Dual Upload Card: Excel Telemetry + PDF Manual */}
          <PanelCard
            title="Upload Flight Telemetry & Maintenance Manual"
            subtitle="Import aircraft telemetry (.xlsx) and custom maintenance manual (.pdf) for verification"
            accent="blue"
            badge={<span className="panel-badge-pill">DUAL INTAKE</span>}
          >
            <form onSubmit={handleSubmitUpload} className="upload-form">
              <div className="dual-dropzone-grid">
                {/* 1. Excel Telemetry File Dropzone */}
                <label className={`file-dropzone ${excelFile ? 'has-file' : ''}`}>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
                  />
                  <div className="dropzone-content">
                    <span className="dropzone-icon">📊</span>
                    <div className="dropzone-text">
                      <strong>{excelFile ? 'Change Excel File' : 'Upload Flight Telemetry'}</strong>
                    </div>
                    <span className="dropzone-hint">Excel export (.xlsx, .xls)</span>
                  </div>
                </label>

                {/* 2. PDF Maintenance Manual Dropzone */}
                <label className={`file-dropzone ${manualFile ? 'has-file' : ''}`}>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setManualFile(e.target.files?.[0] || null)}
                  />
                  <div className="dropzone-content">
                    <span className="dropzone-icon">📕</span>
                    <div className="dropzone-text">
                      <strong>{manualFile ? 'Change PDF Manual' : 'Upload Maintenance Manual'}</strong>
                    </div>
                    <span className="dropzone-hint">Aviation manual (.pdf)</span>
                  </div>
                </label>
              </div>

              {/* Selected Files Summary Pill Row */}
              <div className="selected-files-summary">
                <div className={`file-status-tag ${excelFile ? 'active' : 'default'}`}>
                  <span className="file-tag-icon">📊</span>
                  <div className="file-tag-info">
                    <span className="file-tag-type">TELEMETRY DATASET:</span>
                    <strong className="file-tag-name">
                      {excelFile ? `${excelFile.name} (${Math.round(excelFile.size / 1024)} KB)` : 'No file chosen'}
                    </strong>
                  </div>
                  {excelFile && (
                    <button type="button" className="file-clear-btn" onClick={() => setExcelFile(null)} title="Clear file">✕</button>
                  )}
                </div>

                <div className={`file-status-tag ${manualFile ? 'active' : 'default'}`}>
                  <span className="file-tag-icon">📕</span>
                  <div className="file-tag-info">
                    <span className="file-tag-type">MAINTENANCE MANUAL / REPORT:</span>
                    <strong className="file-tag-name">
                      {manualFile ? `${manualFile.name} (${Math.round(manualFile.size / 1024)} KB)` : 'No file chosen'}
                    </strong>
                  </div>
                  {(manualFile || uploadedManualName) && (
                    <button
                      type="button"
                      className="file-clear-btn"
                      onClick={() => {
                        setManualFile(null);
                        setUploadedManualName('');
                      }}
                      title="Clear file"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {error && (
                <div className="upload-inline-alert">
                  <span className="alert-icon">⚠️</span>
                  <div className="alert-text">
                    <strong>Upload Required:</strong> {error}
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="primary-btn run-btn glow-btn"
                disabled={isLoading}
              >
                {isLoading && loadingPhase === 'analytics' ? (
                  <>
                    <span className="btn-spinner" /> Processing Data & Manual...
                  </>
                ) : (
                  '⚡ Process & Benchmark (Excel + PDF)'
                )}
              </button>
            </form>
          </PanelCard>
        </div>

        {/* ------------------------------------------------------------ */}
        {/* RIGHT COLUMN: AI & ATX200 MAINTENANCE DECISION BOARD         */}
        {/* ------------------------------------------------------------ */}
        <div className="command-col">
          <PanelCard
            title="AeroTech ATX200 Maintenance & Flight Release"
            subtitle="Deterministic limit benchmarking & AI-assisted airworthiness decision"
            accent="ai"
            badge={
              <span className="panel-badge ai-badge">
                <span className="ai-sparkle">✨</span>
                ATX200 ENGINE
              </span>
            }
          >
            {/* Generate Action Trigger Bar */}
            <div className="ai-trigger-banner">
              <div className="trigger-copy">
                <strong>Ready for Maintenance Analysis</strong>
                <p>Evaluate 14 telemetry channels against AeroTech ATX200 Manual standards</p>
              </div>

              <button
                className="primary-btn ai-btn glow-btn"
                onClick={handleGenerateRecommendation}
                disabled={isLoading || !analyticsResult}
              >
                {isLoading && loadingPhase === 'ai' ? (
                  <>
                    <span className="btn-spinner" /> Evaluating ATX200 Standards...
                  </>
                ) : (
                  '✨ Run ATX200 Maintenance Engine'
                )}
              </button>
            </div>

            {/* AI Decision Panel Content */}
            {recommendationSummary ? (
              <div className="recommendation-panel">
                {/* 1. HERO FLIGHT DECISION BANNER */}
                {decisionBadgeInfo && (
                  <div className={`hero-decision-card ${decisionBadgeInfo.bg}`}>
                    <div className="decision-glow-bar" />
                    <div className="hero-decision-top">
                      <div className="decision-avatar-ring">{decisionBadgeInfo.icon}</div>
                      <div className="hero-decision-titles">
                        <span className="decision-eyebrow">FINAL AIRWORTHINESS DISPOSITION</span>
                        <h3 className="decision-main-title">{decisionBadgeInfo.title}</h3>
                        <p className="decision-main-desc">{decisionBadgeInfo.desc}</p>
                      </div>
                    </div>

                    {/* Official Release Statement */}
                    {recommendationSummary.final_flight_decision?.ui_statement && (
                      <div className="decision-statement-box">
                        <span className="statement-tag">DISPATCH STATEMENT:</span>
                        <p>{recommendationSummary.final_flight_decision.ui_statement}</p>
                      </div>
                    )}

                    {/* Mandatory before flight */}
                    {recommendationSummary.final_flight_decision?.required_before_next_flight && (
                      <div className="decision-requirement-chip">
                        <span>⚠️ MANDATORY ACTION BEFORE NEXT CYCLE:</span>{' '}
                        <strong>{recommendationSummary.final_flight_decision.required_before_next_flight}</strong>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. STATUS BADGES BAR */}
                <div className="status-banner">
                  <span className={`status-badge ${recommendationSummary.health_status === 'SAFE' ? 'ok' : 'critical'}`}>
                    <span className="badge-dot" />
                    STATUS: {recommendationSummary.health_status}
                  </span>
                  <span className={`status-badge risk-${(recommendationSummary.risk_level || 'medium').toLowerCase()}`}>
                    <span className="badge-dot" />
                    RISK LEVEL: {recommendationSummary.risk_level}
                  </span>
                  <span className="status-badge cert-badge">
                    <span className="badge-dot" />
                    MANUAL: ATX200-STD-REV4
                  </span>
                </div>

                {/* 3. INTERACTIVE SECTION TABS */}
                <div className="ai-tabs-nav">
                  <button
                    className={`ai-tab-btn ${activeAiTab === 'all' ? 'active' : ''}`}
                    onClick={() => setActiveAiTab('all')}
                  >
                    All Reports
                  </button>
                  <button
                    className={`ai-tab-btn ${activeAiTab === 'violations' ? 'active' : ''}`}
                    onClick={() => setActiveAiTab('violations')}
                  >
                    Violations ({recommendationSummary.threshold_violations?.length || 0})
                  </button>
                  <button
                    className={`ai-tab-btn ${activeAiTab === 'rootcause' ? 'active' : ''}`}
                    onClick={() => setActiveAiTab('rootcause')}
                  >
                    Root Cause
                  </button>
                  <button
                    className={`ai-tab-btn ${activeAiTab === 'actions' ? 'active' : ''}`}
                    onClick={() => setActiveAiTab('actions')}
                  >
                    Action Plan ({recommendationSummary.maintenance_actions?.length || 0})
                  </button>
                  <button
                    className={`ai-tab-btn ${activeAiTab === 'checklist' ? 'active' : ''}`}
                    onClick={() => setActiveAiTab('checklist')}
                  >
                    Checklist ({completedSteps.size}/{recommendationSummary.inspection_checklist?.length || 0})
                  </button>
                  <button
                    className={`ai-tab-btn ${activeAiTab === 'workorder' ? 'active' : ''}`}
                    onClick={() => setActiveAiTab('workorder')}
                  >
                    Work Order
                  </button>
                </div>

                {/* Overall Summary Card */}
                {recommendationSummary.overall_summary && (activeAiTab === 'all' || activeAiTab === 'violations') && (
                  <div className="overall-summary">
                    <div className="summary-title-badge">CHIEF ENGINEER AUDIT SUMMARY</div>
                    <p>{recommendationSummary.overall_summary}</p>
                  </div>
                )}

                {/* A. THRESHOLD VIOLATIONS */}
                {(activeAiTab === 'all' || activeAiTab === 'violations') && (
                  <div className="report-block">
                    <div className="block-head">
                      <h4>⚠️ Manual Threshold Exceedances</h4>
                      <span className="block-counter">{recommendationSummary.threshold_violations?.length || 0} Breaches</span>
                    </div>

                    {recommendationSummary.threshold_violations?.length > 0 ? (
                      <div className="violations-grid">
                        {recommendationSummary.threshold_violations.map((v, i) => {
                          const paramName = v.parameter || v.signal || 'Airworthiness Compliance';
                          const observed = v.observed_value != null ? v.observed_value : (v.value != null ? `${v.value} ${v.unit || ''}`.trim() : 'Inspection Due');
                          const threshold = v.manual_threshold || (v.limit != null ? `≤ ${v.limit} ${v.unit || ''}`.trim() : 'Mandatory Limit');
                          const explanation = v.explanation || v.rule_description || '';
                          const manualRef = v.manual_reference || '';
                          const severity = v.severity || 'CRITICAL';

                          return (
                            <div className={`violation-card ${severity.toLowerCase()}`} key={i}>
                              <div className="violation-header">
                                <span className="violation-param">{String(paramName).replace(/_/g, ' ')}</span>
                                <span className={`violation-severity ${severity.toLowerCase()}`}>{severity}</span>
                              </div>

                              <div className="violation-values-grid">
                                <div className="violation-val">
                                  <label>Recorded Signal</label>
                                  <span className="val-observed mono">{String(observed)}</span>
                                </div>
                                <div className="violation-val">
                                  <label>Allowable Limit</label>
                                  <span className="val-threshold mono">{String(threshold)}</span>
                                </div>
                              </div>

                              {explanation && <div className="violation-explanation">{explanation}</div>}
                              {manualRef && <span className="manual-ref">📖 {manualRef}</span>}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="nominal-clean-box">
                        <span className="check-icon">✓</span>
                        <span>Zero threshold violations detected across all 14 monitored telemetry channels.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* B. ROOT CAUSE & EVIDENCE */}
                {(activeAiTab === 'all' || activeAiTab === 'rootcause') && recommendationSummary.root_cause && (
                  <div className="report-block">
                    <div className="block-head">
                      <h4>🔍 Root Cause & Fault Isolation</h4>
                    </div>

                    <div className="root-cause-card">
                      <div className="cause-badge">DIAGNOSED FAILURE MODE</div>
                      <div className="cause-title">{recommendationSummary.root_cause.most_likely_cause}</div>

                      <div className="evidence-header">SUPPORTING TELEMETRY EVIDENCE:</div>
                      <ul className="evidence-list">
                        {(recommendationSummary.root_cause.supporting_evidence || []).map((e, i) => (
                          <li key={i}>
                            <span className="evidence-bullet">▸</span> {e}
                          </li>
                        ))}
                      </ul>

                      {recommendationSummary.root_cause.manual_reference && (
                        <span className="manual-ref">📖 {recommendationSummary.root_cause.manual_reference}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* C. MAINTENANCE ACTIONS */}
                {(activeAiTab === 'all' || activeAiTab === 'actions') && recommendationSummary.maintenance_actions?.length > 0 && (
                  <div className="report-block">
                    <div className="block-head">
                      <h4>🔧 Prescribed Engineering Actions</h4>
                      <span className="block-counter">{recommendationSummary.maintenance_actions.length} Directives</span>
                    </div>

                    <div className="actions-list">
                      {recommendationSummary.maintenance_actions.map((act, i) => (
                        <div className="action-item" key={i}>
                          <div className={`action-priority p${act.priority}`}>P{act.priority}</div>
                          <div className="action-content">
                            <div className="action-text">{act.action}</div>
                            <div className="action-reason">{act.reason}</div>
                            {act.manual_reference && <span className="manual-ref">📖 {act.manual_reference}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* D. INTERACTIVE CHECKLIST */}
                {(activeAiTab === 'all' || activeAiTab === 'checklist') && recommendationSummary.inspection_checklist?.length > 0 && (
                  <div className="report-block">
                    <div className="block-head">
                      <h4>📋 Interactive Line Maintenance Inspection Checklist</h4>
                      <span className="block-counter">
                        {completedSteps.size} of {recommendationSummary.inspection_checklist.length} Completed
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="checklist-progress-bar">
                      <div
                        className="checklist-progress-fill"
                        style={{
                          width: `${(completedSteps.size / recommendationSummary.inspection_checklist.length) * 100}%`,
                        }}
                      />
                    </div>

                    <div className="checklist-section">
                      {recommendationSummary.inspection_checklist.map((item, i) => {
                        const isDone = completedSteps.has(item.step);
                        return (
                          <div
                            className={`checklist-item ${isDone ? 'done' : ''}`}
                            key={i}
                            onClick={() => toggleChecklistStep(item.step)}
                          >
                            <div className={`checklist-step-box ${isDone ? 'checked' : ''}`}>
                              {isDone ? '✓' : item.step}
                            </div>
                            <div className="checklist-content">
                              <div className="check-title">{item.inspection_item}</div>
                              <div className="check-criteria">
                                <strong>Acceptance Criteria:</strong> {item.acceptance_criteria}
                              </div>
                              {item.manual_reference && <span className="manual-ref">📖 {item.manual_reference}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* E. OFFICIAL WORK ORDER */}
                {(activeAiTab === 'all' || activeAiTab === 'workorder') && recommendationSummary.work_order && (
                  <div className="report-block print-zone">
                    <div className="block-head">
                      <h4>📝 Official Aircraft Maintenance Work Order</h4>
                      <button className="secondary-btn print-btn" onClick={handlePrintWorkOrder}>
                        🖨️ Print / Save PDF
                      </button>
                    </div>

                    <div className="work-order-card">
                      <div className="wo-header-bar">
                        <div className="wo-header-left">
                          <span className="wo-label">WORK ORDER AUTHORIZATION</span>
                          <h3>{recommendationSummary.work_order.title}</h3>
                        </div>
                        <span className={`wo-priority-pill ${recommendationSummary.work_order.priority?.toLowerCase()}`}>
                          {recommendationSummary.work_order.priority} PRIORITY
                        </span>
                      </div>

                      <div className="wo-meta-grid">
                        <div className="wo-meta-item">
                          <label>AIRCRAFT REGISTRATION</label>
                          <span className="mono">{recommendationSummary.work_order.aircraft_id}</span>
                        </div>
                        <div className="wo-meta-item">
                          <label>MAINTENANCE ORDER TYPE</label>
                          <span>{recommendationSummary.work_order.work_order_type}</span>
                        </div>
                        <div className="wo-meta-item">
                          <label>ALLOCATED WORK CATEGORY</label>
                          <span>{recommendationSummary.work_order.estimated_maintenance_category}</span>
                        </div>
                        <div className="wo-meta-item">
                          <label>CONFIDENCE SCORE</label>
                          <span className="mono">{Math.round((recommendationSummary.confidence?.score || 0.95) * 100)}% Verified</span>
                        </div>
                      </div>

                      {recommendationSummary.work_order.tasks?.length > 0 && (
                        <div className="wo-tasks-box">
                          <label>SCHEDULED MAINTENANCE TASKS</label>
                          <ul className="wo-tasks">
                            {recommendationSummary.work_order.tasks.map((task, i) => (
                              <li key={i}>{task}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {(recommendationSummary.work_order.required_parts_or_tools ||
                        recommendationSummary.work_order['required parts or tools'])?.length > 0 && (
                        <div className="wo-parts-box">
                          <label>REQUIRED TOOLS, TEST RIGS & CONSUMABLES</label>
                          <div className="wo-parts">
                            {(
                              recommendationSummary.work_order.required_parts_or_tools ||
                              recommendationSummary.work_order['required parts or tools']
                            ).map((part, i) => (
                              <span className="wo-part-tag" key={i}>
                                📦 {part}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="wo-sign-footer">
                        <div className="wo-sign-col">
                          <span>LICENSED B1/B2 ENGINEER:</span>
                          <div className="wo-sign-line" />
                        </div>
                        <div className="wo-sign-col">
                          <span>RELEASE TO SERVICE DATE:</span>
                          <div className="wo-sign-line" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-state-card">
                <div className="radar-sweep-icon">🎯</div>
                <h4>Awaiting ATX200 Evaluation</h4>
                <p>
                  Telemetry data is loaded. Click <strong>"Run ATX200 Maintenance Engine"</strong> above to evaluate all 14 sensor signals against internal AeroTech maintenance manuals.
                </p>
              </div>
            )}
          </PanelCard>
        </div>
      </div>
    </div>
  );
}

export default App;
