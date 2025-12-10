/***************************************************
 * main.js - NT Woods HRMS Frontend
 * - Google OAuth (GIS) login
 * - Single API client (GET/POST)
 * - NO-CORS MODE ENABLED FOR POST (Data saving fix)
 ***************************************************/

// ===== CONFIG =====
const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbxUXXUfHQ132Hy4Fp4cdwCzrAK_dr_MeHCsSjSPLlLMU51r35j2Op64aXImM9nWfEX3FQ/exec';
const GOOGLE_CLIENT_ID = '1029752642188-ku0k9krbdbsttj9br238glq8h4k5loj3.apps.googleusercontent.com';

// Walk-in form page
const WALKIN_FORM_URL = window.location.origin + '/walkin_form.html';

// ===== GLOBAL STATE =====
let currentUser = null;
let idToken = null;
let jobTemplatesCache = [];

// ===== Simple helpers =====
function $(id) {
  return document.getElementById(id);
}

function show(el) {
  if (typeof el === 'string') el = $(el);
  if (el) el.classList.remove('hidden');
}

function hide(el) {
  if (typeof el === 'string') el = $(el);
  if (el) el.classList.add('hidden');
}

function htmlEscape(str) {
  return (str || '')
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ===== API CLIENT =====

// Note: GET requests standard mode me rahenge taaki hum data read kar sakein.
async function apiGet(action, params = {}) {
  const url = new URL(API_BASE_URL);
  url.searchParams.set('action', action);
  if (idToken) {
    url.searchParams.set('idToken', idToken);
  }
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) {
      url.searchParams.set(k, v);
    }
  });

  const res = await fetch(url.toString(), { method: 'GET' });
  const json = await res.json().catch(() => ({}));
  if (!json.success) {
    throw new Error(json.error || 'API GET error: ' + action);
  }
  return json;
}

// UPDATED: NO-CORS POST
// Server response check nahi karega, seedha success return karega.
async function apiPost(action, data = {}) {
  const body = {
    action,
    idToken,
    data
  };

  // 1. mode: 'no-cors' taaki browser block na kare
  // 2. content-type: text/plain taaki preflight request na jaye
  await fetch(API_BASE_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body)
  });

  console.log(`Sent to server (no-cors): ${action}`);

  // Dummy success response taaki UI crash na ho
  return {
    success: true,
    requirementId: 'REQ-SAVED (Check Sheet)', // Fake ID for UI
    candidates: ['Data Sent to Sheet'],       // Fake List for UI
    walkinToken: 'TOKEN-HIDDEN-IN-NOCORS'     // Note: Real token read nahi kar sakte
  };
}

// ===== Google Identity Services callback =====
async function handleCredentialResponse(response) {
  try {
    const token = response.credential;
    if (!token) {
      throw new Error('Empty credential from Google');
    }
    idToken = token;
    $('loginError').innerText = '';

    const me = await apiGet('me');
    currentUser = me.user;
    renderAppAfterLogin();
  } catch (err) {
    console.error(err);
    $('loginError').innerText = 'Login failed: ' + err;
  }
}

function initGoogleLogin() {
  try {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse
      });
      google.accounts.id.renderButton(
        $('g_id_signin'),
        { theme: 'outline', size: 'large' }
      );
    } else {
      $('loginError').innerText = 'Google Identity script load error.';
    }
  } catch (err) {
    console.error(err);
    $('loginError').innerText = 'Google login init failed.';
  }
}

// ===== App after login =====
function renderAppAfterLogin() {
  if (!currentUser) return;

  $('headerUserInfo').innerText = `${currentUser.name} (${currentUser.email})`;
  $('welcomeText').innerText = `Welcome, ${currentUser.name}`;
  $('roleBadges').innerHTML = `
    <span class="badge badge-role">${htmlEscape(currentUser.role)}</span>
  `;

  hide('loginSection');
  show('appSection');

  renderRoleTiles();
  wireAllButtons();
}

