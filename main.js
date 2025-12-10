/***************************************************
 * main.js - Single Frontend JS File
 * - Google OAuth (GIS) login
 * - Simple API client
 * - Role-based tiles & Phase-1 UIs:
 *   EA: Raise Requirement
 *   HR: Review Requirements, Upload CVs, Shortlisting, Call Screening
 ***************************************************/

// CONFIG
const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbxh0etYDCdS7JmluGDhIjJT5JdI6GAtE0UyfTjIDon4OBXbryr5FIN73KCZYhW74jc_Zg/exec';
const GOOGLE_CLIENT_ID = '1029752642188-ku0k9krbdbsttj9br238glq8h4k5loj3.apps.googleusercontent.com';

let currentUser = null;
let idToken = null;
let jobTemplatesCache = [];

// DOM refs
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

// HR panel refs
const panelReqListHR  = document.getElementById('panelReqListHR');
const reqListContainer= document.getElementById('reqListContainer');

// HR extra panels
const panelUploadCVsHR   = document.getElementById('panelUploadCVsHR');
const panelShortlistHR   = document.getElementById('panelShortlistHR');
const panelCallScreenHR  = document.getElementById('panelCallScreenHR');

// Upload CVs controls
const uploadReqSelect    = document.getElementById('uploadReqSelect');
const cvListInput        = document.getElementById('cvListInput');
const btnUploadCVs       = document.getElementById('btnUploadCVs');
const cvUploadProgress   = document.getElementById('cvUploadProgress');

// Shortlisting controls
const shortlistReqSelect       = document.getElementById('shortlistReqSelect');
const btnLoadShortlist         = document.getElementById('btnLoadShortlist');
const shortlistTableContainer  = document.getElementById('shortlistTableContainer');

// Call screening controls
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

// cache for requirement list to reuse in dropdowns
let hrReqCache = [];
// currently selected candidate for call screening
let currentCallCandId = null;

/***************************************************
 * Google Identity Services - init
 ***************************************************/
window.onload = function () {
  if (window.google && window.google.accounts && window.google.accounts.id) {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse
    });
    google.accounts.id.renderButton(
      document.getElementById("g_id_signin"),
      { theme: "outline", size: "large" }
    );
  } else {
    console.error('Google Identity Services not loaded');
  }
};

function handleCredentialResponse(response) {
  // response.credential = ID Token
  idToken = response.credential;
  // Call backend /me to get user with role
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
 * Login success: show role-specific UI
 ***************************************************/
function onLoginSuccess() {
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
  roleTilesEl.innerHTML = '';

  // EA tiles
  if (currentUser.role === 'EA' || currentUser.role === 'ADMIN') {
    addTile('Raise Requirement', 'Create new hiring requirements', () => {
      showPanel('EA_REQUIREMENT');
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
  }

  // Future:
  // addTile('Owner Discussion', ...)
  // addTile('Schedule Interviews', ...)
  // addTile('Walk-ins', ...)
  // addTile('Tests', ...)
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
  // hide all
  panelRequirementsEA.classList.add('hidden');
  panelReqListHR.classList.add('hidden');
  panelUploadCVsHR.classList.add('hidden');
  panelShortlistHR.classList.add('hidden');
  panelCallScreenHR.classList.add('hidden');

  switch (panelKey) {
    case 'EA_REQUIREMENT':
      panelRequirementsEA.classList.remove('hidden');
      break;
    case 'HR_REQUIREMENT_REVIEW':
      panelReqListHR.classList.remove('hidden');
      break;
    case 'HR_UPLOAD_CVS':
      panelUploadCVsHR.classList.remove('hidden');
      break;
    case 'HR_SHORTLIST':
      panelShortlistHR.classList.remove('hidden');
      break;
    case 'HR_CALL_SCREEN':
      panelCallScreenHR.classList.remove('hidden');
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
      // clear if no template
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

btnCreateReq.addEventListener('click', async () => {
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
      // Reset form
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
  const selects = [uploadReqSelect, shortlistReqSelect, callReqSelect];
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
  if (!(currentUser.role === 'HR' || currentUser.role === 'ADMIN')) return;

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

    // simple table
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
 * Helper: Random math questions generator (for Walkin form later)
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

// Future:
// - Walkin form front-end (separate HTML or dynamic modal using token)
// - Owner discussion panel & schedule interviews UI
// - Walk-ins tile (Today filter + token link)
// - Tests entry UI (for Admin/EA) etc.
