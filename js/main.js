/***************************************************
 * main.js - NT Woods HRMS Frontend (Phase-1)
 * - Google OAuth (GIS) login
 * - Single API client (GET + POST no-cors)
 * - Role-based tiles
 *   EA: Raise Requirement, My Requirements, Tests
 *   HR: Review, Upload CVs, Shortlisting, Call Screen,
 *       Owner Discussion, Job Posting, Schedule, Walk-ins
 ***************************************************/

/* ========== CONFIG ========== */

// Yaha apna deployed Apps Script Web App URL daalo
const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbxUXXUfHQ132Hy4Fp4cdwCzrAK_dr_MeHCsSjSPLlLMU51r35j2Op64aXImM9nWfEX3FQ/exec';

// Yaha apna Google OAuth Client ID daalo
const GOOGLE_CLIENT_ID = '1029752642188-ku0k9krbdbsttj9br238glq8h4k5loj3.apps.googleusercontent.com';

// Walk-in form public page (GitHub Pages pe walkin_form.html rakhoge)
const WALKIN_FORM_URL = window.location.origin + '/walkin_form.html';

/* ========== GLOBAL STATE ========== */

let currentUser = null;
let idToken = null;
let jobTemplatesCache = [];

// HR / EA lists + UI states
let hrReqList = [];
let hrReqState = { search: '', statusFilter: 'ALL', page: 1, pageSize: 10 };

let shortlistList = [];
let shortlistState = { search: '', page: 1, pageSize: 10 };

let callScreenList = [];
let callScreenState = { search: '', page: 1, pageSize: 10 };

let ownerDiscussList = [];
let ownerDiscussState = { search: '', statusFilter: 'ALL', page: 1, pageSize: 10 };

let scheduleList = [];
let scheduleState = { search: '', page: 1, pageSize: 10 };

let walkinsList = [];
let walkinsState = {
  search: '',
  filter: 'ALL', // ALL / CONFIRM_PENDING / CONFIRMED / APPEARED
  page: 1,
  pageSize: 10
};

/* ========== HELPER UTILS ========== */

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

// Generic pagination footer
function buildPaginationControls(state, totalCount) {
  const totalPages = Math.max(1, Math.ceil((totalCount || 1) / (state.pageSize || 10)));
  const current = Math.min(Math.max(1, state.page || 1), totalPages);

  return `
    <div class="flex-between mt-8">
      <div class="muted">
        Showing page <strong>${current}</strong> of <strong>${totalPages}</strong>
        &middot; Total: <strong>${totalCount}</strong>
      </div>
      <div class="flex">
        <button class="small secondary pag-prev" ${current === 1 ? 'disabled' : ''}>&laquo; Prev</button>
        <button class="small secondary pag-next" ${current === totalPages ? 'disabled' : ''}>Next &raquo;</button>
      </div>
    </div>
  `;
}

/* ========== API CLIENT ========== */

