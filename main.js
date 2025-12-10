/***************************************************
 * main.js - Single Frontend JS File
 * - Google OAuth (GIS) login (HRMS portal)
 * - Simple API client
 * - Role-based tiles & Phase-1+ UIs:
 *   EA: Raise Requirement
 *   HR: Review Requirements, Upload CVs, Shortlisting, Call Screening,
 *       Owner Discussion, Schedule Interviews, Walk-ins (Today)
 *   ADMIN/EA: Tests (Excel/Tally/Voice)
 *   PUBLIC: Candidate Walk-in Form (token-based, random math)
 ***************************************************/

// CONFIG
const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbxh0etYDCdS7JmluGDhIjJT5JdI6GAtE0UyfTjIDon4OBXbryr5FIN73KCZYhW74jc_Zg/exec';
const GOOGLE_CLIENT_ID = '1029752642188-ku0k9krbdbsttj9br238glq8h4k5loj3.apps.googleusercontent.com';

let currentUser = null;
let idToken = null;
let jobTemplatesCache = [];
let hrReqCache = [];

// HR call screening
let currentCallCandId = null;

// Walk-in form (public) state
let currentWalkinToken = null;
let walkinQuestions = [];

/***************************************************
 * DOM refs (HRMS portal)
 ***************************************************/
const loginSection = document.getElementById('loginSection');
const appSection   = document.getElementById('appSection');
const userInfoEl   = document.getElementById('userInfo');
const roleTilesEl  = document.getElementById('roleTiles');

// EA panel refs
const panelRequirementsEA = document.getElementById('panelRequirementsEA');
const reqJobRole      = document.getElementById('reqJobRole');
const reqJobTitle     = document.getElementById('reqJobTitle');
const reqResp         = document.getElementById('reqResponsibilities');
const reqMust         = document.getElementById('reqMustHave');
const reqShift        = document.getElementById('reqShift');
const reqPay          = document.getElementById('reqPayScale');
const reqPerks        = document.getElementById('reqPerks');
const reqNotes        = document.getElementById('reqNotes');
const btnCreateReq    = document.getElementById('btnCreateRequirement');

// HR: Review Requirements
const panelReqListHR   = document.getElementById('panelReqListHR');
const reqListContainer = document.getElementById('reqListContainer');

// HR: Upload CVs
const panelUploadCVsHR = document.getElementById('panelUploadCVsHR');
const uploadReqSelect  = document.getElementById('uploadReqSelect');
const cvListInput      = document.getElementById('cvListInput');
const btnUploadCVs     = document.getElementById('btnUploadCVs');
const cvUploadProgress = document.getElementById('cvUploadProgress');

// HR: Shortlisting
const panelShortlistHR        = document.getElementById('panelShortlistHR');
const shortlistReqSelect      = document.getElementById('shortlistReqSelect');
const btnLoadShortlist        = document.getElementById('btnLoadShortlist');
const shortlistTableContainer = document.getElementById('shortlistTableContainer');

// HR: Call Screening
const panelCallScreenHR  = document.getElementById('panelCallScreenHR');
const callReqSelect      = document.getElementById('callReqSelect');
const btnLoadCallList    = document.getElementById('btnLoadCallList');
const callListContainer  = document.getElementById('callListContainer');
const callEditor         = document.getElementById('callEditor');
const callCandName       = document.getElementById('callCandName');
const callFamilyNotes    = document.getElementById('callFamilyNotes');
const callStatusSelect   = document.getElementById('callStatusSelect');
const callComm10         = document.getElementById('callComm10');
const callExp10          = document.getElementById('callExp10');
const callRemark         = document.getElementById('callRemark');
const btnSaveCallDetails = document.getElementById('btnSaveCallDetails');

// HR: Owner Discussion + Schedule
const panelOwnerDiscussHR      = document.getElementById('panelOwnerDiscussHR');
const panelScheduleInterviewHR = document.getElementById('panelScheduleInterviewHR');

// Owner discussion controls
const ownerReqSelect        = document.getElementById('ownerReqSelect');
const btnLoadOwnerList      = document.getElementById('btnLoadOwnerList');
const ownerDiscussContainer = document.getElementById('ownerDiscussContainer');

// Schedule interview controls
const schedReqSelect    = document.getElementById('schedReqSelect');
const btnLoadSchedule   = document.getElementById('btnLoadSchedule');
const scheduleContainer = document.getElementById('scheduleContainer');

// HR: Walk-ins (today)
const panelWalkinsHR      = document.getElementById('panelWalkinsHR');
const walkinsDateInput    = document.getElementById('walkinsDateInput');
const btnLoadWalkins      = document.getElementById('btnLoadWalkins');
const walkinsContainer    = document.getElementById('walkinsContainer');

// Admin/EA: Tests panel
const panelTests       = document.getElementById('panelTests');
const testsReqSelect   = document.getElementById('testsReqSelect');
const btnLoadTests     = document.getElementById('btnLoadTests');
const testsContainer   = document.getElementById('testsContainer');

/***************************************************
 * DOM refs (PUBLIC Candidate Walk-in Form page)
 ***************************************************/
const walkinFormRoot      = document.getElementById('walkinFormRoot');
const wkCandidateNameEl   = document.getElementById('wkCandidateName');
const wkJobPostEl         = document.getElementById('wkJobPost');
const wkQuestionContainer = document.getElementById('wkQuestionContainer');
const wkStatusMsg         = document.getElementById('wkStatusMsg');
const btnWalkinSubmit     = document.getElementById('btnWalkinSubmit');

/***************************************************
 * INIT
 ***************************************************/
window.addEventListener('load', () => {
  initGoogleLoginIfPresent();
  initWalkinFormIfNeeded();
});

function initGoogleLoginIfPresent() {
  const gisDiv = document.getElementById('g_id_signin');
  if (!gisDiv) return; // walk-in page pe GIS nahi chalega

  if (window.google && window.google.accounts && window.google.accounts.id) {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse
    });
    google.accounts.id.renderButton(
      gisDiv,
      { theme: "outline", size: "large" }
    );
  } else {
    console.error('Google Identity Services not loaded');
  }
}