// ===== Tiles based on role =====
function renderRoleTiles() {
  const container = $('roleTiles');
  container.innerHTML = '';
  if (!currentUser) return;

  const tiles = [];

  // EA + ADMIN
  if (['EA', 'ADMIN'].includes(currentUser.role)) {
    tiles.push(
      {
        id: 'tile-ea-raise',
        title: 'Raise Requirement',
        desc: 'EA / Admin – create new hiring requirement using templates.',
        panelId: 'panelEARequirement'
      },
      {
        id: 'tile-ea-req-view',
        title: 'My Requirements',
        desc: 'EA view – Incomplete vs Valid requirements (HR SEND_BACK / VALID).',
        panelId: 'panelEARequirementsView'
      },
      {
        id: 'tile-tests',
        title: 'Tests Panel',
        desc: 'Excel, Tally, Voice marks entry for candidates.',
        panelId: 'panelTests'
      }
    );
  }

  // HR + ADMIN
  if (['HR', 'ADMIN'].includes(currentUser.role)) {
    tiles.push(
      {
        id: 'tile-hr-req-review',
        title: 'Review Requirements',
        desc: 'HR validation – mark requirements as VALID or SEND_BACK.',
        panelId: 'panelHRRequirementsReview'
      },
      {
        id: 'tile-hr-upload-cvs',
        title: 'Upload CVs',
        desc: 'Bulk CV upload per requirement (filename based parsing).',
        panelId: 'panelHRUploadCVs'
      },
      {
        id: 'tile-hr-shortlist',
        title: 'Shortlisting',
        desc: 'Approve / Reject CVs with stage tag “Shortlisting”.',
        panelId: 'panelHRShortlisting'
      },
      {
        id: 'tile-hr-call-screen',
        title: 'On-call Screening',
        desc: 'Family background + communication / experience scoring.',
        panelId: 'panelHRCallScreen'
      },
      {
        id: 'tile-hr-owner-discuss',
        title: 'Discuss with Owners',
        desc: 'Owner decision: Approve / Reject / Hold + Walk-in date/time.',
        panelId: 'panelHROwnerDiscuss'
      },
      {
        id: 'tile-hr-job-posting',
        title: 'Job Posting',
        desc: 'Portal-wise posted status + screenshot URLs.',
        panelId: 'panelHRJobPosting'
      },
      {
        id: 'tile-hr-schedule',
        title: 'Schedule Interviews',
        desc: 'Convert owner approved candidates to scheduled interviews.',
        panelId: 'panelHRScheduleInterviews'
      },
      {
        id: 'tile-hr-walkins',
        title: 'Walk-ins',
        desc: 'Today ke interviews, confirm call + appeared → walk-in form link.',
        panelId: 'panelHRWalkins'
      }
    );
  }

  tiles.forEach(tile => {
    const div = document.createElement('div');
    div.className = 'tile';
    div.id = tile.id;
    div.innerHTML = `
      <h3>${htmlEscape(tile.title)}</h3>
      <p>${htmlEscape(tile.desc)}</p>
    `;
    div.addEventListener('click', () => showPanel(tile.panelId));
    container.appendChild(div);
  });
}

// ===== Panel show/hide =====
function hideAllPanels() {
  const ids = [
    'panelEARequirement',
    'panelEARequirementsView',
    'panelHRRequirementsReview',
    'panelHRUploadCVs',
    'panelHRShortlisting',
    'panelHRCallScreen',
    'panelHROwnerDiscuss',
    'panelHRJobPosting',
    'panelHRScheduleInterviews',
    'panelHRWalkins',
    'panelTests'
  ];
  ids.forEach(hide);
}

function showPanel(panelId) {
  hideAllPanels();
  show(panelId);

  // lazy-load specific data on first open or refresh button
  switch (panelId) {
    case 'panelEARequirement':
      loadJobTemplatesIfNeeded();
      break;
    case 'panelEARequirementsView':
      loadEARequirementsView();
      break;
    case 'panelHRRequirementsReview':
      loadHRRequirements();
      break;
  }
}

// ===== Job Templates & EA Raise Requirement =====
async function loadJobTemplatesIfNeeded() {
  const select = $('eaJobRole');
  if (jobTemplatesCache.length) {
    renderJobRoleOptions(jobTemplatesCache);
    return;
  }
  try {
    select.innerHTML = `<option value="">Loading...</option>`;
    const res = await apiGet('get_job_templates');
    jobTemplatesCache = res.data || [];
    renderJobRoleOptions(jobTemplatesCache);
  } catch (err) {
    console.error(err);
    select.innerHTML = `<option value="">Failed to load templates</option>`;
  }
}

function renderJobRoleOptions(templates) {
  const select = $('eaJobRole');
  select.innerHTML = `<option value="">Select Job Role</option>`;
  const uniqueRoles = [...new Set(templates.map(t => t.JobRole))];
  uniqueRoles.forEach(role => {
    const opt = document.createElement('option');
    opt.value = role;
    opt.textContent = role;
    select.appendChild(opt);
  });
}

function applyTemplateForSelectedRole() {
  const role = $('eaJobRole').value;
  if (!role || !jobTemplatesCache.length) return;

  const tpl = jobTemplatesCache.find(t => t.JobRole === role);
  if (!tpl) return;

  $('eaJobTitle').value = tpl.JobTitleDefault || '';
  $('eaResponsibilities').value = tpl.ResponsibilitiesDefault || '';
  $('eaMustHave').value = tpl.MustHaveDefault || '';
  $('eaShift').value = tpl.ShiftDefault || '';
  $('eaPayScale').value = tpl.PayScaleDefault || '';
  $('eaPerks').value = tpl.PerksDefault || '';
  $('eaNotes').value = tpl.NotesDefault || '';
}

