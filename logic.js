/**
 * Smart Student Performance Advisory System - Analysis Logic
 * Pure JavaScript: risk score, peer comparison, consistency, recommendations, what-if simulation.
 */

// Peer data loaded from data.json
let peerData = [];

/**
 * Load peer dataset from data.json via fetch
 */
async function loadPeerData() {
  try {
    const res = await fetch('data.json');
    if (!res.ok) throw new Error('Failed to load data');
    peerData = await res.json();
    if (!Array.isArray(peerData)) peerData = [];
    return true;
  } catch (e) {
    console.error(e);
    const el = document.getElementById('dataError');
    if (el) el.style.display = 'flex';
    return false;
  }
}

/**
 * Read and normalize form values into a single inputs object
 */
function getFormInputs() {
  const assignmentRadio = document.querySelector('input[name="assignment"]:checked');
  return {
    attendance: parseFloat(document.getElementById('attendance').value) || 0,
    studyHours: parseFloat(document.getElementById('studyHours').value) || 0,
    internalMarks: parseFloat(document.getElementById('internalMarks').value) || 0,
    assignment: assignmentRadio ? assignmentRadio.value === 'yes' : false,
    previousGPA: parseFloat(document.getElementById('previousGPA').value) || 0,
    participation: parseInt(document.getElementById('participation').value, 10) || 1
  };
}

/**
 * Validate inputs; show errors and return false if invalid
 */
function validateInputs(inputs) {
  const errors = {};
  if (inputs.attendance < 0 || inputs.attendance > 100) errors.attendance = 'Enter 0–100';
  if (inputs.studyHours < 0 || inputs.studyHours > 24) errors.studyHours = 'Enter 0–24';
  if (inputs.internalMarks < 0 || inputs.internalMarks > 100) errors.internalMarks = 'Enter 0–100';
  if (inputs.previousGPA < 0 || inputs.previousGPA > 4) errors.previousGPA = 'Enter 0–4';
  if (inputs.participation < 1 || inputs.participation > 5) errors.participation = 'Enter 1–5';

  // Clear previous errors
  ['attendance', 'studyHours', 'internalMarks', 'previousGPA', 'participation'].forEach(id => {
    const el = document.getElementById('err-' + id);
    if (el) el.textContent = '';
  });
  Object.keys(errors).forEach(id => {
    const el = document.getElementById('err-' + id);
    if (el) el.textContent = errors[id];
  });

  return Object.keys(errors).length === 0;
}

/**
 * Compute risk score (0–100) and level: Safe (0–25), Warning (26–50), High Risk (51+)
 * Higher score = higher risk. Based on inverted normalized metrics and weights.
 */
function computeRiskScore(inputs) {
  const a = inputs.attendance / 100;           // 0–1, higher better
  const s = Math.min(inputs.studyHours / 8, 1); // cap at 8 hrs
  const m = inputs.internalMarks / 100;
  const g = inputs.previousGPA / 4;
  const p = (inputs.participation - 1) / 4;     // 1–5 -> 0–1
  const asg = inputs.assignment ? 1 : 0;

  // Risk = weighted sum of "lack" of each factor (1 - value), then scale to 0–100
  const weights = { attendance: 0.25, study: 0.2, internal: 0.2, gpa: 0.15, participation: 0.1, assignment: 0.1 };
  const risk = (
    (1 - a) * weights.attendance +
    (1 - s) * weights.study +
    (1 - m) * weights.internal +
    (1 - g) * weights.gpa +
    (1 - p) * weights.participation +
    (1 - asg) * weights.assignment
  ) * 100;
  const score = Math.round(Math.max(0, Math.min(100, risk)));

  let level = 'safe';
  if (score >= 51) level = 'high-risk';
  else if (score >= 26) level = 'warning';

  return { score, level };
}

/**
 * Performance Consistency Index: how uniform the student's metrics are (0–100).
 * High consistency = all metrics similarly strong or weak; mixed metrics = lower index.
 */
function computeConsistency(inputs) {
  const a = inputs.attendance / 100;
  const s = Math.min(inputs.studyHours / 8, 1);
  const m = inputs.internalMarks / 100;
  const g = inputs.previousGPA / 4;
  const p = (inputs.participation - 1) / 4;
  const asg = inputs.assignment ? 1 : 0;
  const values = [a, s, m, g, p, asg];
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(variance);
  // Low std = high consistency. Map std 0 -> 100, std ~0.5 -> ~0
  const consistency = Math.round(Math.max(0, Math.min(100, 100 - std * 200)));
  const label = consistency >= 70 ? 'Stable' : consistency >= 40 ? 'Moderate' : 'Variable';
  return { value: consistency, label };
}

/**
 * Peer benchmarking: compare current inputs to dataset averages
 */