/***************************************************
 * Google Credential callback
 ***************************************************/
function handleCredentialResponse(response) {
  idToken = response.credential;
  apiGet('me')
    .then(res => {
      if (res.success) {
        currentUser = res.user;
        onLoginSuccess();
      } else {
        alert('Access denied: ' + (res.error || 'Unknown error'));
      }
    })
    .catch(err => {
      console.error(err);
      alert('Login failed. Please contact MIS.');
    });
}

/***************************************************
 * API Helpers
 ***************************************************/
async function apiGet(action, params = {}) {
  params.action = action;
  if (idToken) {
    params.idToken = idToken;
  }
  const query = new URLSearchParams(params).toString();
  const url = `${API_BASE_URL}?${query}`;
  const res = await fetch(url);
  return res.json();
}

async function apiPost(action, data = {}) {
  const body = {
    action,
    idToken,
    data
  };
  const res = await fetch(API_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  return res.json();
}

/***************************************************
 * Login success: show HRMS UI
 ***************************************************/
function onLoginSuccess() {
  if (!loginSection || !appSection || !userInfoEl) return;

  loginSection.classList.add('hidden');
  appSection.classList.remove('hidden');

  userInfoEl.innerHTML = `
    <span style="font-size:12px;">${currentUser.name} (${currentUser.role})</span>
    <button style="font-size:11px;margin-left:8px;padding:4px 8px;border-radius:999px;" onclick="logout()">Logout</button>
  `;

  renderRoleTiles();
  if (currentUser.role === 'EA' || currentUser.role === 'ADMIN') {
    loadJobTemplates();
  }
  if (currentUser.role === 'HR' || currentUser.role === 'ADMIN') {
    loadRequirementsForHR();
  }
}

function logout() {
  idToken = null;
  currentUser = null;
  location.reload();
}

/***************************************************
 * Tiles (module selector)
 ***************************************************/
function renderRoleTiles() {
  if (!roleTilesEl) return;
  roleTilesEl.innerHTML = '';

  // EA tiles
  if (currentUser.role === 'EA' || currentUser.role === 'ADMIN') {
    addTile('Raise Requirement', 'Create new hiring requirements', () => {
      showPanel('EA_REQUIREMENT');
    });

    addTile('Tests Panel', 'Enter Excel / Tally / Voice marks', () => {
      showPanel('TESTS_PANEL');
      ensureHRReqDropdowns();
    });
  }

  // HR tiles
  if (currentUser.role === 'HR' || currentUser.role === 'ADMIN') {
    addTile('Review Requirements', 'Validate or send back requirements', () => {
      showPanel('HR_REQUIREMENT_REVIEW');
      loadRequirementsForHR();
    });

    addTile('Upload CVs', 'Batch upload CVs for a requirement', () => {
      showPanel('HR_UPLOAD_CVS');
      ensureHRReqDropdowns();
    });

    addTile('Shortlisting', 'First glance approve / reject CVs', () => {
      showPanel('HR_SHORTLIST');
      ensureHRReqDropdowns();
    });

    addTile('Call Screening', 'On-call discussion & scoring', () => {
      showPanel('HR_CALL_SCREEN');
      ensureHRReqDropdowns();
    });

    addTile('Discuss with Owners', 'Owner approval / hold for walk-ins', () => {
      showPanel('HR_OWNER_DISCUSS');
      ensureHRReqDropdowns();
    });

    addTile('Schedule Interviews', 'Finalize interview date & time', () => {
      showPanel('HR_SCHEDULE_INTERVIEW');
      ensureHRReqDropdowns();
    });

    addTile('Walk-ins (Today)', 'Today ke interviews & walk-ins', () => {
      showPanel('HR_WALKINS');
      initWalkinsDateToToday();
      loadWalkinsForSelectedDate();
    });
  }
}

function addTile(title, sub, onClick) {
  const div = document.createElement('div');
  div.className = 'tile';
  div.innerHTML = `
    <div class="tile-title">${title}</div>
    <div class="tile-sub">${sub}</div>
  `;
  div.addEventListener('click', onClick);
  roleTilesEl.appendChild(div);
}

function showPanel(panelKey) {
  // HRMS panels hi exist karenge index.html par
  const panels = [
    panelRequirementsEA,
    panelReqListHR,
    panelUploadCVsHR,
    panelShortlistHR,
    panelCallScreenHR,
    panelOwnerDiscussHR,
    panelScheduleInterviewHR,
    panelWalkinsHR,
    panelTests
  ];
  panels.forEach(p => p && p.classList.add('hidden'));

  switch (panelKey) {
    case 'EA_REQUIREMENT':
      panelRequirementsEA && panelRequirementsEA.classList.remove('hidden');
      break;
    case 'HR_REQUIREMENT_REVIEW':
      panelReqListHR && panelReqListHR.classList.remove('hidden');
      break;
    case 'HR_UPLOAD_CVS':
      panelUploadCVsHR && panelUploadCVsHR.classList.remove('hidden');
      break;
    case 'HR_SHORTLIST':
      panelShortlistHR && panelShortlistHR.classList.remove('hidden');
      break;
    case 'HR_CALL_SCREEN':
      panelCallScreenHR && panelCallScreenHR.classList.remove('hidden');
      break;
    case 'HR_OWNER_DISCUSS':
      panelOwnerDiscussHR && panelOwnerDiscussHR.classList.remove('hidden');
      break;
    case 'HR_SCHEDULE_INTERVIEW':
      panelScheduleInterviewHR && panelScheduleInterviewHR.classList.remove('hidden');
      break;
    case 'HR_WALKINS':
      panelWalkinsHR && panelWalkinsHR.classList.remove('hidden');
      break;
    case 'TESTS_PANEL':
      panelTests && panelTests.classList.remove('hidden');
      break;
  }
}

/***************************************************
 * EA: Job Templates & Create Requirement
 ***************************************************/
async function loadJobTemplates() {
  try {
    const res = await apiGet('get_job_templates');
    if (res.success) {
      jobTemplatesCache = res.data || [];
      fillJobRoleDropdown();
    } else {
      console.error(res.error);
    }
  } catch (err) {
    console.error(err);
  }
}

function fillJobRoleDropdown() {
  if (!reqJobRole) return;
  reqJobRole.innerHTML = '<option value="">Select Job Role</option>';
  jobTemplatesCache.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.JobRole;
    opt.textContent = t.JobRole;
    reqJobRole.appendChild(opt);
  });

  reqJobRole.addEventListener('change', () => {
    const role = reqJobRole.value;
    const template = jobTemplatesCache.find(t => t.JobRole === role);
    if (template) {
      reqJobTitle.value = template.JobTitleDefault || '';
      reqResp.value     = template.ResponsibilitiesDefault || '';
      reqMust.value     = template.MustHaveDefault || '';
      reqShift.value    = template.ShiftDefault || '';
      reqPay.value      = template.PayScaleDefault || '';
      reqPerks.value    = template.PerksDefault || '';
      reqNotes.value    = template.NotesDefault || '';
    } else {
      reqJobTitle.value = '';
      reqResp.value = '';
      reqMust.value = '';
      reqShift.value = '';
      reqPay.value = '';
      reqPerks.value = '';
      reqNotes.value = '';
    }
  });
}