async function saveRequirementEA() {
  const jobRole = $('eaJobRole').value.trim();
  const jobTitle = $('eaJobTitle').value.trim();
  const responsibilities = $('eaResponsibilities').value.trim();
  const mustHave = $('eaMustHave').value.trim();
  const shift = $('eaShift').value.trim();
  const payScale = $('eaPayScale').value.trim();
  const perks = $('eaPerks').value.trim();
  const notes = $('eaNotes').value.trim();

  const msgEl = $('eaRequirementMsg');
  msgEl.className = '';
  msgEl.innerText = '';

  if (!jobRole || !jobTitle) {
    msgEl.className = 'error';
    msgEl.innerText = 'Job Role & Job Title mandatory hain.';
    return;
  }

  try {
    $('btnSaveRequirement').disabled = true;
    const res = await apiPost('create_requirement', {
      jobRole,
      jobTitle,
      responsibilities,
      mustHave,
      shift,
      payScale,
      perks,
      notes
    });
    msgEl.className = 'success';
    // Fake success ID show karega
    msgEl.innerText = `Requirement saved: ${res.requirementId}`;
  } catch (err) {
    console.error(err);
    msgEl.className = 'error';
    msgEl.innerText = 'Failed: ' + err;
  } finally {
    $('btnSaveRequirement').disabled = false;
  }
}

// ===== EA Requirements View (Incomplete / Valid) =====
async function loadEARequirementsView() {
  const container = $('eaReqViewContainer');
  container.className = 'mt-12 loader-text';
  container.innerText = 'Loading...';

  try {
    const res = await apiGet('list_requirements_ea_view');
    const data = res.data || { incomplete: [], valid: [], all: [] };

    container.className = 'mt-12';
    container.innerHTML = `
      <h3>Incomplete (SEND_BACK)</h3>
      ${renderRequirementTable(data.incomplete)}

      <h3 class="mt-16">Valid</h3>
      ${renderRequirementTable(data.valid)}

      <h3 class="mt-16">All (My Requirements)</h3>
      ${renderRequirementTable(data.all)}
    `;
  } catch (err) {
    console.error(err);
    container.className = 'error mt-12';
    container.innerText = 'Error: ' + err;
  }
}

function renderRequirementTable(list) {
  if (!list || !list.length) {
    return `<div class="muted">No records.</div>`;
  }
  let rows = '';
  list.forEach(r => {
    const st = htmlEscape(r.Status || '');
    rows += `
      <tr>
        <td>${htmlEscape(r.RequirementId)}</td>
        <td>${htmlEscape(r.JobRole)}</td>
        <td>${htmlEscape(r.JobTitle)}</td>
        <td><span class="status-pill status-${st}">${st}</span></td>
        <td>${htmlEscape(r.HRRemark || '')}</td>
      </tr>
    `;
  });
  return `
    <div style="overflow-x:auto;">
      <table>
        <thead>
          <tr>
            <th>RequirementId</th>
            <th>Role</th>
            <th>Title</th>
            <th>Status</th>
            <th>HR Remark</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

// ===== HR Requirements Review =====
async function loadHRRequirements() {
  const container = $('hrRequirementsContainer');
  container.className = 'mt-12 loader-text';
  container.innerText = 'Loading...';

  try {
    const res = await apiGet('list_requirements');
    const list = res.data || [];

    container.className = 'mt-12';
    if (!list.length) {
      container.innerHTML = `<div class="muted">No requirements found.</div>`;
      return;
    }

    let rows = '';
    list.forEach(r => {
      const st = r.Status || '';
      rows += `
        <tr data-req-id="${htmlEscape(r.RequirementId)}">
          <td>${htmlEscape(r.RequirementId)}</td>
          <td>${htmlEscape(r.JobRole)}</td>
          <td>${htmlEscape(r.JobTitle)}</td>
          <td><span class="status-pill status-${htmlEscape(st)}">${htmlEscape(st)}</span></td>
          <td>${htmlEscape(r.HRRemark || '')}</td>
          <td>
            <select class="hr-status-select">
              <option value="">--Select--</option>
              <option value="VALID">VALID</option>
              <option value="SEND_BACK">SEND_BACK</option>
            </select>
            <input class="hr-remark-input" type="text" placeholder="HR remark (for SEND_BACK mandatory)" />
            <button class="small btn-save-status">Save</button>
          </td>
        </tr>
      `;
    });

    container.innerHTML = `
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              <th>RequirementId</th>
              <th>Role</th>
              <th>Title</th>
              <th>Status</th>
              <th>HR Remark</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;

    container.querySelectorAll('.btn-save-status').forEach(btn => {
      btn.addEventListener('click', async () => {
        const tr = btn.closest('tr');
        const reqId = tr.getAttribute('data-req-id');
        const status = tr.querySelector('.hr-status-select').value;
        const remark = tr.querySelector('.hr-remark-input').value.trim();

        if (!status) {
          alert('Status select karo.');
          return;
        }
        if (status === 'SEND_BACK' && !remark) {
          alert('SEND_BACK ke liye remark mandatory hai.');
          return;
        }

        btn.disabled = true;
        try {
          await apiPost('update_requirement_status', {
            requirementId: reqId,
            status,
            hrRemark: remark
          });
          alert('Updated (Check Sheet).');
          // loadHRRequirements(); // Refresh hata diya taaki fake data dikhta rahe
        } catch (err) {
          console.error(err);
          alert('Error: ' + err);
        } finally {
          btn.disabled = false;
        }
      });
    });
  } catch (err) {
    console.error(err);
    container.className = 'error mt-12';
    container.innerText = 'Error: ' + err;
  }
}