function getPeerComparison(inputs, data) {
  if (!data || data.length === 0) return [];
  const n = data.length;
  const sum = (key) => data.reduce((s, o) => s + (typeof o[key] === 'number' ? o[key] : (o[key] === true || o[key] === 'yes' ? 1 : 0)), 0);
  const avg = (key, asPct) => {
    const v = sum(key) / n;
    return asPct ? Math.round(v * 100) : (key === 'assignment' ? Math.round(v * 100) : Math.round(v * 10) / 10);
  };

  const assignmentsPct = avg('assignment', false);
  const getVal = (key, inputs) => {
    if (key === 'assignment') return inputs.assignment ? 100 : 0;
    return inputs[key];
  };
  const fmt = (key, val, peerVal) => {
    if (key === 'assignment') return { you: inputs.assignment ? 'Yes' : 'No', avg: assignmentsPct + '% submitted' };
    if (key === 'previousGPA') return { you: val.toFixed(1), avg: peerVal.toFixed(1) };
    if (key === 'participation') return { you: val, avg: peerVal };
    return { you: val + (key === 'attendance' || key === 'internalMarks' ? '%' : ''), avg: peerVal + (key === 'attendance' || key === 'internalMarks' ? '%' : ' hrs') };
  };

  const keys = ['attendance', 'studyHours', 'internalMarks', 'previousGPA', 'participation', 'assignment'];
  const labels = { attendance: 'Attendance', studyHours: 'Study hrs/day', internalMarks: 'Internal marks', previousGPA: 'Previous GPA', participation: 'Participation (1–5)', assignment: 'Assignment' };
  const peerAvgs = {
    attendance: avg('attendance'),
    studyHours: avg('studyHours'),
    internalMarks: avg('internalMarks'),
    previousGPA: avg('previousGPA'),
    participation: avg('participation'),
    assignment: assignmentsPct
  };

  return keys.map(key => ({
    key,
    label: labels[key],
    you: getVal(key, inputs),
    avg: key === 'assignment' ? peerAvgs.assignment : peerAvgs[key],
    display: fmt(key, getVal(key, inputs), key === 'assignment' ? peerAvgs.assignment : peerAvgs[key])
  }));
}

/**
 * Habit–performance correlation: which factor has the most impact on risk (using same weights as risk formula)
 */
function getHabitCorrelation(inputs) {
  const base = computeRiskScore(inputs).score;
  const factors = [
    { name: 'Attendance', key: 'attendance', delta: (i) => ({ ...i, attendance: Math.min(100, i.attendance + 10) }) },
    { name: 'Study hours', key: 'studyHours', delta: (i) => ({ ...i, studyHours: Math.min(24, i.studyHours + 1) }) },
    { name: 'Internal marks', key: 'internalMarks', delta: (i) => ({ ...i, internalMarks: Math.min(100, i.internalMarks + 10) }) },
    { name: 'Previous GPA', key: 'previousGPA', delta: (i) => ({ ...i, previousGPA: Math.min(4, i.previousGPA + 0.3) }) },
    { name: 'Participation', key: 'participation', delta: (i) => ({ ...i, participation: Math.min(5, i.participation + 1) }) },
    { name: 'Assignment submitted', key: 'assignment', delta: (i) => ({ ...i, assignment: true }) }
  ];
  let best = { name: 'Attendance', impact: 0 };
  factors.forEach(f => {
    const modified = f.delta(inputs);
    const newScore = computeRiskScore(modified).score;
    const impact = base - newScore;
    if (impact > best.impact) best = { name: f.name, impact };
  });
  return 'Most impactful factor: ' + best.name + '. Improving it would lower your risk the most.';
}

/**
 * Personalized recommendations based on risk level and weak metrics
 */
function getRecommendations(inputs, riskLevel) {
  const tips = [];
  if (inputs.attendance < 80) tips.push('Increase attendance to at least 85% to reduce risk.');
  if (inputs.studyHours < 4) tips.push('Aim for 5+ study hours per day for better outcomes.');
  if (inputs.internalMarks < 70) tips.push('Focus on internal assessments; target 75% or higher.');
  if (!inputs.assignment) tips.push('Submit all assignments on time to improve your profile.');
  if (inputs.previousGPA < 3) tips.push('Build on previous semester; consider extra revision and practice.');
  if (inputs.participation < 4) tips.push('Increase class participation (aim for 4–5) to boost engagement.');
  if (riskLevel === 'high-risk') tips.unshift('Your risk is high. Prioritize attendance and study hours first.');
  if (riskLevel === 'warning') tips.unshift('You are in the warning zone. Address the items below to move to Safe.');
  if (tips.length === 0) tips.push('Keep up the good work. Maintain current habits and consistency.');
  return tips;
}

/**
 * Run full analysis and update the results dashboard
 */