btnCreateReq && btnCreateReq.addEventListener('click', async () => {
  if (!reqJobRole.value) {
    alert('Please select Job Role');
    return;
  }
  btnCreateReq.disabled = true;
  btnCreateReq.textContent = 'Creating...';

  try {
    const payload = {
      jobRole: reqJobRole.value,
      jobTitle: reqJobTitle.value,
      responsibilities: reqResp.value,
      mustHave: reqMust.value,
      shift: reqShift.value,
      payScale: reqPay.value,
      perks: reqPerks.value,
      notes: reqNotes.value
    };
    const res = await apiPost('create_requirement', payload);
    if (res.success) {
      alert('Requirement created: ' + res.requirementId);
      reqJobRole.value = '';
      reqJobTitle.value = '';
      reqResp.value = '';
      reqMust.value = '';
      reqShift.value = '';
      reqPay.value = '';
      reqPerks.value = '';
      reqNotes.value = '';
    } else {
      alert('Error: ' + res.error);
    }
  } catch (err) {
    console.error(err);
    alert('Error creating requirement');
  } finally {
    btnCreateReq.disabled = false;
    btnCreateReq.textContent = 'Create Requirement';
  }
});

/***************************************************
 * HR Requirements cache helpers
 ***************************************************/
function fillHRReqDropdowns() {
  const selects = [
    uploadReqSelect,
    shortlistReqSelect,
    callReqSelect,
    ownerReqSelect,
    schedReqSelect,
    testsReqSelect
  ];
  selects.forEach(sel => {
    if (!sel) return;
    sel.innerHTML = '<option value="">Select Requirement</option>';
    hrReqCache.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.RequirementId;
      opt.textContent = `${r.RequirementId} · ${r.JobRole} · ${r.JobTitle}`;
      sel.appendChild(opt);
    });
  });
}

async function ensureHRReqDropdowns() {
  if (hrReqCache.length) {
    fillHRReqDropdowns();
    return;
  }
  try {
    const res = await apiGet('list_requirements');
    if (res.success) {
      hrReqCache = res.data || [];
      fillHRReqDropdowns();
    }
  } catch (err) {
    console.error(err);
  }
}

/***************************************************
 * HR: Review Requirements (Valid / Send Back)
 ***************************************************/