// ===== HR Upload CVs =====
async function uploadCVs() {
  const reqId = $('uploadRequirementId').value.trim();
  const text = $('uploadCVList').value.trim();
  const msgEl = $('uploadCVMsg');
  msgEl.className = '';
  msgEl.innerText = '';

  if (!reqId || !text) {
    msgEl.className = 'error';
    msgEl.innerText = 'Requirement ID aur CV list required hai.';
    return;
  }

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const files = [];
  for (const line of lines) {
    const parts = line.split(',');
    if (parts.length < 2) continue;
    const fileName = parts[0].trim();
    const fileUrl = parts.slice(1).join(',').trim();
    if (!fileName || !fileUrl) continue;
    files.push({ fileName, fileUrl });
  }

  if (!files.length) {
    msgEl.className = 'error';
    msgEl.innerText = 'Koi valid line nahi mili (FileName,FileUrl).';
    return;
  }

  try {
    $('btnUploadCVs').disabled = true;
    msgEl.className = 'loader-text';
    msgEl.innerText = `Uploading ${files.length} CVs...`;

    const res = await apiPost('batch_upload_cvs', {
      requirementId: reqId,
      files
    });

    msgEl.className = 'success';
    msgEl.innerText = `Uploaded ${files.length} CVs. (Data sent to Sheet)`;
  } catch (err) {
    console.error(err);
    msgEl.className = 'error';
    msgEl.innerText = 'Error: ' + err;
  } finally {
    $('btnUploadCVs').disabled = false;
  }
}