// GET – normal JSON response
async function apiGet(action, params = {}) {
  const url = new URL(API_BASE_URL);
  url.searchParams.set('action', action);
  if (idToken) url.searchParams.set('idToken', idToken);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
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

// POST – fire & forget (NO-CORS, response check nahi)
async function apiPost(action, data = {}) {
  const body = {
    action,
    idToken,
    data
  };

  try {
    await fetch(API_BASE_URL, {
      method: 'POST',
      mode: 'no-cors', // <--- important
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    // no response parsing, assume success
    return { success: true };
  } catch (err) {
    console.error('POST failed:', err);
    throw new Error('Network error while calling ' + action);
  }
}

/* ========== GOOGLE LOGIN (GIS) ========== */

async function handleCredentialResponse(response) {
  try {
    const token = response.credential;
    if (!token) throw new Error('Empty credential from Google.');

    idToken = token;
    $('loginError').innerText = '';

    const me = await apiGet('me');
    currentUser = me.user;
    renderAppAfterLogin();
  } catch (err) {
    console.error(err);
    $('loginError').innerText = 'Login failed: ' + err.message;
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

/* ========== APP BOOT AFTER LOGIN ========== */

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

/* ========== TILES / PANELS ========== */

function renderRoleTiles() {
  const container = $('roleTiles');
  container.innerHTML = '';
  if (!currentUser) return;

  const tiles = [];

  // EA + ADMIN tiles
  if (['EA', 'ADMIN'].includes(currentUser.role)) {
    tiles.push(
      {
        id: 'tile-ea-raise',
        title: 'Raise Requirement',
        desc: 'EA/Admin – new hiring requirement using templates.',
        panelId: 'panelEARequirement'
      },
      {
        id: 'tile-ea-req-view',
        title: 'My Requirements',
        desc: 'EA view – Incomplete vs Valid requirements.',
        panelId: 'panelEARequirementsView'
      },
      {
        id: 'tile-tests',
        title: 'Tests Panel',
        desc: 'Excel / Tally / Voice marks entry.',
        panelId: 'panelTests'
      }
    );
  }

  // HR + ADMIN tiles
  if (['HR', 'ADMIN'].includes(currentUser.role)) {
    tiles.push(
      {
        id: 'tile-hr-req-review',
        title: 'Review Requirements',
        desc: 'HR validation – VALID / SEND_BACK with remarks.',
        panelId: 'panelHRRequirementsReview'
      },
      {
        id: 'tile-hr-upload-cvs',
        title: 'Upload CVs',
        desc: 'Bulk CV upload per requirement (filename parsing).',
        panelId: 'panelHRUploadCVs'
      },
      {
        id: 'tile-hr-shortlist',
        title: 'Shortlisting',
        desc: 'Approve / Reject CVs with “Shortlisting” tag.',
        panelId: 'panelHRShortlisting'
      },
      {
        id: 'tile-hr-call-screen',
        title: 'On-call Screening',
        desc: 'Family background + soft skills scores.',
        panelId: 'panelHRCallScreen'
      },
      {
        id: 'tile-hr-owner-discuss',
        title: 'Discuss with Owners',
        desc: 'Owner decision + walk-in date/time.',
        panelId: 'panelHROwnerDiscuss'
      },
      {
        id: 'tile-hr-job-posting',
        title: 'Job Posting',
        desc: 'Portal-wise posted status + screenshots.',
        panelId: 'panelHRJobPosting'
      },
      {
        id: 'tile-hr-schedule',
        title: 'Schedule Interviews',
        desc: 'Owner-approved → scheduled interviews.',
        panelId: 'panelHRScheduleInterviews'
      },
      {
        id: 'tile-hr-walkins',
        title: 'Walk-ins (Today)',
        desc: 'Today ke interviews, Confirm Call, Appeared → token link.',
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

/* ========== EA: RAISE REQUIREMENT (TEMPLATES) ========== */

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

    await apiPost('create_requirement', {
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
    msgEl.innerText = 'Requirement save request send ho gayi ✅';
  } catch (err) {
    console.error(err);
    msgEl.className = 'error';
    msgEl.innerText = 'Failed: ' + err.message;
  } finally {
    $('btnSaveRequirement').disabled = false;
  }
}

/* ========== EA: MY REQUIREMENTS (INCOMPLETE / VALID) ========== */

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
    container.innerText = 'Error: ' + err.message;
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

/* ========== HR: REVIEW REQUIREMENTS (POLISHED) ========== */

async function loadHRRequirements() {
  const container = $('hrRequirementsContainer');
  container.className = 'mt-12 loader-text';
  container.innerText = 'Loading...';

  try {
    const res = await apiGet('list_requirements');
    hrReqList = res.data || [];
    hrReqState.page = 1;
    renderHRRequirementsTable();
  } catch (err) {
    console.error(err);
    container.className = 'error mt-12';
    container.innerText = 'Error: ' + err.message;
  }
}

function renderHRRequirementsTable() {
  const container = $('hrRequirementsContainer');
  const all = hrReqList || [];

  const search = (hrReqState.search || '').toLowerCase();
  const statusFilter = hrReqState.statusFilter;

  let filtered = all.filter(r => {
    if (statusFilter !== 'ALL' && (r.Status || '') !== statusFilter) return false;

    if (search) {
      const blob = [
        r.RequirementId,
        r.JobRole,
        r.JobTitle,
        r.HRRemark
      ].join(' ').toLowerCase();
      if (!blob.includes(search)) return false;
    }
    return true;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil((total || 1) / hrReqState.pageSize));
  if (hrReqState.page > totalPages) hrReqState.page = totalPages;

  const start = (hrReqState.page - 1) * hrReqState.pageSize;
  const pageItems = filtered.slice(start, start + hrReqState.pageSize);

  if (!total) {
    container.className = 'mt-12';
    container.innerHTML = `
      <div class="flex-between mb-8">
        <div class="flex" style="gap:8px;flex-wrap:wrap;">
          <input id="hrReqSearch" type="text" placeholder="Search by Id / Role / Title..." style="max-width:220px;" />
          <select id="hrReqStatusFilter">
            <option value="ALL">Status: All</option>
            <option value="DRAFT">DRAFT</option>
            <option value="SEND_BACK">SEND_BACK</option>
            <option value="VALID">VALID</option>
          </select>
        </div>
        <span class="muted">No records found.</span>
      </div>
    `;
    wireHRReqFilters();
    return;
  }

  let rows = '';
  pageItems.forEach(r => {
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
          <input class="hr-remark-input" type="text" placeholder="HR remark (SEND_BACK required)" />
          <button class="small btn-save-status">Save</button>
        </td>
      </tr>
    `;
  });

  container.className = 'mt-12';
  container.innerHTML = `
    <div class="flex-between mb-8">
      <div class="flex" style="gap:8px;flex-wrap:wrap;">
        <input id="hrReqSearch" type="text" placeholder="Search by Id / Role / Title..." style="max-width:220px;" value="${htmlEscape(hrReqState.search)}" />
        <select id="hrReqStatusFilter">
          <option value="ALL" ${hrReqState.statusFilter === 'ALL' ? 'selected' : ''}>Status: All</option>
          <option value="DRAFT" ${hrReqState.statusFilter === 'DRAFT' ? 'selected' : ''}>DRAFT</option>
          <option value="SEND_BACK" ${hrReqState.statusFilter === 'SEND_BACK' ? 'selected' : ''}>SEND_BACK</option>
          <option value="VALID" ${hrReqState.statusFilter === 'VALID' ? 'selected' : ''}>VALID</option>
        </select>
      </div>
      <span class="muted">Total: ${total}</span>
    </div>

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
    ${buildPaginationControls(hrReqState, total)}
  `;

  wireHRReqFilters();
  wireHRReqPagination();

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
        alert('Updated.');
        await loadHRRequirements(); // re-fetch
      } catch (err) {
        console.error(err);
        alert('Error: ' + err.message);
      } finally {
        btn.disabled = false;
      }
    });
  });
}

function wireHRReqFilters() {
  const searchInput = $('hrReqSearch');
  const statusSelect = $('hrReqStatusFilter');

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      hrReqState.search = searchInput.value;
      hrReqState.page = 1;
      renderHRRequirementsTable();
    });
  }
  if (statusSelect) {
    statusSelect.addEventListener('change', () => {
      hrReqState.statusFilter = statusSelect.value;
      hrReqState.page = 1;
      renderHRRequirementsTable();
    });
  }
}

function wireHRReqPagination() {
  const container = $('hrRequirementsContainer');
  const prevBtn = container.querySelector('.pag-prev');
  const nextBtn = container.querySelector('.pag-next');
  const total = (hrReqList || []).length;
  const totalPages = Math.max(1, Math.ceil((total || 1) / hrReqState.pageSize));

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (hrReqState.page > 1) {
        hrReqState.page--;
        renderHRRequirementsTable();
      }
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (hrReqState.page < totalPages) {
        hrReqState.page++;
        renderHRRequirementsTable();
      }
    });
  }
}

/* ========== HR: UPLOAD CVS (BULK) ========== */

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

    await apiPost('batch_upload_cvs', {
      requirementId: reqId,
      files
    });

    msgEl.className = 'success';
    msgEl.innerText = `Upload request send ho gayi ✅ (${files.length} CVs)`;
  } catch (err) {
    console.error(err);
    msgEl.className = 'error';
    msgEl.innerText = 'Error: ' + err.message;
  } finally {
    $('btnUploadCVs').disabled = false;
  }
}

/* ========== HR: SHORTLISTING (SEARCH + PAGINATION) ========== */

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
    shortlistList = (res.data || []).filter(c =>
      ['UPLOADED', 'SHORTLISTED'].includes(c.Status)
    );
    shortlistState.page = 1;
    renderShortlistingTable();
  } catch (err) {
    console.error(err);
    container.className = 'error mt-12';
    container.innerText = 'Error: ' + err.message;
  }
}

function renderShortlistingTable() {
  const container = $('shortlistContainer');
  const all = shortlistList || [];

  const search = (shortlistState.search || '').toLowerCase();

  let filtered = all.filter(c => {
    if (!search) return true;
    const blob = [
      c.CandidateId,
      c.CandidateName,
      c.Mobile,
      c.Source
    ].join(' ').toLowerCase();
    return blob.includes(search);
  });

  const total = filtered.length;
  if (!total) {
    container.className = 'mt-12';
    container.innerHTML = `
      <div class="flex-between mb-8">
        <input id="shortlistSearch" type="text" placeholder="Search by name / mobile / source..." style="max-width:260px;" />
        <span class="muted">No candidates for shortlisting.</span>
      </div>
    `;
    wireShortlistFilters();
    return;
  }

  const totalPages = Math.max(1, Math.ceil((total || 1) / shortlistState.pageSize));
  if (shortlistState.page > totalPages) shortlistState.page = totalPages;

  const start = (shortlistState.page - 1) * shortlistState.pageSize;
  const pageItems = filtered.slice(start, start + shortlistState.pageSize);

  let rows = '';
  pageItems.forEach(c => {
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

  container.className = 'mt-12';
  container.innerHTML = `
    <div class="flex-between mb-8">
      <input id="shortlistSearch" type="text" placeholder="Search by name / mobile / source..." style="max-width:260px;" value="${htmlEscape(shortlistState.search)}" />
      <span class="muted">Total: ${total}</span>
    </div>
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
    ${buildPaginationControls(shortlistState, total)}
  `;

  wireShortlistFilters();
  wireShortlistPagination();

  container.querySelectorAll('.btn-approve').forEach(btn => {
    btn.addEventListener('click', () => shortlistDecision(btn, 'APPROVE'));
  });
  container.querySelectorAll('.btn-reject').forEach(btn => {
    btn.addEventListener('click', () => shortlistDecision(btn, 'REJECT'));
  });
}

function wireShortlistFilters() {
  const input = $('shortlistSearch');
  if (input) {
    input.addEventListener('input', () => {
      shortlistState.search = input.value;
      shortlistState.page = 1;
      renderShortlistingTable();
    });
  }
}

function wireShortlistPagination() {
  const container = $('shortlistContainer');
  const prevBtn = container.querySelector('.pag-prev');
  const nextBtn = container.querySelector('.pag-next');
  const total = (shortlistList || []).length;
  const totalPages = Math.max(1, Math.ceil((total || 1) / shortlistState.pageSize));

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (shortlistState.page > 1) {
        shortlistState.page--;
        renderShortlistingTable();
      }
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (shortlistState.page < totalPages) {
        shortlistState.page++;
        renderShortlistingTable();
      }
    });
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
    alert('Saved.');
    loadShortlisting();
  } catch (err) {
    console.error(err);
    alert('Error: ' + err.message);
  } finally {
    btn.disabled = false;
  }
}

/* ========== HR: CALL SCREENING (SEARCH + PAGINATION) ========== */

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
    callScreenList = (res.data || []).filter(c => c.Status === 'SHORTLISTED');
    callScreenState.page = 1;
    renderCallScreenTable();
  } catch (err) {
    console.error(err);
    container.className = 'error mt-12';
    container.innerText = 'Error: ' + err.message;
  }
}

function renderCallScreenTable() {
  const container = $('callScreenContainer');
  const all = callScreenList || [];
  const search = (callScreenState.search || '').toLowerCase();

  let filtered = all.filter(c => {
    if (!search) return true;
    const blob = [
      c.CandidateId,
      c.CandidateName,
      c.Mobile,
      c.Source
    ].join(' ').toLowerCase();
    return blob.includes(search);
  });

  const total = filtered.length;
  if (!total) {
    container.className = 'mt-12';
    container.innerHTML = `
      <div class="flex-between mb-8">
        <input id="callScreenSearch" type="text" placeholder="Search by name / mobile / source..." style="max-width:260px;" />
        <span class="muted">No candidates for call screening.</span>
      </div>
    `;
    wireCallScreenFilters();
    return;
  }

  const totalPages = Math.max(1, Math.ceil((total || 1) / callScreenState.pageSize));
  if (callScreenState.page > totalPages) callScreenState.page = totalPages;

  const start = (callScreenState.page - 1) * callScreenState.pageSize;
  const pageItems = filtered.slice(start, start + callScreenState.pageSize);

  let rows = '';
  pageItems.forEach(c => {
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

  container.className = 'mt-12';
  container.innerHTML = `
    <div class="flex-between mb-8">
      <input id="callScreenSearch" type="text" placeholder="Search by name / mobile / source..." style="max-width:260px;" value="${htmlEscape(callScreenState.search)}" />
      <span class="muted">Total: ${total}</span>
    </div>
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
    ${buildPaginationControls(callScreenState, total)}
  `;

  wireCallScreenFilters();
  wireCallScreenPagination();
  container.querySelectorAll('.btn-save-call').forEach(btn => {
    btn.addEventListener('click', () => saveCallScreenRow(btn));
  });
}

function wireCallScreenFilters() {
  const input = $('callScreenSearch');
  if (input) {
    input.addEventListener('input', () => {
      callScreenState.search = input.value;
      callScreenState.page = 1;
      renderCallScreenTable();
    });
  }
}

function wireCallScreenPagination() {
  const container = $('callScreenContainer');
  const prevBtn = container.querySelector('.pag-prev');
  const nextBtn = container.querySelector('.pag-next');
  const total = (callScreenList || []).length;
  const totalPages = Math.max(1, Math.ceil((total || 1) / callScreenState.pageSize));

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (callScreenState.page > 1) {
        callScreenState.page--;
        renderCallScreenTable();
      }
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (callScreenState.page < totalPages) {
        callScreenState.page++;
        renderCallScreenTable();
      }
    });
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
    alert('Saved.');
  } catch (err) {
    console.error(err);
    alert('Error: ' + err.message);
  } finally {
    btn.disabled = false;
  }
}

/* ========== HR: OWNER DISCUSSION ========== */

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
    ownerDiscussList = (res.data || []).filter(c =>
      ['SHORTLISTED', 'ON_HOLD'].includes(c.Status)
    );
    ownerDiscussState.page = 1;
    renderOwnerDiscussTable();
  } catch (err) {
    console.error(err);
    container.className = 'error mt-12';
    container.innerText = 'Error: ' + err.message;
  }
}

function renderOwnerDiscussTable() {
  const container = $('ownerDiscussContainer');
  const all = ownerDiscussList || [];

  const search = (ownerDiscussState.search || '').toLowerCase();
  const statusFilter = ownerDiscussState.statusFilter;

  let filtered = all.filter(c => {
    if (statusFilter !== 'ALL' && (c.Status || '') !== statusFilter) return false;
    if (!search) return true;
    const blob = [
      c.CandidateId,
      c.CandidateName,
      c.JobRole,
      c.JobTitle
    ].join(' ').toLowerCase();
    return blob.includes(search);
  });

  const total = filtered.length;
  if (!total) {
    container.className = 'mt-12';
    container.innerHTML = `
      <div class="flex-between mb-8">
        <div class="flex" style="gap:8px;flex-wrap:wrap;">
          <input id="ownerSearch" type="text" placeholder="Search by name / role / title..." style="max-width:260px;" />
          <select id="ownerStatusFilter">
            <option value="ALL">Stage: All</option>
            <option value="SHORTLISTED">SHORTLISTED</option>
            <option value="ON_HOLD">ON_HOLD</option>
          </select>
        </div>
        <span class="muted">No candidates for owner discussion.</span>
      </div>
    `;
    wireOwnerDiscussFilters();
    return;
  }

  const totalPages = Math.max(1, Math.ceil((total || 1) / ownerDiscussState.pageSize));
  if (ownerDiscussState.page > totalPages) ownerDiscussState.page = totalPages;

  const start = (ownerDiscussState.page - 1) * ownerDiscussState.pageSize;
  const pageItems = filtered.slice(start, start + ownerDiscussState.pageSize);

  let rows = '';
  pageItems.forEach(c => {
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

  container.className = 'mt-12';
  container.innerHTML = `
    <div class="flex-between mb-8">
      <div class="flex" style="gap:8px;flex-wrap:wrap;">
        <input id="ownerSearch" type="text" placeholder="Search by name / role / title..." style="max-width:260px;" value="${htmlEscape(ownerDiscussState.search)}" />
        <select id="ownerStatusFilter">
          <option value="ALL" ${ownerDiscussState.statusFilter === 'ALL' ? 'selected' : ''}>Stage: All</option>
          <option value="SHORTLISTED" ${ownerDiscussState.statusFilter === 'SHORTLISTED' ? 'selected' : ''}>SHORTLISTED</option>
          <option value="ON_HOLD" ${ownerDiscussState.statusFilter === 'ON_HOLD' ? 'selected' : ''}>ON_HOLD</option>
        </select>
      </div>
      <span class="muted">Total: ${total}</span>
    </div>
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
    ${buildPaginationControls(ownerDiscussState, total)}
  `;

  wireOwnerDiscussFilters();
  wireOwnerDiscussPagination();
  container.querySelectorAll('.btn-save-owner').forEach(btn => {
    btn.addEventListener('click', () => saveOwnerRow(btn));
  });
}

function wireOwnerDiscussFilters() {
  const searchInput = $('ownerSearch');
  const statusSelect = $('ownerStatusFilter');

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      ownerDiscussState.search = searchInput.value;
      ownerDiscussState.page = 1;
      renderOwnerDiscussTable();
    });
  }
  if (statusSelect) {
    statusSelect.addEventListener('change', () => {
      ownerDiscussState.statusFilter = statusSelect.value;
      ownerDiscussState.page = 1;
      renderOwnerDiscussTable();
    });
  }
}

function wireOwnerDiscussPagination() {
  const container = $('ownerDiscussContainer');
  const prevBtn = container.querySelector('.pag-prev');
  const nextBtn = container.querySelector('.pag-next');
  const total = (ownerDiscussList || []).length;
  const totalPages = Math.max(1, Math.ceil((total || 1) / ownerDiscussState.pageSize));

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (ownerDiscussState.page > 1) {
        ownerDiscussState.page--;
        renderOwnerDiscussTable();
      }
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (ownerDiscussState.page < totalPages) {
        ownerDiscussState.page++;
        renderOwnerDiscussTable();
      }
    });
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
    alert('Saved.');
  } catch (err) {
    console.error(err);
    alert('Error: ' + err.message);
  } finally {
    btn.disabled = false;
  }
}

/* ========== HR: JOB POSTING ========== */

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
      <div class="muted mb-8">
        Portal wise status maintain karo – tick = posted, URL = screenshot link (Drive / portal).
      </div>
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
    container.innerText = 'Error: ' + err.message;
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
    alert('Job posting status saved.');
  } catch (err) {
    console.error(err);
    alert('Error: ' + err.message);
  }
}

/* ========== HR: SCHEDULE INTERVIEWS ========== */

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
    scheduleList = (res.data || []).filter(c =>
      ['OWNER_APPROVED_WALKIN', 'SCHEDULED'].includes(c.Status)
    );
    scheduleState.page = 1;
    renderScheduleTable();
  } catch (err) {
    console.error(err);
    container.className = 'error mt-12';
    container.innerText = 'Error: ' + err.message;
  }
}

function renderScheduleTable() {
  const container = $('scheduleContainer');
  const all = scheduleList || [];
  const search = (scheduleState.search || '').toLowerCase();

  let filtered = all.filter(c => {
    if (!search) return true;
    const blob = [
      c.CandidateId,
      c.CandidateName,
      c.JobRole,
      c.JobTitle
    ].join(' ').toLowerCase();
    return blob.includes(search);
  });

  const total = filtered.length;
  if (!total) {
    container.className = 'mt-12';
    container.innerHTML = `
      <div class="flex-between mb-8">
        <input id="scheduleSearch" type="text" placeholder="Search by name / role / title..." style="max-width:260px;" />
        <span class="muted">No candidates for scheduling.</span>
      </div>
    `;
    wireScheduleFilters();
    return;
  }

  const totalPages = Math.max(1, Math.ceil((total || 1) / scheduleState.pageSize));
  if (scheduleState.page > totalPages) scheduleState.page = totalPages;

  const start = (scheduleState.page - 1) * scheduleState.pageSize;
  const pageItems = filtered.slice(start, start + scheduleState.pageSize);

  let rows = '';
  pageItems.forEach(c => {
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

  container.className = 'mt-12';
  container.innerHTML = `
    <div class="flex-between mb-8">
      <input id="scheduleSearch" type="text" placeholder="Search by name / role / title..." style="max-width:260px;" value="${htmlEscape(scheduleState.search)}" />
      <span class="muted">Total: ${total}</span>
    </div>
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
    ${buildPaginationControls(scheduleState, total)}
  `;

  wireScheduleFilters();
  wireSchedulePagination();
  container.querySelectorAll('.btn-save-sched').forEach(btn => {
    btn.addEventListener('click', () => saveScheduleRow(btn));
  });
}

function wireScheduleFilters() {
  const input = $('scheduleSearch');
  if (input) {
    input.addEventListener('input', () => {
      scheduleState.search = input.value;
      scheduleState.page = 1;
      renderScheduleTable();
    });
  }
}

function wireSchedulePagination() {
  const container = $('scheduleContainer');
  const prevBtn = container.querySelector('.pag-prev');
  const nextBtn = container.querySelector('.pag-next');
  const total = (scheduleList || []).length;
  const totalPages = Math.max(1, Math.ceil((total || 1) / scheduleState.pageSize));

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (scheduleState.page > 1) {
        scheduleState.page--;
        renderScheduleTable();
      }
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (scheduleState.page < totalPages) {
        scheduleState.page++;
        renderScheduleTable();
      }
    });
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
    alert('Interview scheduled.');
  } catch (err) {
    console.error(err);
    alert('Error: ' + err.message);
  } finally {
    btn.disabled = false;
  }
}

/* ========== HR: WALK-INS (TODAY + TOKEN LINK) ========== */

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
    walkinsList = res.data || [];
    walkinsState.page = 1;
    renderWalkinsTable();
  } catch (err) {
    console.error(err);
    container.className = 'error mt-12';
    container.innerText = 'Error: ' + err.message;
  }
}

function renderWalkinsTable() {
  const container = $('walkinsContainer');
  const all = walkinsList || [];
  const search = (walkinsState.search || '').toLowerCase();
  const filter = walkinsState.filter;

  let filtered = all.filter(c => {
    if (filter === 'CONFIRM_PENDING' && c.ConfirmedCall) return false;
    if (filter === 'CONFIRMED' && !c.ConfirmedCall) return false;
    if (filter === 'APPEARED' && !c.Appeared) return false;

    if (!search) return true;
    const blob = [
      c.CandidateId,
      c.CandidateName,
      c.Mobile,
      c.JobRole,
      c.JobTitle
    ].join(' ').toLowerCase();
    return blob.includes(search);
  });

  const total = filtered.length;
  if (!total) {
    container.className = 'mt-12';
    container.innerHTML = `
      <div class="flex-between mb-8">
        <div class="flex" style="gap:8px;flex-wrap:wrap;">
          <input id="walkinSearch" type="text" placeholder="Search by name / mobile / role..." style="max-width:260px;" />
          <select id="walkinFilter">
            <option value="ALL">All</option>
            <option value="CONFIRM_PENDING">Confirm Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="APPEARED">Appeared</option>
          </select>
        </div>
        <span class="muted">No interviews for this date.</span>
      </div>
    `;
    wireWalkinsFilters();
    return;
  }

  const totalPages = Math.max(1, Math.ceil((total || 1) / walkinsState.pageSize));
  if (walkinsState.page > totalPages) walkinsState.page = totalPages;

  const start = (walkinsState.page - 1) * walkinsState.pageSize;
  const pageItems = filtered.slice(start, start + walkinsState.pageSize);

  let rows = '';
  pageItems.forEach(c => {
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

  container.className = 'mt-12';
  container.innerHTML = `
    <div class="flex-between mb-8">
      <div class="flex" style="gap:8px;flex-wrap:wrap;">
        <input id="walkinSearch" type="text" placeholder="Search by name / mobile / role..." style="max-width:260px;" value="${htmlEscape(walkinsState.search)}" />
        <select id="walkinFilter">
          <option value="ALL" ${walkinsState.filter === 'ALL' ? 'selected' : ''}>All</option>
          <option value="CONFIRM_PENDING" ${walkinsState.filter === 'CONFIRM_PENDING' ? 'selected' : ''}>Confirm Pending</option>
          <option value="CONFIRMED" ${walkinsState.filter === 'CONFIRMED' ? 'selected' : ''}>Confirmed</option>
          <option value="APPEARED" ${walkinsState.filter === 'APPEARED' ? 'selected' : ''}>Appeared</option>
        </select>
      </div>
      <span class="muted">Total: ${total}</span>
    </div>
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
    ${buildPaginationControls(walkinsState, total)}
  `;

  wireWalkinsFilters();
  wireWalkinsPagination();
  container.querySelectorAll('.w-conf').forEach(chk => {
    chk.addEventListener('change', () => saveWalkinConfirm(chk));
  });
  container.querySelectorAll('.btn-mark-appeared').forEach(btn => {
    btn.addEventListener('click', () => markWalkinAppeared(btn));
  });
}

function wireWalkinsFilters() {
  const searchInput = $('walkinSearch');
  const filterSelect = $('walkinFilter');

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      walkinsState.search = searchInput.value;
      walkinsState.page = 1;
      renderWalkinsTable();
    });
  }
  if (filterSelect) {
    filterSelect.addEventListener('change', () => {
      walkinsState.filter = filterSelect.value;
      walkinsState.page = 1;
      renderWalkinsTable();
    });
  }
}

function wireWalkinsPagination() {
  const container = $('walkinsContainer');
  const prevBtn = container.querySelector('.pag-prev');
  const nextBtn = container.querySelector('.pag-next');
  const total = (walkinsList || []).length;
  const totalPages = Math.max(1, Math.ceil((total || 1) / walkinsState.pageSize));

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (walkinsState.page > 1) {
        walkinsState.page--;
        renderWalkinsTable();
      }
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (walkinsState.page < totalPages) {
        walkinsState.page++;
        renderWalkinsTable();
      }
    });
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
  } catch (err) {
    console.error(err);
    alert('Error: ' + err.message);
    chk.checked = !confirmed;
  }
}

async function markWalkinAppeared(btn) {
  const tr = btn.closest('tr');
  const cid = tr.getAttribute('data-cid');
  const linkCell = tr.querySelector('.walkin-link-cell');

  // Frontend se token generate
  const token =
    'WALKIN-' +
    Date.now() +
    '-' +
    Math.random().toString(36).slice(2, 10);

  btn.disabled = true;
  linkCell.innerHTML = '<span class="loader-text">Generating...</span>';

  try {
    await apiPost('walkin_mark_appeared', {
      candidateId: cid,
      walkinToken: token
    });

    const link = `${WALKIN_FORM_URL}?walkinToken=${encodeURIComponent(token)}`;
    linkCell.innerHTML = `
      <a href="${link}" target="_blank" class="link">
        Open Walk-in Form
      </a>
    `;
  } catch (err) {
    console.error(err);
    linkCell.innerHTML = '<span class="error">Error generating link.</span>';
  } finally {
    btn.disabled = false;
  }
}

/* ========== TESTS PANEL (Excel / Tally / Voice) ========== */

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
    await apiPost('update_tests', data);
    msgEl.className = 'success';
    msgEl.innerText = 'Marks updated.';
  } catch (err) {
    console.error(err);
    msgEl.className = 'error';
    msgEl.innerText = 'Error: ' + err.message;
  } finally {
    $('btnSaveTests').disabled = false;
  }
}

/* ========== BUTTON WIRING ========== */

function wireAllButtons() {
  const signOut = $('btnSignOut');
  if (signOut) {
    signOut.addEventListener('click', () => {
      currentUser = null;
      idToken = null;
      location.reload();
    });
  }

  // EA
  const loadTplBtn = $('btnLoadTemplate');
  if (loadTplBtn) loadTplBtn.addEventListener('click', applyTemplateForSelectedRole);

  const saveReqBtn = $('btnSaveRequirement');
  if (saveReqBtn) saveReqBtn.addEventListener('click', saveRequirementEA);

  const refreshEAReqBtn = $('btnRefreshEARequirements');
  if (refreshEAReqBtn) refreshEAReqBtn.addEventListener('click', loadEARequirementsView);

  // HR requirements
  const refreshHRReqBtn = $('btnRefreshHRRequirements');
  if (refreshHRReqBtn) refreshHRReqBtn.addEventListener('click', loadHRRequirements);

  // Upload CVs
  const uploadBtn = $('btnUploadCVs');
  if (uploadBtn) uploadBtn.addEventListener('click', uploadCVs);

  // Shortlisting
  const loadShortlistBtn = $('btnLoadShortlist');
  if (loadShortlistBtn) loadShortlistBtn.addEventListener('click', loadShortlisting);

  // Call Screening
  const loadCallScreenBtn = $('btnLoadCallScreen');
  if (loadCallScreenBtn) loadCallScreenBtn.addEventListener('click', loadCallScreening);

  // Owner Discussion
  const loadOwnerBtn = $('btnLoadOwnerDiscuss');
  if (loadOwnerBtn) loadOwnerBtn.addEventListener('click', loadOwnerDiscuss);

  // Job Posting
  const loadPostingBtn = $('btnLoadJobPosting');
  if (loadPostingBtn) loadPostingBtn.addEventListener('click', loadJobPosting);

  // Schedule Interviews
  const loadScheduleBtn = $('btnLoadSchedule');
  if (loadScheduleBtn) loadScheduleBtn.addEventListener('click', loadScheduleInterviews);

  // Walk-ins
  const loadWalkinsBtn = $('btnLoadWalkins');
  if (loadWalkinsBtn) loadWalkinsBtn.addEventListener('click', loadWalkins);

  // Tests
  const saveTestsBtn = $('btnSaveTests');
  if (saveTestsBtn) saveTestsBtn.addEventListener('click', saveTests);
}

/* ========== BOOTSTRAP ========== */

window.onload = function () {
  initGoogleLogin();
};