async function loadRequirementsForHR() {
  if (!(currentUser && (currentUser.role === 'HR' || currentUser.role === 'ADMIN'))) return;
  if (!reqListContainer) return;

  reqListContainer.innerHTML = 'Loading requirements...';

  try {
    const res = await apiGet('list_requirements');
    if (!res.success) {
      reqListContainer.innerHTML = 'Error: ' + res.error;
      return;
    }

    const rows = res.data || [];
    hrReqCache = rows;
    fillHRReqDropdowns();

    if (!rows.length) {
      reqListContainer.innerHTML = 'No requirements found.';
      return;
    }

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>ID</th>
        <th>Job Role</th>
        <th>Job Title</th>
        <th>Status</th>
        <th>Actions</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    rows.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.RequirementId}</td>
        <td>${r.JobRole}</td>
        <td>${r.JobTitle}</td>
        <td><span class="badge">${r.Status || ''}</span></td>
        <td></td>
      `;
      const tdActions = tr.querySelector('td:last-child');

      const btnValid = document.createElement('button');
      btnValid.textContent = 'Valid';
      btnValid.style.fontSize = '11px';
      btnValid.style.padding = '4px 6px';
      btnValid.addEventListener('click', () => {
        hrUpdateRequirementStatus(r.RequirementId, 'VALID');
      });

      const btnSendBack = document.createElement('button');
      btnSendBack.textContent = 'Send Back';
      btnSendBack.style.fontSize = '11px';
      btnSendBack.style.padding = '4px 6px';
      btnSendBack.style.marginLeft = '4px';
      btnSendBack.addEventListener('click', () => {
        const remark = prompt('Send-back remark for EA:');
        if (remark !== null) {
          hrUpdateRequirementStatus(r.RequirementId, 'SEND_BACK', remark);
        }
      });

      tdActions.appendChild(btnValid);
      tdActions.appendChild(btnSendBack);

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    reqListContainer.innerHTML = '';
    reqListContainer.appendChild(table);

  } catch (err) {
    console.error(err);
    reqListContainer.innerHTML = 'Error loading requirements.';
  }
}

async function hrUpdateRequirementStatus(requirementId, status, remark='') {
  try {
    const res = await apiPost('update_requirement_status', {
      requirementId,
      status,
      hrRemark: remark
    });
    if (res.success) {
      alert('Updated: ' + requirementId + ' → ' + status);
      loadRequirementsForHR();
    } else {
      alert('Error: ' + res.error);
    }
  } catch (err) {
    console.error(err);
    alert('Failed to update requirement');
  }
}

/***************************************************
 * HR: Upload CVs (batch)
 ***************************************************/
btnUploadCVs && btnUploadCVs.addEventListener('click', async () => {
  const reqId = uploadReqSelect.value;
  if (!reqId) {
    alert('Please select a requirement.');
    return;
  }

  const raw = cvListInput.value.trim();
  if (!raw) {
    alert('Please paste CV list (FileName, FileURL) line by line.');
    return;
  }

  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) {
    alert('No valid lines found.');
    return;
  }

  const files = [];
  for (const line of lines) {
    const parts = line.split(',');
    if (parts.length < 2) continue;
    const fileName = parts[0].trim();
    const fileUrl  = parts.slice(1).join(',').trim();
    if (!fileName || !fileUrl) continue;
    files.push({ fileName, fileUrl });
  }

  if (!files.length) {
    alert('No valid "FileName, FileURL" entries parsed.');
    return;
  }

  cvUploadProgress.textContent = `Uploading ${files.length} CVs...`;
  btnUploadCVs.disabled = true;

  try {
    const res = await apiPost('batch_upload_cvs', {
      requirementId: reqId,
      files
    });

    if (res.success) {
      cvUploadProgress.textContent = `Uploaded ${files.length} CVs successfully. Candidates: ${
        (res.candidates || []).join(', ')
      }`;
      cvListInput.value = '';
    } else {
      cvUploadProgress.textContent = 'Error: ' + res.error;
    }
  } catch (err) {
    console.error(err);
    cvUploadProgress.textContent = 'Error uploading CVs.';
  } finally {
    btnUploadCVs.disabled = false;
  }
});

/***************************************************
 * HR: Shortlisting
 ***************************************************/
btnLoadShortlist && btnLoadShortlist.addEventListener('click', async () => {
  const reqId = shortlistReqSelect.value;
  if (!reqId) {
    alert('Please select requirement.');
    return;
  }
  await loadShortlistCandidates(reqId);
});

async function loadShortlistCandidates(reqId) {
  shortlistTableContainer.innerHTML = 'Loading candidates...';
  try {
    const res = await apiGet('list_applicants_by_requirement', { requirementId: reqId });
    if (!res.success) {
      shortlistTableContainer.innerHTML = 'Error: ' + res.error;
      return;
    }

    const list = (res.data || []).filter(c =>
      c.Status === 'UPLOADED' || c.Status === 'SHORTLISTED'
    );
    if (!list.length) {
      shortlistTableContainer.innerHTML = 'No CVs found for shortlisting.';
      return;
    }

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>Candidate ID</th>
        <th>Name</th>
        <th>Mobile</th>
        <th>Source</th>
        <th>Status</th>
        <th>Actions</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    list.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${c.CandidateId}</td>
        <td>${c.CandidateName}</td>
        <td>${c.Mobile}</td>
        <td>${c.Source}</td>
        <td><span class="badge">${c.Status}</span></td>
        <td></td>
      `;
      const tdActions = tr.querySelector('td:last-child');

      const btnApprove = document.createElement('button');
      btnApprove.textContent = 'Approve';
      btnApprove.style.fontSize = '11px';
      btnApprove.style.padding = '4px 6px';
      btnApprove.addEventListener('click', () => {
        shortlistDecision(c.CandidateId, 'APPROVE');
      });

      const btnReject = document.createElement('button');
      btnReject.textContent = 'Reject';
      btnReject.style.fontSize = '11px';
      btnReject.style.padding = '4px 6px';
      btnReject.style.marginLeft = '4px';
      btnReject.addEventListener('click', () => {
        const remark = prompt('Rejection remark (Shortlisting):');
        if (remark !== null) {
          shortlistDecision(c.CandidateId, 'REJECT', remark);
        }
      });

      tdActions.appendChild(btnApprove);
      tdActions.appendChild(btnReject);
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    shortlistTableContainer.innerHTML = '';
    shortlistTableContainer.appendChild(table);

  } catch (err) {
    console.error(err);
    shortlistTableContainer.innerHTML = 'Error loading candidates.';
  }
}

async function shortlistDecision(candidateId, decision, remark='') {
  try {
    const res = await apiPost('shortlist_decision', {
      candidateId,
      decision,
      remark
    });
    if (res.success) {
      alert(`Updated ${candidateId} → ${decision}`);
      const reqId = shortlistReqSelect.value;
      if (reqId) {
        loadShortlistCandidates(reqId);
      }
    } else {
      alert('Error: ' + res.error);
    }
  } catch (err) {
    console.error(err);
    alert('Failed to update decision.');
  }
}

/***************************************************
 * HR: Call Screening
 ***************************************************/
btnLoadCallList && btnLoadCallList.addEventListener('click', async () => {
  const reqId = callReqSelect.value;
  if (!reqId) {
    alert('Please select requirement.');
    return;
  }
  await loadCallScreenCandidates(reqId);
});