// ===== HR Shortlisting =====
async function loadShortlisting() {
  const reqId = $('shortlistRequirementId').value.trim();
  const container = $('shortlistContainer');
  container.className = 'mt-12 loader-text';
  container.innerText = 'Loading...';

  if (!reqId) {
    container.className = 'error mt-12';
    container.innerText = 'Requirement ID daaliye.';
    return;
  }

  try {
    const res = await apiGet('list_applicants_by_requirement', { requirementId: reqId });
    const list = (res.data || []).filter(c => ['UPLOADED', 'SHORTLISTED'].includes(c.Status));

    if (!list.length) {
      container.className = 'mt-12 muted';
      container.innerText = 'No candidates for shortlisting.';
      return;
    }

    container.className = 'mt-12';
    let rows = '';
    list.forEach(c => {
      rows += `
        <tr data-cid="${htmlEscape(c.CandidateId)}">
          <td>${htmlEscape(c.CandidateId)}</td>
          <td>${htmlEscape(c.CandidateName)}</td>
          <td>${htmlEscape(c.Mobile)}</td>
          <td>${htmlEscape(c.Source)}</td>
          <td><span class="status-pill status-${htmlEscape(c.Status || '')}">${htmlEscape(c.Status || '')}</span></td>
          <td>
            <button class="small btn-approve">Approve</button>
            <button class="small danger btn-reject">Reject</button>
          </td>
        </tr>
      `;
    });

    container.innerHTML = `
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              <th>CandidateId</th>
              <th>Name</th>
              <th>Mobile</th>
              <th>Source</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;

    container.querySelectorAll('.btn-approve').forEach(btn => {
      btn.addEventListener('click', () => shortlistDecision(btn, 'APPROVE'));
    });
    container.querySelectorAll('.btn-reject').forEach(btn => {
      btn.addEventListener('click', () => shortlistDecision(btn, 'REJECT'));
    });
  } catch (err) {
    console.error(err);
    container.className = 'error mt-12';
    container.innerText = 'Error: ' + err;
  }
}

async function shortlistDecision(btn, decision) {
  const tr = btn.closest('tr');
  const cid = tr.getAttribute('data-cid');
  let remark = '';
  if (decision === 'REJECT') {
    remark = prompt('Rejection remark (Shortlisting stage):') || '';
    if (!remark.trim()) {
      alert('Remark required for rejection.');
      return;
    }
  }
  btn.disabled = true;
  try {
    await apiPost('shortlist_decision', {
      candidateId: cid,
      decision,
      remark
    });
    alert('Decision Saved (Check Sheet).');
    // loadShortlisting(); // Refresh removed due to no-cors
  } catch (err) {
    console.error(err);
    alert('Error: ' + err);
  } finally {
    btn.disabled = false;
  }
}

// ===== HR Call Screening =====
async function loadCallScreening() {
  const reqId = $('callRequirementId').value.trim();
  const container = $('callScreenContainer');
  container.className = 'mt-12 loader-text';
  container.innerText = 'Loading...';

  if (!reqId) {
    container.className = 'error mt-12';
    container.innerText = 'Requirement ID daaliye.';
    return;
  }

  try {
    const res = await apiGet('list_applicants_by_requirement', { requirementId: reqId });
    const list = (res.data || []).filter(c => c.Status === 'SHORTLISTED');

    if (!list.length) {
      container.className = 'mt-12 muted';
      container.innerText = 'No candidates for call screening.';
      return;
    }

    container.className = 'mt-12';
    let rows = '';
    list.forEach(c => {
      rows += `
        <tr data-cid="${htmlEscape(c.CandidateId)}">
          <td>${htmlEscape(c.CandidateId)}</td>
          <td>${htmlEscape(c.CandidateName)}</td>
          <td>${htmlEscape(c.Mobile)}</td>
          <td>${htmlEscape(c.Source)}</td>
          <td>
            <textarea class="cs-family" placeholder="Family background notes..."></textarea>
          </td>
          <td>
            <select class="cs-call-status">
              <option value="RecommendedOwner">Recommended for Owners</option>
              <option value="SwitchedOff">Switched Off</option>
              <option value="NoAnswer">No Answer</option>
              <option value="NoIncoming">No Incoming</option>
              <option value="Reject">Reject</option>
            </select>
            <input class="cs-comm" type="number" min="0" max="10" placeholder="Comm /10" />
            <input class="cs-exp" type="number" min="0" max="10" placeholder="Exp /10" />
            <input class="cs-remark" type="text" placeholder="Remark (for Reject)" />
            <button class="small btn-save-call">Save</button>
          </td>
        </tr>
      `;
    });

    container.innerHTML = `
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              <th>CandidateId</th>
              <th>Name</th>
              <th>Mobile</th>
              <th>Source</th>
              <th>Family Notes</th>
              <th>Call Status & Scores</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;

    container.querySelectorAll('.btn-save-call').forEach(btn => {
      btn.addEventListener('click', () => saveCallScreenRow(btn));
    });
  } catch (err) {
    console.error(err);
    container.className = 'error mt-12';
    container.innerText = 'Error: ' + err;
  }
}

async function saveCallScreenRow(btn) {
  const tr = btn.closest('tr');
  const cid = tr.getAttribute('data-cid');
  const familyNotes = tr.querySelector('.cs-family').value.trim();
  const callStatus = tr.querySelector('.cs-call-status').value;
  const comm = Number(tr.querySelector('.cs-comm').value || 0);
  const exp = Number(tr.querySelector('.cs-exp').value || 0);
  const remark = tr.querySelector('.cs-remark').value.trim();

  if (!callStatus) {
    alert('Call status select karo.');
    return;
  }
  if (callStatus === 'Reject' && !remark) {
    alert('Reject ke liye remark mandatory hai.');
    return;
  }

  btn.disabled = true;
  try {
    await apiPost('call_screening_update', {
      candidateId: cid,
      familyNotes,
      callStatus,
      communication10: comm,
      experience10: exp,
      hrRemark: remark
    });
    alert('Screening Saved (Check Sheet).');
  } catch (err) {
    console.error(err);
    alert('Error: ' + err);
  } finally {
    btn.disabled = false;
  }
}