function runAnalysis() {
  const inputs = getFormInputs();
  if (!validateInputs(inputs)) return;

  const { score, level } = computeRiskScore(inputs);
  const consistency = computeConsistency(inputs);
  const peerRows = getPeerComparison(inputs, peerData);
  const habitInsight = getHabitCorrelation(inputs);
  const recommendations = getRecommendations(inputs, level);

  // Show dashboard
  const dashboard = document.getElementById('resultsDashboard');
  if (dashboard) dashboard.classList.add('visible');

  // Risk level & meter
  const badge = document.getElementById('riskLevelBadge');
  const meterFill = document.getElementById('riskMeterFill');
  const scoreText = document.getElementById('riskScoreText');
  if (badge) {
    badge.textContent = level === 'safe' ? 'Safe Zone' : level === 'warning' ? 'Warning Zone' : 'High Risk';
    badge.className = 'risk-badge ' + level.replace('-', '-');
  }
  if (meterFill) {
    meterFill.style.width = score + '%';
    meterFill.className = 'risk-meter-fill ' + level.replace('-', '-');
  }
  if (scoreText) scoreText.textContent = 'Risk Score: ' + score + ' / 100';

  // Consistency
  const consistencyVal = document.getElementById('consistencyValue');
  const consistencyLabel = document.getElementById('consistencyLabel');
  if (consistencyVal) consistencyVal.textContent = consistency.value;
  if (consistencyLabel) consistencyLabel.textContent = consistency.label + ' — ' + (consistency.value >= 70 ? 'Your metrics are evenly balanced.' : consistency.value >= 40 ? 'Some areas are stronger than others.' : 'Mixed strengths; focus on weaker areas.');

  // Habit insight
  const habitEl = document.getElementById('habitInsight');
  if (habitEl) habitEl.textContent = habitInsight;

  // Peer comparison
  const peerList = document.getElementById('peerComparison');
  if (peerList) {
    peerList.innerHTML = peerRows.map(r => {
      let you = r.key === 'assignment' ? (r.you ? 'Yes' : 'No') : (r.key === 'previousGPA' ? Number(r.you).toFixed(1) : r.you);
      if (r.key === 'studyHours') you = you + ' hrs';
      if (r.key === 'attendance' || r.key === 'internalMarks') you = you + '%';
      let avg = r.key === 'assignment' ? r.avg + '% submitted' : (r.key === 'previousGPA' ? Number(r.avg).toFixed(1) : r.avg);
      if (r.key === 'studyHours') avg = avg + ' hrs';
      if (r.key === 'attendance' || r.key === 'internalMarks') avg = avg + '%';
      return '<li><span class="you">' + r.label + ': ' + you + '</span> <span class="avg">vs avg ' + avg + '</span></li>';
    }).join('');
  }

  // Recommendations
  const recList = document.getElementById('recommendations');
  if (recList) recList.innerHTML = recommendations.map(r => '<li>' + r + '</li>').join('');

  // Early warning
  const earlyBlock = document.getElementById('earlyWarningBlock');
  const earlyContent = document.getElementById('earlyWarningContent');
  if (earlyBlock && earlyContent) {
    if (level === 'warning' || level === 'high-risk') {
      earlyBlock.style.display = 'block';
      earlyContent.className = level === 'high-risk' ? 'alert alert-danger' : 'alert alert-warning';
      earlyContent.textContent = level === 'high-risk'
        ? 'Early Warning: Your risk level indicates high academic risk. Please review recommendations and consider speaking with an advisor.'
        : 'Early Warning: Your risk level is in the warning zone. Address the suggested improvements to avoid further risk.';
    } else {
      earlyBlock.style.display = 'none';
    }
  }

  // What-if: reset projection message; keep inputs for simulate
  const whatifResult = document.getElementById('whatifResult');
  if (whatifResult) {
    whatifResult.style.display = 'none';
    whatifResult.innerHTML = '';
  }

  // Store current inputs for what-if (same object reference not needed; we read form again in simulate)
  window._lastInputs = inputs;
  window._lastLevel = level;
  window._lastScore = score;
}

/**
 * What-if simulation: add optional attendance and study hours, then show projected risk
 */
function runWhatIf() {
  const inputs = getFormInputs();
  const addAtt = parseFloat(document.getElementById('whatifAttendance').value) || 0;
  const addStudy = parseFloat(document.getElementById('whatifStudyHours').value) || 0;
  const projected = {
    ...inputs,
    attendance: Math.min(100, inputs.attendance + addAtt),
    studyHours: Math.min(24, inputs.studyHours + addStudy)
  };
  const { score, level } = computeRiskScore(projected);
  const levelText = level === 'safe' ? 'Safe Zone' : level === 'warning' ? 'Warning Zone' : 'High Risk';
  const whatifResult = document.getElementById('whatifResult');
  if (whatifResult) {
    whatifResult.style.display = 'block';
    whatifResult.innerHTML = '<strong>Projected Risk:</strong> ' + levelText + ' (Score: ' + score + '/100). ' +
      (addAtt > 0 ? 'With +' + addAtt + '% attendance. ' : '') +
      (addStudy > 0 ? 'With +' + addStudy + ' study hours. ' : '');
  }
}

// Initialize: load peer data and attach handlers
document.addEventListener('DOMContentLoaded', () => {
  loadPeerData();
  const form = document.getElementById('analysisForm');
  if (form) form.addEventListener('submit', (e) => { e.preventDefault(); runAnalysis(); });
  const btnSimulate = document.getElementById('btnSimulate');
  if (btnSimulate) btnSimulate.addEventListener('click', runWhatIf);
});