async function loadCallScreenCandidates(reqId) {
  callListContainer.innerHTML = 'Loading candidates...';
  callEditor.classList.add('hidden');
  currentCallCandId = null;

  try {
    const res = await apiGet('list_applicants_by_requirement', { requirementId: reqId });
    if (!res.success) {
      callListContainer.innerHTML = 'Error: ' + res.error;
      return;
    }

    const list = (res.data || []).filter(c => c.Status === 'SHORTLISTED');
    if (!list.length) {
      callListContainer.innerHTML = 'No candidates for call screening.';
      return;
    }

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>Candidate ID</th>
        <th>Name</th>
        <th>Mobile</th>
        <th>Source</th>
        <th>Open</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    list.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${c.CandidateId}</td>
        <td>${c.CandidateName}</td>
        <td>${c.Mobile}</td>
        <td>${c.Source}</td>
        <td></td>
      `;
      const tdOpen = tr.querySelector('td:last-child');
      const btnOpen = document.createElement('button');
      btnOpen.textContent = 'Open';
      btnOpen.style.fontSize = '11px';
      btnOpen.style.padding = '4px 6px';
      btnOpen.addEventListener('click', () => {
        openCallEditor(c);
      });
      tdOpen.appendChild(btnOpen);
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    callListContainer.innerHTML = '';
    callListContainer.appendChild(table);

  } catch (err) {
    console.error(err);
    callListContainer.innerHTML = 'Error loading candidates.';
  }
}

function openCallEditor(candidate) {
  currentCallCandId = candidate.CandidateId;
  callCandName.textContent = `${candidate.CandidateName} (${candidate.Mobile})`;
  callFamilyNotes.value = '';
  callStatusSelect.value = '';
  callComm10.value = '';
  callExp10.value = '';
  callRemark.value = '';
  callEditor.classList.remove('hidden');
}

btnSaveCallDetails && btnSaveCallDetails.addEventListener('click', async () => {
  if (!currentCallCandId) {
    alert('No candidate selected.');
    return;
  }

  const familyNotes = callFamilyNotes.value.trim();
  const callStatus  = callStatusSelect.value;
  const comm10      = callComm10.value;
  const exp10       = callExp10.value;
  const remark      = callRemark.value.trim();

  if (!callStatus) {
    alert('Please select Call Status.');
    return;
  }

  const cVal = Number(comm10);
  const eVal = Number(exp10);
  if (isNaN(cVal) || isNaN(eVal) || cVal < 0 || cVal > 10 || eVal < 0 || eVal > 10) {
    alert('Marks should be between 0 and 10.');
    return;
  }

  try {
    const res = await apiPost('call_screening_update', {
      candidateId: currentCallCandId,
      familyNotes,
      callStatus,
      communication10: cVal,
      experience10: eVal,
      hrRemark: remark
    });

    if (res.success) {
      alert('Call details saved.');
      const reqId = callReqSelect.value;
      if (reqId) {
        loadCallScreenCandidates(reqId);
      }
      callEditor.classList.add('hidden');
      currentCallCandId = null;
    } else {
      alert('Error: ' + res.error);
    }
  } catch (err) {
    console.error(err);
    alert('Failed to save call details.');
  }
});

/***************************************************
 * HR: Owner Discussion
 ***************************************************/
btnLoadOwnerList && btnLoadOwnerList.addEventListener('click', async () => {
  const reqId = ownerReqSelect.value;
  if (!reqId) {
    alert('Please select requirement.');
    return;
  }
  await loadOwnerCandidates(reqId);
});

async function loadOwnerCandidates(reqId) {
  ownerDiscussContainer.innerHTML = 'Loading candidates...';

  try {
    const res = await apiGet('list_applicants_by_requirement', { requirementId: reqId });
    if (!res.success) {
      ownerDiscussContainer.innerHTML = 'Error: ' + res.error;
      return;
    }

    const list = (res.data || []).filter(c => c.Status === 'SHORTLISTED');
    if (!list.length) {
      ownerDiscussContainer.innerHTML = 'No candidates for owner discussion.';
      return;
    }

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>Candidate ID</th>
        <th>Name</th>
        <th>Mobile</th>
        <th>Source</th>
        <th>Owner Decision</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    list.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${c.CandidateId}</td>
        <td>${c.CandidateName}</td>
        <td>${c.Mobile}</td>
        <td>${c.Source}</td>
        <td></td>
      `;
      const tdActions = tr.querySelector('td:last-child');

      const btnApprove = document.createElement('button');
      btnApprove.textContent = 'Approve Walk-in';
      btnApprove.style.fontSize = '11px';
      btnApprove.style.padding = '4px 6px';
      btnApprove.addEventListener('click', () => {
        ownerDecisionFlow(c.CandidateId, 'APPROVED');
      });

      const btnReject = document.createElement('button');
      btnReject.textContent = 'Reject';
      btnReject.style.fontSize = '11px';
      btnReject.style.padding = '4px 6px';
      btnReject.style.marginLeft = '4px';
      btnReject.addEventListener('click', () => {
        ownerDecisionFlow(c.CandidateId, 'REJECTED');
      });

      const btnHold = document.createElement('button');
      btnHold.textContent = 'Hold';
      btnHold.style.fontSize = '11px';
      btnHold.style.padding = '4px 6px';
      btnHold.style.marginLeft = '4px';
      btnHold.addEventListener('click', () => {
        ownerDecisionFlow(c.CandidateId, 'HOLD');
      });

      tdActions.appendChild(btnApprove);
      tdActions.appendChild(btnReject);
      tdActions.appendChild(btnHold);

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    ownerDiscussContainer.innerHTML = '';
    ownerDiscussContainer.appendChild(table);

  } catch (err) {
    console.error(err);
    ownerDiscussContainer.innerHTML = 'Error loading candidates.';
  }
}

async function ownerDecisionFlow(candidateId, decision) {
  let ownerRemark = '';
  let walkinDate = '';
  let walkinTime = '';
  let holdReason = '';

  if (decision === 'APPROVED') {
    walkinDate = prompt('Walk-in Date (YYYY-MM-DD):', '');
    if (!walkinDate) {
      alert('Walk-in date required.');
      return;
    }
    walkinTime = prompt('Walk-in Time (e.g. 10:30 AM):', '');
    if (!walkinTime) {
      alert('Walk-in time required.');
      return;
    }
    ownerRemark = prompt('Owner remark (optional):', '') || '';
  } else if (decision === 'REJECTED') {
    ownerRemark = prompt('Owner rejection remark:', '');
    if (!ownerRemark) {
      alert('Rejection remark required.');
      return;
    }
  } else if (decision === 'HOLD') {
    holdReason = prompt('Hold reason:', '');
    if (!holdReason) {
      alert('Hold reason required.');
      return;
    }
    ownerRemark = prompt('Owner remark (optional):', '') || '';
  }

  try {
    const res = await apiPost('owner_decision', {
      candidateId,
      ownerDecision: decision,
      ownerRemark,
      walkinDate,
      walkinTime,
      holdReason
    });

    if (res.success) {
      alert(`Owner decision saved for ${candidateId}: ${decision}`);
      const reqId = ownerReqSelect.value;
      if (reqId) {
        loadOwnerCandidates(reqId);
      }
    } else {
      alert('Error: ' + res.error);
    }
  } catch (err) {
    console.error(err);
    alert('Failed to save owner decision.');
  }
}

/***************************************************
 * HR: Schedule Interviews
 ***************************************************/