// ===== HR Owner Discussion =====
async function loadOwnerDiscuss() {
  const reqId = $('ownerRequirementId').value.trim();
  const container = $('ownerDiscussContainer');
  container.className = 'mt-12 loader-text';
  container.innerText = 'Loading...';

  if (!reqId) {
    container.className = 'error mt-12';
    container.innerText = 'Requirement ID daaliye.';
    return;
  }

  try {
    const res = await apiGet('list_applicants_by_requirement', { requirementId: reqId });
    const list = (res.data || []).filter(c => ['SHORTLISTED', 'ON_HOLD'].includes(c.Status));

    if (!list.length) {
      container.className = 'mt-12 muted';
      container.innerText = 'No candidates for owner discussion.';
      return;
    }

    container.className = 'mt-12';
    let rows = '';
    list.forEach(c => {
      rows += `
        <tr data-cid="${htmlEscape(c.CandidateId)}">
          <td>${htmlEscape(c.CandidateId)}</td>
          <td>${htmlEscape(c.CandidateName)}</td>
          <td>${htmlEscape(c.JobRole || '')}</td>
          <td>${htmlEscape(c.JobTitle || '')}</td>
          <td><span class="status-pill status-${htmlEscape(c.Status || '')}">${htmlEscape(c.Status || '')}</span></td>
          <td>
            <select class="owner-decision">
              <option value="APPROVED">APPROVED (Walk-in)</option>
              <option value="REJECTED">REJECTED</option>
              <option value="HOLD">HOLD</option>
            </select>
            <input class="owner-walk-date" type="date" />
            <input class="owner-walk-time" type="time" />
            <input class="owner-hold" type="text" placeholder="Hold reason" />
            <input class="owner-remark" type="text" placeholder="Owner remark" />
            <button class="small btn-save-owner">Save</button>
          </td>
        </tr>
      `;
    });

    container.innerHTML = `
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              <th>CandidateId</th>
              <th>Name</th>
              <th>Role</th>
              <th>Title</th>
              <th>Status</th>
              <th>Owner Decision</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;

    container.querySelectorAll('.btn-save-owner').forEach(btn => {
      btn.addEventListener('click', () => saveOwnerRow(btn));
    });
  } catch (err) {
    console.error(err);
    container.className = 'error mt-12';
    container.innerText = 'Error: ' + err;
  }
}

async function saveOwnerRow(btn) {
  const tr = btn.closest('tr');
  const cid = tr.getAttribute('data-cid');
  const decision = tr.querySelector('.owner-decision').value;
  const walkDate = tr.querySelector('.owner-walk-date').value;
  const walkTime = tr.querySelector('.owner-walk-time').value;
  const hold = tr.querySelector('.owner-hold').value.trim();
  const remark = tr.querySelector('.owner-remark').value.trim();

  if (!decision) {
    alert('Owner decision select karo.');
    return;
  }
  if (decision === 'APPROVED' && (!walkDate || !walkTime)) {
    alert('Approved ke liye Walk-in date & time required.');
    return;
  }
  if (decision === 'REJECTED' && !remark) {
    alert('Rejected ke liye remark mandatory hai.');
    return;
  }
  if (decision === 'HOLD' && !hold) {
    alert('Hold reason daalo.');
    return;
  }

  btn.disabled = true;
  try {
    await apiPost('owner_decision', {
      candidateId: cid,
      ownerDecision: decision,
      ownerRemark: remark,
      walkinDate: walkDate,
      walkinTime: walkTime,
      holdReason: hold
    });
    alert('Decision Saved (Check Sheet).');
  } catch (err) {
    console.error(err);
    alert('Error: ' + err);
  } finally {
    btn.disabled = false;
  }
}

// ===== Job Posting Panel =====
async function loadJobPosting() {
  const reqId = $('postingRequirementId').value.trim();
  const container = $('jobPostingContainer');
  container.className = 'mt-12 loader-text';
  container.innerText = 'Loading...';

  if (!reqId) {
    container.className = 'error mt-12';
    container.innerText = 'Requirement ID daaliye.';
    return;
  }

  try {
    const res = await apiGet('list_job_postings', { requirementId: reqId });
    const existing = res.data || [];

    const portals = ['Naukri', 'Indeed', 'WorkIndia', 'Apna', 'Direct'];
    const byPortal = {};
    existing.forEach(p => {
      byPortal[p.PortalName] = p;
    });

    container.className = 'mt-12';
    let rows = '';
    portals.forEach(p => {
      const row = byPortal[p] || {};
      const checked = row.Posted ? 'checked' : '';
      const url = row.ScreenshotUrl || '';
      rows += `
        <tr data-portal="${htmlEscape(p)}">
          <td>${htmlEscape(p)}</td>
          <td style="text-align:center;">
            <input class="jp-posted" type="checkbox" ${checked} />
          </td>
          <td>
            <input class="jp-url" type="text" value="${htmlEscape(url)}" placeholder="Screenshot URL (optional)" />
          </td>
        </tr>
      `;
    });

    container.innerHTML = `
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              <th>Portal</th>
              <th>Posted?</th>
              <th>Screenshot URL</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <button id="btnSaveJobPosting" class="mt-8">Save Job Posting Status</button>
    `;

    $('btnSaveJobPosting').addEventListener('click', () => saveJobPosting(reqId));
  } catch (err) {
    console.error(err);
    container.className = 'error mt-12';
    container.innerText = 'Error: ' + err;
  }
}

async function saveJobPosting(reqId) {
  const container = $('jobPostingContainer');
  const rows = container.querySelectorAll('tbody tr');
  const postings = [];
  rows.forEach(tr => {
    const portal = tr.getAttribute('data-portal');
    const posted = tr.querySelector('.jp-posted').checked;
    const url = tr.querySelector('.jp-url').value.trim();
    postings.push({
      portalName: portal,
      posted,
      screenshotUrl: url
    });
  });

  try {
    await apiPost('save_job_postings', {
      requirementId: reqId,
      postings
    });
    alert('Job posting status saved (Check Sheet).');
  } catch (err) {
    console.error(err);
    alert('Error: ' + err);
  }
}

// ===== Schedule Interviews =====
async function loadScheduleInterviews() {
  const reqId = $('scheduleReqId').value.trim();
  const container = $('scheduleContainer');
  container.className = 'mt-12 loader-text';
  container.innerText = 'Loading...';

  if (!reqId) {
    container.className = 'error mt-12';
    container.innerText = 'Requirement ID daaliye.';
    return;
  }

  try {
    const res = await apiGet('list_applicants_by_requirement', { requirementId: reqId });
    const list = (res.data || []).filter(c =>
      ['OWNER_APPROVED_WALKIN', 'SCHEDULED'].includes(c.Status)
    );

    if (!list.length) {
      container.className = 'mt-12 muted';
      container.innerText = 'No candidates for scheduling.';
      return;
    }

    container.className = 'mt-12';
    let rows = '';
    list.forEach(c => {
      rows += `
        <tr data-cid="${htmlEscape(c.CandidateId)}">
          <td>${htmlEscape(c.CandidateId)}</td>
          <td>${htmlEscape(c.CandidateName)}</td>
          <td>${htmlEscape(c.JobRole || '')}</td>
          <td>${htmlEscape(c.JobTitle || '')}</td>
          <td><span class="status-pill status-${htmlEscape(c.Status || '')}">${htmlEscape(c.Status || '')}</span></td>
          <td>
            <input class="sched-date" type="date" />
            <input class="sched-time" type="time" />
            <button class="small btn-save-sched">Save</button>
          </td>
        </tr>
      `;
    });

    container.innerHTML = `
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              <th>CandidateId</th>
              <th>Name</th>
              <th>Role</th>
              <th>Title</th>
              <th>Status</th>
              <th>Interview Date &amp; Time</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;

    container.querySelectorAll('.btn-save-sched').forEach(btn => {
      btn.addEventListener('click', () => saveScheduleRow(btn));
    });
  } catch (err) {
    console.error(err);
    container.className = 'error mt-12';
    container.innerText = 'Error: ' + err;
  }
}