btnLoadSchedule && btnLoadSchedule.addEventListener('click', async () => {
  const reqId = schedReqSelect.value;
  if (!reqId) {
    alert('Please select requirement.');
    return;
  }
  await loadScheduleCandidates(reqId);
});

async function loadScheduleCandidates(reqId) {
  scheduleContainer.innerHTML = 'Loading candidates...';

  try {
    const res = await apiGet('list_applicants_by_requirement', { requirementId: reqId });
    if (!res.success) {
      scheduleContainer.innerHTML = 'Error: ' + res.error;
      return;
    }

    const reqMeta = hrReqCache.find(r => r.RequirementId === reqId);
    const jobTitle = reqMeta ? (reqMeta.JobTitle || reqMeta.JobRole || '') : '';

    const list = (res.data || []).filter(c => c.Status === 'OWNER_APPROVED_WALKIN');
    if (!list.length) {
      scheduleContainer.innerHTML = 'No owner-approved candidates for scheduling.';
      return;
    }

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>Candidate ID</th>
        <th>Name</th>
        <th>Mobile</th>
        <th>Interview Date</th>
        <th>Interview Time</th>
        <th>Actions</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    list.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${c.CandidateId}</td>
        <td>${c.CandidateName}</td>
        <td>${c.Mobile}</td>
        <td><input type="date" class="sched-date" style="font-size:11px;padding:2px 4px;"></td>
        <td><input type="time" class="sched-time" style="font-size:11px;padding:2px 4px;"></td>
        <td></td>
      `;
      const tdActions = tr.querySelector('td:last-child');
      const dateInput = tr.querySelector('.sched-date');
      const timeInput = tr.querySelector('.sched-time');

      const btnSave = document.createElement('button');
      btnSave.textContent = 'Save Schedule';
      btnSave.style.fontSize = '11px';
      btnSave.style.padding = '4px 6px';
      btnSave.addEventListener('click', () => {
        const d = dateInput.value;
        const t = timeInput.value;
        if (!d || !t) {
          alert('Please set both date and time.');
          return;
        }
        saveInterviewSchedule(c.CandidateId, d, t);
      });

      const btnCopy = document.createElement('button');
      btnCopy.textContent = 'Copy Message';
      btnCopy.style.fontSize = '11px';
      btnCopy.style.padding = '4px 6px';
      btnCopy.style.marginLeft = '4px';
      btnCopy.addEventListener('click', () => {
        const d = dateInput.value;
        const t = timeInput.value;
        if (!d || !t) {
          alert('Please set date & time before copying message.');
          return;
        }
        copyInterviewMessage(c.CandidateName, jobTitle, d, t);
      });

      tdActions.appendChild(btnSave);
      tdActions.appendChild(btnCopy);
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    scheduleContainer.innerHTML = '';
    scheduleContainer.appendChild(table);

  } catch (err) {
    console.error(err);
    scheduleContainer.innerHTML = 'Error loading candidates.';
  }
}

async function saveInterviewSchedule(candidateId, dateStr, timeStr) {
  try {
    const res = await apiPost('schedule_interview', {
      candidateId,
      scheduledDate: dateStr,
      scheduledTime: timeStr,
      notifyStatus: 'PLANNED',
      candidateResponse: '',
      reason: ''
    });

    if (res.success) {
      alert(`Interview scheduled for ${candidateId} on ${dateStr} at ${timeStr}`);
    } else {
      alert('Error: ' + res.error);
    }
  } catch (err) {
    console.error(err);
    alert('Failed to save schedule.');
  }
}

function copyInterviewMessage(candidateName, jobTitle, dateStr, timeStr) {
  const prettyDate = dateStr.split('-').reverse().join('-');
  const msg =
`Dear ${candidateName},

We are pleased to inform you that you have been shortlisted for an interview for the position of ${jobTitle || '[Job Title]'}.

Interview Details:
📍 Location: Near Dr. Gyan Prakash, Kalai Compound, NT Woods, Gandhi Park, Aligarh (202 001)
📅 Date: ${prettyDate}
⏰ Time: ${timeStr}

Kindly confirm your availability at your earliest convenience.

For any information or assistance, please feel free to contact us.

Regards
Team HR
N.T. Woods Pvt. Ltd.`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(msg)
      .then(() => {
        alert('Interview message copied to clipboard.');
      })
      .catch(err => {
        console.error(err);
        alert('Could not copy message. Check browser permissions.');
      });
  } else {
    console.log(msg);
    alert('Clipboard API not available. Message logged in console.');
  }
}

/***************************************************
 * HR: Walk-ins (Today, Confirm Call, Appeared → token link)
 ***************************************************/
function initWalkinsDateToToday() {
  if (!walkinsDateInput) return;
  const today = new Date();
  const iso = today.toISOString().slice(0, 10);
  walkinsDateInput.value = iso;
}

btnLoadWalkins && btnLoadWalkins.addEventListener('click', () => {
  loadWalkinsForSelectedDate();
});

async function loadWalkinsForSelectedDate() {
  if (!walkinsDateInput || !walkinsContainer) return;
  const dateStr = walkinsDateInput.value || new Date().toISOString().slice(0, 10);

  walkinsContainer.innerHTML = 'Loading walk-ins...';

  try {
    const res = await apiGet('list_walkins', { date: dateStr });
    if (!res.success) {
      walkinsContainer.innerHTML = 'Error: ' + res.error;
      return;
    }

    const list = res.data || [];
    if (!list.length) {
      walkinsContainer.innerHTML = 'No walk-ins scheduled for this date.';
      return;
    }

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>Candidate ID</th>
        <th>Name</th>
        <th>Mobile</th>
        <th>Job Title</th>
        <th>Date</th>
        <th>Time</th>
        <th>Confirmed Call</th>
        <th>Appeared</th>
        <th>Actions</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    list.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${c.CandidateId}</td>
        <td>${c.CandidateName}</td>
        <td>${c.Mobile}</td>
        <td>${c.JobTitle || ''}</td>
        <td>${(c.InterviewDate || '').split('T')[0] || ''}</td>
        <td>${c.InterviewTime || ''}</td>
        <td>${c.ConfirmedCall ? 'Yes' : 'No'}</td>
        <td>${c.Appeared ? 'Yes' : 'No'}</td>
        <td></td>
      `;
      const tdActions = tr.querySelector('td:last-child');

      const btnConfirm = document.createElement('button');
      btnConfirm.textContent = 'Confirm Call';
      btnConfirm.style.fontSize = '11px';
      btnConfirm.style.padding = '4px 6px';
      btnConfirm.disabled = !!c.ConfirmedCall;
      btnConfirm.addEventListener('click', () => {
        updateWalkinCall(c.CandidateId);
      });

      const btnAppear = document.createElement('button');
      btnAppear.textContent = 'Mark Appeared & Get Link';
      btnAppear.style.fontSize = '11px';
      btnAppear.style.padding = '4px 6px';
      btnAppear.style.marginLeft = '4px';
      btnAppear.disabled = !!c.Appeared;
      btnAppear.addEventListener('click', () => {
        markWalkinAppeared(c.CandidateId);
      });

      tdActions.appendChild(btnConfirm);
      tdActions.appendChild(btnAppear);
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    walkinsContainer.innerHTML = '';
    walkinsContainer.appendChild(table);

  } catch (err) {
    console.error(err);
    walkinsContainer.innerHTML = 'Error loading walk-ins.';
  }
}

async function updateWalkinCall(candidateId) {
  try {
    const res = await apiPost('walkin_confirm_call', {
      candidateId,
      confirmed: true
    });
    if (res.success) {
      alert('Call confirmed for ' + candidateId);
      loadWalkinsForSelectedDate();
    } else {
      alert('Error: ' + res.error);
    }
  } catch (err) {
    console.error(err);
    alert('Failed to update confirmation.');
  }
}

async function markWalkinAppeared(candidateId) {
  try {
    const res = await apiPost('walkin_mark_appeared', { candidateId });
    if (!res.success) {
      alert('Error: ' + res.error);
      return;
    }
    let formUrl = res.formUrl;
    const token = res.walkinToken;

    if (!formUrl) {
      // build default URL based on current origin + walkin_form.html
      const url = new URL(window.location.href);
      url.pathname = url.pathname.replace(/index\.html?$/i, 'walkin_form.html');
      if (!/walkin_form\.html$/i.test(url.pathname)) {
        // if no index.html in path, just append
        if (!url.pathname.endsWith('/')) {
          url.pathname += '/';
        }
        url.pathname += 'walkin_form.html';
      }
      url.search = `?t=${encodeURIComponent(token)}`;
      formUrl = url.toString();
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(formUrl);
      alert('Walk-in form link copied:\n' + formUrl);
    } else {
      alert('Form link:\n' + formUrl);
      console.log('Walk-in form link:', formUrl);
    }

    loadWalkinsForSelectedDate();
  } catch (err) {
    console.error(err);
    alert('Failed to mark appeared.');
  }
}

/***************************************************
 * Admin / EA: Tests panel (Excel / Tally / Voice)
 ***************************************************/
btnLoadTests && btnLoadTests.addEventListener('click', async () => {
  const reqId = testsReqSelect.value;
  if (!reqId) {
    alert('Please select requirement.');
    return;
  }
  await loadTestsCandidates(reqId);
});