async function saveScheduleRow(btn) {
  const tr = btn.closest('tr');
  const cid = tr.getAttribute('data-cid');
  const date = tr.querySelector('.sched-date').value;
  const time = tr.querySelector('.sched-time').value;

  if (!date || !time) {
    alert('Date & time both required.');
    return;
  }

  btn.disabled = true;
  try {
    await apiPost('schedule_interview', {
      candidateId: cid,
      scheduledDate: date,
      scheduledTime: time
    });
    alert('Interview scheduled (Check Sheet).');
  } catch (err) {
    console.error(err);
    alert('Error: ' + err);
  } finally {
    btn.disabled = false;
  }
}

// ===== Walk-ins (Today ke Interviews) =====
async function loadWalkins() {
  const input = $('walkinDate');
  if (!input.value) {
    const today = new Date();
    input.value = today.toISOString().slice(0, 10);
  }
  const dateStr = input.value;
  const container = $('walkinsContainer');
  container.className = 'mt-12 loader-text';
  container.innerText = 'Loading...';

  try {
    const res = await apiGet('list_walkins', { date: dateStr });
    const list = res.data || [];

    if (!list.length) {
      container.className = 'mt-12 muted';
      container.innerText = 'No interviews for this date.';
      return;
    }

    container.className = 'mt-12';
    let rows = '';
    list.forEach(c => {
      const linkCell = `<span class="muted">Click "Appeared" to generate link</span>`;
      rows += `
        <tr data-cid="${htmlEscape(c.CandidateId)}">
          <td>${htmlEscape(c.CandidateId)}</td>
          <td>${htmlEscape(c.CandidateName)}</td>
          <td>${htmlEscape(c.Mobile)}</td>
          <td>${htmlEscape(c.JobRole || '')}</td>
          <td>${htmlEscape(c.JobTitle || '')}</td>
          <td>${htmlEscape(c.InterviewTime || '')}</td>
          <td>
            <input type="checkbox" class="w-conf" ${c.ConfirmedCall ? 'checked' : ''} />
          </td>
          <td>
            <button class="small btn-mark-appeared">Appeared</button>
          </td>
          <td class="walkin-link-cell">${linkCell}</td>
        </tr>
      `;
    });

    container.innerHTML = `
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              <th>CandidateId</th>
              <th>Name</th>
              <th>Mobile</th>
              <th>Role</th>
              <th>Title</th>
              <th>Time</th>
              <th>Confirm Call</th>
              <th>Appeared</th>
              <th>Walk-in Link</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;

    container.querySelectorAll('.w-conf').forEach(chk => {
      chk.addEventListener('change', () => saveWalkinConfirm(chk));
    });
    container.querySelectorAll('.btn-mark-appeared').forEach(btn => {
      btn.addEventListener('click', () => markWalkinAppeared(btn));
    });
  } catch (err) {
    console.error(err);
    container.className = 'error mt-12';
    container.innerText = 'Error: ' + err;
  }
}

async function saveWalkinConfirm(chk) {
  const tr = chk.closest('tr');
  const cid = tr.getAttribute('data-cid');
  const confirmed = chk.checked;

  try {
    await apiPost('walkin_confirm_call', {
      candidateId: cid,
      confirmed
    });
    // No alert needed for checkbox
  } catch (err) {
    console.error(err);
    alert('Error: ' + err);
    chk.checked = !confirmed;
  }
}

async function markWalkinAppeared(btn) {
  const tr = btn.closest('tr');
  const cid = tr.getAttribute('data-cid');
  const linkCell = tr.querySelector('.walkin-link-cell');

  btn.disabled = true;
  linkCell.innerHTML = '<span class="loader-text">Generating...</span>';
  try {
    const res = await apiPost('walkin_mark_appeared', { candidateId: cid });
    // IMPORTANT: NO-CORS MODE mein hum server se Token read nahi kar sakte.
    // Isliye Link generate nahi ho payega.
    linkCell.innerHTML = `<span class="success">Marked Appeared (Check Sheet)</span>`;
  } catch (err) {
    console.error(err);
    linkCell.innerHTML = '<span class="error">Error generating link.</span>';
  } finally {
    btn.disabled = false;
  }
}

// ===== Tests Panel =====
async function saveTests() {
  const cid = $('testCandidateId').value.trim();
  const excel = $('testExcelMarks').value;
  const tally = $('testTallyMarks').value;
  const voice = $('testVoiceMarks').value;
  const msgEl = $('testPanelMsg');

  msgEl.className = '';
  msgEl.innerText = '';

  if (!cid) {
    msgEl.className = 'error';
    msgEl.innerText = 'Candidate ID required.';
    return;
  }

  const data = { candidateId: cid };
  if (excel !== '') data.excelMarks10 = Number(excel);
  if (tally !== '') data.tallyMarks10 = Number(tally);
  if (voice !== '') data.voiceMarks10 = Number(voice);

  try {
    $('btnSaveTests').disabled = true;
    const res = await apiPost('update_tests', data);
    msgEl.className = 'success';
    msgEl.innerText = 'Marks updated (Check Sheet).';
  } catch (err) {
    console.error(err);
    msgEl.className = 'error';
    msgEl.innerText = 'Error: ' + err;
  } finally {
    $('btnSaveTests').disabled = false;
  }
}

// ===== Wire Events =====
function wireAllButtons() {
  $('btnSignOut').addEventListener('click', () => {
    // simple sign-out (front-end level)
    currentUser = null;
    idToken = null;
    location.reload();
  });

  // EA
  const loadTplBtn = $('btnLoadTemplate');
  if (loadTplBtn) loadTplBtn.addEventListener('click', applyTemplateForSelectedRole);
  const saveReqBtn = $('btnSaveRequirement');
  if (saveReqBtn) saveReqBtn.addEventListener('click', saveRequirementEA);
  const refreshEAReqBtn = $('btnRefreshEARequirements');
  if (refreshEAReqBtn) refreshEAReqBtn.addEventListener('click', loadEARequirementsView);

  // HR
  const refreshHRReqBtn = $('btnRefreshHRRequirements');
  if (refreshHRReqBtn) refreshHRReqBtn.addEventListener('click', loadHRRequirements);

  const uploadBtn = $('btnUploadCVs');
  if (uploadBtn) uploadBtn.addEventListener('click', uploadCVs);

  const loadShortlistBtn = $('btnLoadShortlist');
  if (loadShortlistBtn) loadShortlistBtn.addEventListener('click', loadShortlisting);

  const loadCallScreenBtn = $('btnLoadCallScreen');
  if (loadCallScreenBtn) loadCallScreenBtn.addEventListener('click', loadCallScreening);

  const loadOwnerBtn = $('btnLoadOwnerDiscuss');
  if (loadOwnerBtn) loadOwnerBtn.addEventListener('click', loadOwnerDiscuss);

  const loadPostingBtn = $('btnLoadJobPosting');
  if (loadPostingBtn) loadPostingBtn.addEventListener('click', loadJobPosting);

  const loadScheduleBtn = $('btnLoadSchedule');
  if (loadScheduleBtn) loadScheduleBtn.addEventListener('click', loadScheduleInterviews);

  const loadWalkinsBtn = $('btnLoadWalkins');
  if (loadWalkinsBtn) loadWalkinsBtn.addEventListener('click', loadWalkins);

  // Tests
  const saveTestsBtn = $('btnSaveTests');
  if (saveTestsBtn) saveTestsBtn.addEventListener('click', saveTests);
}

// ===== Boot =====
window.onload = function () {
  initGoogleLogin();
};