async function loadTestsCandidates(reqId) {
  testsContainer.innerHTML = 'Loading candidates...';

  try {
    const res = await apiGet('list_applicants_by_requirement', { requirementId: reqId });
    if (!res.success) {
      testsContainer.innerHTML = 'Error: ' + res.error;
      return;
    }

    const list = res.data || [];
    if (!list.length) {
      testsContainer.innerHTML = 'No candidates found for tests.';
      return;
    }

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>Candidate ID</th>
        <th>Name</th>
        <th>Job Role</th>
        <th>Excel (10)</th>
        <th>Tally (10)</th>
        <th>Voice (10)</th>
        <th>Actions</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    list.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${c.CandidateId}</td>
        <td>${c.CandidateName}</td>
        <td>${c.JobRole || ''}</td>
        <td><input type="number" class="t-excel" min="0" max="10" style="width:60px;font-size:11px;padding:2px 4px;"></td>
        <td><input type="number" class="t-tally" min="0" max="10" style="width:60px;font-size:11px;padding:2px 4px;"></td>
        <td><input type="number" class="t-voice" min="0" max="10" style="width:60px;font-size:11px;padding:2px 4px;"></td>
        <td></td>
      `;
      const tdActions = tr.querySelector('td:last-child');
      const excelInput = tr.querySelector('.t-excel');
      const tallyInput = tr.querySelector('.t-tally');
      const voiceInput = tr.querySelector('.t-voice');

      // prefill if backend sent marks
      if (typeof c.ExcelMarks10 !== 'undefined' && c.ExcelMarks10 !== '') {
        excelInput.value = c.ExcelMarks10;
      }
      if (typeof c.TallyMarks10 !== 'undefined' && c.TallyMarks10 !== '') {
        tallyInput.value = c.TallyMarks10;
      }
      if (typeof c.VoiceMarks10 !== 'undefined' && c.VoiceMarks10 !== '') {
        voiceInput.value = c.VoiceMarks10;
      }

      const btnSave = document.createElement('button');
      btnSave.textContent = 'Save Marks';
      btnSave.style.fontSize = '11px';
      btnSave.style.padding = '4px 6px';
      btnSave.addEventListener('click', () => {
        const excelVal = excelInput.value === '' ? null : Number(excelInput.value);
        const tallyVal = tallyInput.value === '' ? null : Number(tallyInput.value);
        const voiceVal = voiceInput.value === '' ? null : Number(voiceInput.value);

        if (!validateMarks(excelVal) || !validateMarks(tallyVal) || !validateMarks(voiceVal)) {
          alert('Marks (if filled) must be between 0 and 10.');
          return;
        }
        updateTestsMarks(c.CandidateId, excelVal, tallyVal, voiceVal);
      });

      tdActions.appendChild(btnSave);
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    testsContainer.innerHTML = '';
    testsContainer.appendChild(table);

  } catch (err) {
    console.error(err);
    testsContainer.innerHTML = 'Error loading candidates.';
  }
}

function validateMarks(v) {
  if (v === null || typeof v === 'undefined' || Number.isNaN(v)) return true;
  return v >= 0 && v <= 10;
}

async function updateTestsMarks(candidateId, excelVal, tallyVal, voiceVal) {
  try {
    const res = await apiPost('update_tests', {
      candidateId,
      excelMarks10: excelVal,
      tallyMarks10: tallyVal,
      voiceMarks10: voiceVal
    });
    if (res.success) {
      alert('Marks updated for ' + candidateId);
    } else {
      alert('Error: ' + res.error);
    }
  } catch (err) {
    console.error(err);
    alert('Failed to update marks.');
  }
}

/***************************************************
 * PUBLIC: Candidate Walk-in Form (token-based)
 ***************************************************/
function initWalkinFormIfNeeded() {
  if (!walkinFormRoot) return;

  const params = new URLSearchParams(window.location.search);
  const token = params.get('t') || params.get('token');
  if (!token) {
    if (wkStatusMsg) wkStatusMsg.textContent = 'Invalid or missing walk-in token.';
    return;
  }
  currentWalkinToken = token;
  initWalkinForm(token);
}

async function initWalkinForm(token) {
  if (!wkStatusMsg) return;
  wkStatusMsg.textContent = 'Loading your walk-in form...';

  try {
    const res = await apiGet('walkin_form_init', { walkinToken: token });
    if (!res.success) {
      wkStatusMsg.textContent = 'Error: ' + res.error;
      return;
    }

    const cand = res.candidate || {};
    if (wkCandidateNameEl) wkCandidateNameEl.textContent = cand.name || 'Candidate';
    if (wkJobPostEl) wkJobPostEl.textContent = cand.jobPost || '';

    if (res.alreadySubmitted) {
      wkStatusMsg.textContent = 'You have already submitted this walk-in form. Thank you.';
      if (btnWalkinSubmit) btnWalkinSubmit.disabled = true;
      return;
    }

    wkStatusMsg.textContent = '';

    // Generate random math questions (d to g -> 4 questions)
    walkinQuestions = generateMathQuestions(4);
    if (wkQuestionContainer) {
      wkQuestionContainer.innerHTML = '';
      walkinQuestions.forEach((q, idx) => {
        const row = document.createElement('div');
        row.style.marginBottom = '8px';
        row.innerHTML = `
          <div style="font-size:13px;margin-bottom:2px;">
            Q${idx + 1}. ${q.q}
          </div>
          <input type="number" class="wk-answer" data-index="${idx}" style="max-width:160px;">
        `;
        wkQuestionContainer.appendChild(row);
      });
    }

    if (btnWalkinSubmit) {
      btnWalkinSubmit.disabled = false;
      btnWalkinSubmit.addEventListener('click', submitWalkinFormOnce, { once: true });
    }
  } catch (err) {
    console.error(err);
    wkStatusMsg.textContent = 'Error loading form.';
  }
}

async function submitWalkinFormOnce() {
  if (!walkinFormRoot || !wkStatusMsg) return;

  const nameInput = document.getElementById('wkInputName');
  const postInput = document.getElementById('wkInputPost');
  const sourceInput = document.getElementById('wkInputSource');

  const fullName = nameInput ? nameInput.value.trim() : '';
  const jobPost  = postInput ? postInput.value.trim() : '';
  const infoSrc  = sourceInput ? sourceInput.value.trim() : '';

  if (!fullName || !jobPost || !infoSrc) {
    alert('Please fill Name, Applying For, and Information Source.');
    btnWalkinSubmit && btnWalkinSubmit.addEventListener('click', submitWalkinFormOnce, { once: true });
    return;
  }

  const answerInputs = Array.from(document.querySelectorAll('.wk-answer'));
  if (!answerInputs.length || answerInputs.length !== walkinQuestions.length) {
    alert('Something went wrong with questions. Please refresh the page.');
    return;
  }

  let correctCount = 0;
  const answersPayload = [];

  answerInputs.forEach(input => {
    const idx = Number(input.getAttribute('data-index'));
    const q = walkinQuestions[idx];
    const ansVal = Number(input.value);
    const isCorrect = !Number.isNaN(ansVal) && Math.abs(ansVal - q.a) < 0.01;
    if (isCorrect) correctCount += 1;
    answersPayload.push({
      question: q.q,
      correctAnswer: q.a,
      userAnswer: Number.isNaN(ansVal) ? null : ansVal,
      isCorrect
    });
  });

  const mathScore10 = Math.round((correctCount / walkinQuestions.length) * 10);

  wkStatusMsg.textContent = 'Submitting your responses...';
  btnWalkinSubmit.disabled = true;

  try {
    const res = await apiPost('walkin_form_submit', {
      walkinToken: currentWalkinToken,
      fullName,
      jobPost,
      infoSource: infoSrc,
      answers: answersPayload,
      mathScore10
    });

    if (res.success) {
      wkStatusMsg.textContent = 'Thank you. Your walk-in form has been submitted.';
    } else {
      wkStatusMsg.textContent = 'Error: ' + res.error;
      btnWalkinSubmit.disabled = false;
    }
  } catch (err) {
    console.error(err);
    wkStatusMsg.textContent = 'Failed to submit form.';
    btnWalkinSubmit.disabled = false;
  }
}

/***************************************************
 * Helper: Random math questions generator
 ***************************************************/
function generateMathQuestions(count = 4) {
  const templates = [
    (n) => ({ q: `${n}% of 200`, a: (n/100)*200 }),
    (n) => ({ q: `${n}% of 100`, a: (n/100)*100 }),
    (n) => ({ q: `Half of ${n}`, a: n/2 }),
    (n) => ({ q: `One third of ${n}`, a: n/3 }),
    (n) => ({ q: `One fourth of ${n}`, a: n/4 }),
    (n) => ({ q: `Convert ${n} m into cm`, a: n*100 }),
  ];
  const result = [];
  for (let i = 0; i < count; i++) {
    const n = 10 + Math.floor(Math.random()*241); // 10-250
    const t = templates[Math.floor(Math.random()*templates.length)];
    result.push(t(n));
  }
  return result;
}
