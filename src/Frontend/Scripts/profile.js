"use strict";

/*
 * AssignCheck Profile Page - ENHANCED & DEBUGGED
 * Uses JWT token from localStorage.
 * Includes robust data extraction and console debugging to identify display issues.
 */

// 1. API URLs (Consider making this relative or env-based in production)
const API_BASE = "http://localhost:8005"; 
const PROFILE_API = `${API_BASE}/profile`;
const FILEDATA_API = `${API_BASE}/filedata`;
const FILERESULT_API = `${API_BASE}/fileresult`;

// 2. HTML elements
const userNameEl = document.getElementById("userName");
const avatarEl = document.getElementById("avatar");
const navAvatarEl = document.getElementById("navAvatar");
const totalFilesEl = document.getElementById("totalFiles");
const totalSizeEl = document.getElementById("totalSize");
const totalAnalysesEl = document.getElementById("totalAnalyses");
const lastUploadEl = document.getElementById("lastUpload");
const fileCountEl = document.getElementById("fileCount");
const fileListEl = document.getElementById("fileList");
const detailNameEl = document.getElementById("detailName");
const logoutBtn = document.getElementById("logoutBtn");
const toastEl = document.getElementById("toast");
const reportListEl = document.getElementById("reportList"); // Added for consistency

// 3. Page data
let currentUser = null;
let currentFileData = null;
let currentResultData = [];
let profileFiles = [];
let analysisResults = [];
let toastTimeout = null;

// 4. General helpers
function safeText(value, fallback = "") {
    if (value === undefined || value === null || value === "") return fallback;
    if (typeof value === "object") {
        try { return JSON.stringify(value); } catch { return fallback; }
    }
    return String(value);
}

function getInitial(name) {
    return safeText(name, "User").trim().charAt(0).toUpperCase() || "U";
}

function formatBytes(value) {
    let bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let unitIndex = 0;
    while (bytes >= 1024 && unitIndex < units.length - 1) {
        bytes /= 1024;
        unitIndex++;
    }
    return unitIndex === 0 ? `${Math.round(bytes)} B` : `${bytes.toFixed(2)} ${units[unitIndex]}`;
}

function formatDate(value) {
    if (!value) return "—";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    // Uses browser locale, falls back to en-IN
    return date.toLocaleString(navigator.language || "en-IN", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
}

function showToast(message) {
    if (!toastEl) { console.log("[TOAST]", message); return; }
    toastEl.textContent = message;
    toastEl.classList.add("show");
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toastEl.classList.remove("show"), 4000);
}

function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function firstDefined(object, keys, fallback = undefined) {
    if (!isObject(object)) return fallback;
    for (const key of keys) {
        if (object[key] !== undefined && object[key] !== null) return object[key];
    }
    return fallback;
}

// 5. Authentication helpers
function getToken() { return localStorage.getItem("token"); }
function getAuthHeaders() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

// 6. Common API request helper
async function fetchJSON(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: { Accept: "application/json", ...(options.headers || {}), ...getAuthHeaders() }
    });

    const rawText = await response.text();
    let payload = {};
    if (rawText) {
        try { payload = JSON.parse(rawText); } catch { payload = { message: rawText }; }
    }

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem("token");
            localStorage.removeItem("loggedIn");
            window.location.href = "../Templates/index.html";
        }
        throw new Error(firstDefined(payload, ["message", "error", "detail"], `Request failed with status ${response.status}`));
    }
    return payload;
}

// Enhanced Unwrap: Recursively extracts common wrapper keys safely
function extractPayload(payload) {
    if (!payload) return null;
    const wrappers = ["data", "result", "payload", "response", "body", "docs", "items"];
    let current = payload;
    
    for (let i = 0; i < 5; i++) {
        if (!isObject(current)) break;
        const wrapperKey = wrappers.find(key => current[key] !== undefined && current[key] !== null);
        if (!wrapperKey) break;
        current = current[wrapperKey];
    }
    return current;
}

// 7. GET USER PROFILE
async function getUser() {
    if (!getToken()) { window.location.href = "../Templates/index.html"; return null; }
    const response = await fetchJSON(PROFILE_API, { method: "GET" });
    console.log("🔍 Raw Profile API Response:", response);

    const candidate = firstDefined(response, ["user", "profile", "currentUser", "data"], undefined);
    if (candidate) {
        console.log("✅ Extracted Profile Candidate:", candidate);
        return isObject(candidate) ? candidate : response;
    }
    return extractPayload(response) || response;
}

// 8. GET USER FILE DATA
async function getFileData() {
    const response = await fetchJSON(FILEDATA_API, { method: "GET" });
    console.log("🔍 Raw File Data API Response:", response);

    const candidate = firstDefined(response, ["datafiles", "filedata", "fileData", "filesData", "files", "data"], undefined);
    const extracted = candidate !== undefined ? extractPayload(candidate) : extractPayload(response);
    
    console.log("✅ Extracted File Data:", extracted);
    return extracted;
}

// 9. GET USER ANALYSIS RESULTS
async function getFileResults() {
    const response = await fetchJSON(FILERESULT_API, { method: "GET" });
    console.log("🔍 Raw File Results API Response:", response);

    const candidate = firstDefined(response, ["dataresults", "fileresults", "fileResults", "results", "analyses", "data"], undefined);
    const extracted = candidate !== undefined ? extractPayload(candidate) : extractPayload(response);

    if (Array.isArray(extracted)) {
        console.log("✅ Extracted Results (Array):", extracted);
        return extracted;
    }
    if (extracted === null || extracted === undefined || extracted === "") {
        console.log("✅ Extracted Results: Empty");
        return [];
    }
    console.log("✅ Extracted Results (Wrapped):", [extracted]);
    return [extracted];
}

// 10. DISPLAY USER PROFILE
function updateProfile(user) {
    console.log("🎨 Rendering Profile:", user);
    const nestedUser = isObject(user?.user) ? user.user : {};

    const name = safeText(
        firstDefined(user, ["username", "name", "fullName", "fullname", "displayName", "email"],
        firstDefined(nestedUser, ["username", "name", "fullName", "email"], "User")),
        "User"
    );

    const initial = getInitial(name);
    if (userNameEl) userNameEl.textContent = name;
    if (detailNameEl) detailNameEl.textContent = name;
    if (avatarEl) avatarEl.textContent = initial;
    if (navAvatarEl) navAvatarEl.textContent = initial;

    if (isObject(user)) {
        document.querySelectorAll("[data-profile-field]").forEach(element => {
            const field = element.getAttribute("data-profile-field");
            if (field && user[field] !== undefined && user[field] !== null) {
                element.textContent = safeText(user[field], "—");
            }
        });
    }
}

// 11. EXTRACT UPLOADED FILES
function getFilesFromFileData(fileData) {
    if (Array.isArray(fileData)) return fileData;
    if (!isObject(fileData)) return [];

    const directFiles = firstDefined(fileData, ["filedetails", "files", "uploadedFiles", "documents", "data", "docs"], undefined);
    if (Array.isArray(directFiles)) return directFiles;

    if (isObject(fileData.data)) return getFilesFromFileData(fileData.data);
    if (isObject(fileData.filedata)) return getFilesFromFileData(fileData.filedata);

    return [];
}

function getFileName(file) {
    return safeText(firstDefined(file, ["filename", "fileName", "name", "originalname", "originalName", "title"], "Unknown file"));
}

function getFileSize(file) {
    const size = Number(firstDefined(file, ["filesize", "fileSize", "size", "sizeBytes", "bytes"], 0));
    return Number.isFinite(size) && size > 0 ? size : 0;
}

function getFileDate(file) {
    return firstDefined(file, ["uploadedAt", "createdAt", "uploadDate", "date", "timestamp", "updatedAt"], null);
}

// 12. EXTRACT SAVED REPORTS
function getSavedReports(resultData) {
    const reports = [];

    function addReport(report, mode) {
        if (!isObject(report)) return;
        // Expanded keys to catch more API variations
        const isReport = [
            "filenames", "fileNames", "files",
            "roundedscore", "roundedScore", "score", "similarity", "similarityScore", "matchPercentage",
            "textA", "textB", 
            "filefirstmatches", "fileFirstMatches", "filesecondmatches", "fileSecondMatches"
        ].some(key => report[key] !== undefined);

        if (!isReport) return;
        reports.push({ ...report, _displayMode: report.mode || mode || "" });
    }

    function readSession(session, inheritedMode = "") {
        if (Array.isArray(session)) {
            let mode = inheritedMode;
            let startIndex = 0;
            if (isObject(session[0]) && session[0].mode) {
                mode = session[0].mode;
                startIndex = 1;
            }
            session.slice(startIndex).forEach(item => {
                if (Array.isArray(item)) readSession(item, mode);
                else addReport(item, mode);
            });
            return;
        }
        if (!isObject(session)) return;

        const mode = safeText(firstDefined(session, ["mode", "type"], inheritedMode), inheritedMode);
        const nested = firstDefined(session, ["filesprocesed", "filesProcessed", "analysisResults", "analyses", "reports", "results", "data"], undefined);

        if (Array.isArray(nested)) nested.forEach(item => readSession(item, mode));
        else addReport(session, mode);
    }

    const records = Array.isArray(resultData) ? resultData : (resultData ? [resultData] : []);
    records.forEach(record => readSession(record));
    
    console.log("📊 Processed Reports:", reports);
    return reports;
}

// 13. UPDATE STATISTICS
function updateStatistics(files, resultData) {
    const safeFiles = Array.isArray(files) ? files : [];
    const totalBytes = safeFiles.reduce((sum, file) => sum + getFileSize(file), 0);

    const dates = safeFiles.map(getFileDate).filter(Boolean).map(value => new Date(value)).filter(date => !Number.isNaN(date.getTime()));
    const latestDate = dates.length ? new Date(Math.max(...dates.map(date => date.getTime()))) : null;
    
    analysisResults = getSavedReports(resultData);

    if (totalFilesEl) totalFilesEl.textContent = String(safeFiles.length);
    if (fileCountEl) fileCountEl.textContent = String(safeFiles.length);
    if (totalSizeEl) totalSizeEl.textContent = formatBytes(totalBytes);
    if (totalAnalysesEl) totalAnalysesEl.textContent = String(analysisResults.length);
    if (lastUploadEl) {
        lastUploadEl.textContent = latestDate ? formatDate(latestDate) : (safeFiles.length ? "Date unavailable" : "—");
    }
}

// 14. DETERMINE FILE TYPE
function getFileType(filename) {
    const extension = safeText(filename).toLowerCase().split(".").pop();
    const types = {
        pdf: ["PDF", "pdf"], doc: ["DOC", "doc"], docx: ["DOCX", "doc"],
        ppt: ["PPT", "ppt"], pptx: ["PPTX", "ppt"], txt: ["TXT", "txt"],
        csv: ["CSV", "csv"], xls: ["XLS", "xls"], xlsx: ["XLSX", "xls"]
    };
    const type = types[extension] || [extension && extension.length <= 5 ? extension.toUpperCase() : "FILE", "file"];
    return { label: type[0], className: type[1] };
}

// 15. SHOW EMPTY FILE MESSAGE
function renderEmptyFiles() {
    if (!fileListEl) return;
    fileListEl.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">↑</div>
            <h3>No files uploaded yet</h3>
            <p>Upload assignments to start your first analysis.</p>
        </div>
    `;
}

// 16. DISPLAY UPLOADED FILES
function renderFiles(files) {
    if (!fileListEl) return;
    if (!Array.isArray(files) || files.length === 0) {
        renderEmptyFiles();
        return;
    }

    fileListEl.innerHTML = "";
    files.slice().reverse().forEach(file => {
        const filename = getFileName(file);
        const size = getFileSize(file);
        const date = getFileDate(file);
        const type = getFileType(filename);

        const card = document.createElement("div");
        card.className = "profile-file-item";

        const icon = document.createElement("div");
        icon.className = `profile-file-icon ${type.className}`;
        icon.textContent = type.label;

        const info = document.createElement("div");
        info.className = "profile-file-info";

        const name = document.createElement("div");
        name.className = "profile-file-name";
        name.textContent = filename;

        const meta = document.createElement("div");
        meta.className = "profile-file-meta";
        meta.textContent = [type.label, size ? formatBytes(size) : "Size unavailable", date ? formatDate(date) : "Date unavailable"].join(" • ");

        info.append(name, meta);
        card.append(icon, info);

        const excludedFields = [
            "_id", "__v", "filename", "fileName", "name", "originalname", "originalName",
            "filesize", "fileSize", "size", "sizeBytes", "bytes", "uploadedAt", "createdAt",
            "uploadDate", "date", "timestamp", "chunks", "buffer", "content", "data", "title"
        ];

        const extraFields = Object.entries(file || {}).filter(
            ([key, value]) => !excludedFields.includes(key) && value !== undefined && value !== null && typeof value !== "object"
        );

        if (extraFields.length) {
            const extra = document.createElement("div");
            extra.className = "profile-file-extra";
            extra.textContent = extraFields.map(([key, value]) => `${key}: ${value}`).join(" · ");
            card.appendChild(extra);
        }

        fileListEl.appendChild(card);
    });
}

// 17. REPORT DISPLAY HELPERS
function displayValue(value) {
    if (value === undefined || value === null || value === "") return "Not available";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
    try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function makeDetailRow(label, value) {
    if (value === undefined || value === null || value === "") return null;
    const row = document.createElement("div");
    row.className = "report-detail-row";
    const heading = document.createElement("strong");
    heading.textContent = `${label}: `;
    const content = document.createElement("span");
    content.textContent = displayValue(value);
    row.append(heading, content);
    return row;
}

function getReportFiles(report) {
    const names = firstDefined(report, ["filenames", "fileNames", "files"], []);
    if (Array.isArray(names)) return names.map(item => typeof item === "object" ? getFileName(item) : safeText(item));
    if (typeof names === "string") return [names];
    return [firstDefined(report, ["filename", "fileName", "title"], "Assignment Analysis")].filter(Boolean);
}

function getReportScore(report) {
    const raw = firstDefined(report, ["roundedscore", "roundedScore", "score", "similarity", "similarityScore", "matchPercentage"], null);
    if (raw === null) return null;
    const score = Number(raw);
    return Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : null;
}

// 18. OPEN A REPORT
function viewReport(report, index) {
    if (!report) { showToast("Report not found."); return; }
    sessionStorage.setItem("selectedReport", JSON.stringify(report));
    sessionStorage.setItem("selectedReportId", String(report._id ?? report.id ?? report.reportId ?? index ?? ""));
    sessionStorage.setItem("viewReport", "true");
    sessionStorage.setItem("showsthedisplayornot", "true");
    window.location.href = "../Templates/DetailedReport.html";
}

function openReport(index) {
    const numericIndex = Number(index);
    if (!Number.isInteger(numericIndex) || numericIndex < 0 || numericIndex >= analysisResults.length) {
        showToast("Report not found.");
        return;
    }
    viewReport(analysisResults[numericIndex], numericIndex);
}

// 19. DISPLAY ANALYSIS REPORTS
function renderReports(resultData) {
    const container = reportListEl || document.getElementById("reportList");
    analysisResults = getSavedReports(resultData);

    if (!container) {
        console.warn('Missing HTML element with id="reportList". Reports cannot be displayed.');
        return;
    }

    container.innerHTML = "";
    if (analysisResults.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">✓</div>
                <h3>No analyses yet</h3>
                <p>Your completed comparison reports will appear here.</p>
            </div>
        `;
        return;
    }

    analysisResults.slice().reverse().forEach((report, reverseIndex) => {
        const originalIndex = analysisResults.length - 1 - reverseIndex;
        const filenames = getReportFiles(report);
        const score = getReportScore(report);

        const item = document.createElement("article");
        item.className = "profile-report-item";

        const info = document.createElement("div");
        info.className = "report-info";

        const title = document.createElement("div");
        title.className = "report-title";
        title.textContent = filenames.join(" vs ") || "Assignment Analysis";

        const meta = document.createElement("div");
        meta.className = "report-meta";
        meta.textContent = `Similarity: ${score === null ? "Not available" : `${Math.round(score)}%`}`;
        info.append(title, meta);

        const mode = firstDefined(report, ["_displayMode", "mode", "type"], "");
        if (mode) {
            const modeEl = document.createElement("div");
            modeEl.className = "report-mode";
            modeEl.textContent = `Analysis type: ${safeText(mode)}`;
            info.appendChild(modeEl);
        }

        const details = document.createElement("details");
        details.className = "profile-report-details";
        const summary = document.createElement("summary");
        summary.textContent = "Show complete report details";
        details.appendChild(summary);

        const detailsBody = document.createElement("div");
        detailsBody.className = "report-details-body";

        const knownFields = [
            ["First file", firstDefined(report, ["filenameA", "fileA", "firstFile", "filefirst", "file1"], undefined)],
            ["Second file", firstDefined(report, ["filenameB", "fileB", "secondFile", "filesecond", "file2"], undefined)],
            ["Similarity score", score === null ? undefined : `${score}%`],
            ["Analysis type", mode],
            ["Text A", firstDefined(report, ["textA", "texta", "firstText", "originalText"], undefined)],
            ["Text B", firstDefined(report, ["textB", "textb", "secondText", "comparedText"], undefined)],
            ["First-file matches", firstDefined(report, ["filefirstmatches", "fileFirstMatches", "matchesA", "firstMatches"], undefined)],
            ["Second-file matches", firstDefined(report, ["filesecondmatches", "fileSecondMatches", "matchesB", "secondMatches"], undefined)],
            ["Created at", firstDefined(report, ["createdAt", "created_at", "date", "timestamp", "analyzedAt", "updatedAt"], undefined)]
        ];

        knownFields.forEach(([label, value]) => {
            const row = makeDetailRow(label, label === "Created at" && value ? formatDate(value) : value);
            if (row) detailsBody.appendChild(row);
        });

        const excluded = new Set([
            "_id", "__v", "id", "reportId", "filenames", "fileNames", "files", "filename", "fileName", "title",
            "filenameA", "filenameB", "fileA", "fileB", "firstFile", "secondFile", "filefirst", "filesecond", "file1", "file2",
            "roundedscore", "roundedScore", "score", "similarity", "similarityScore", "matchPercentage",
            "mode", "_displayMode", "type", "textA", "texta", "firstText", "originalText",
            "textB", "textb", "secondText", "comparedText", "filefirstmatches", "fileFirstMatches", "matchesA", "firstMatches",
            "filesecondmatches", "fileSecondMatches", "matchesB", "secondMatches", "createdAt", "created_at", "date", "timestamp", "analyzedAt", "updatedAt"
        ]);

        Object.entries(report).forEach(([key, value]) => {
            if (excluded.has(key) || value === undefined || value === null || value === "") return;
            const row = makeDetailRow(key, value);
            if (row) detailsBody.appendChild(row);
        });

        if (!detailsBody.childElementCount) {
            const empty = document.createElement("p");
            empty.textContent = "No additional details were returned for this report.";
            detailsBody.appendChild(empty);
        }

        details.appendChild(detailsBody);

        const button = document.createElement("button");
        button.type = "button";
        button.className = "view-report-btn";
        button.textContent = "Open Detailed Report →";
        button.addEventListener("click", () => viewReport(report, originalIndex));

        item.append(info, details, button);
        container.appendChild(item);
    });
}

// 20. LOAD PROFILE AND ALL BACKEND DATA
async function loadProfile() {
    if (!getToken()) { window.location.href = "../Templates/index.html"; return; }

    console.log("🔄 Loading profile data...");
    const [userResult, fileResult, analysisResult] = await Promise.allSettled([
        getUser(), getFileData(), getFileResults()
    ]);

    const errors = [];

    if (userResult.status === "fulfilled") currentUser = userResult.value;
    else {
        errors.push(`Profile: ${userResult.reason?.message || "request failed"}`);
        console.error("❌ Profile route failed:", userResult.reason);
    }

    if (fileResult.status === "fulfilled") currentFileData = fileResult.value;
    else {
        currentFileData = null;
        errors.push(`Files: ${fileResult.reason?.message || "request failed"}`);
        console.error("❌ File-data route failed:", fileResult.reason);
    }

    if (analysisResult.status === "fulfilled") currentResultData = analysisResult.value;
    else {
        currentResultData = [];
        errors.push(`Reports: ${analysisResult.reason?.message || "request failed"}`);
        console.error("❌ File-result route failed:", analysisResult.reason);
    }

    updateProfile(currentUser || {});
    profileFiles = getFilesFromFileData(currentFileData);
    
    console.log("📁 Final Processed Files:", profileFiles);
    console.log("📊 Final Processed Reports:", currentResultData);

    updateStatistics(profileFiles, currentResultData);
    renderFiles(profileFiles);
    renderReports(currentResultData);

    if (errors.length) showToast(`Some data could not load: ${errors.join("; ")}`);
    else console.log("✅ Profile page loaded successfully.");
}

// 21. REFRESH PROFILE
async function refreshProfile() {
    showToast("Refreshing profile...");
    await loadProfile();
    showToast("Profile refresh completed.");
}

// 22. LOGOUT
function setupLogout() {
    if (!logoutBtn || logoutBtn.dataset.profileBound === "true") return;
    logoutBtn.dataset.profileBound = "true";
    logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("token");
        localStorage.removeItem("loggedIn");
        ["selectedReport", "selectedReportId", "viewReport", "showsthedisplayornot", "assignCheckReport"].forEach(key => sessionStorage.removeItem(key));
        window.location.href = "../Templates/index.html";
    });
}

// 23. NEW ANALYSIS BUTTON
function setupNewAnalysis() {
    document.querySelectorAll("#newAnalysisBtn, .new-analysis-btn, [data-action='new-analysis']").forEach(button => {
        if (button.dataset.profileBound === "true") return;
        button.dataset.profileBound = "true";
        button.addEventListener("click", () => {
            ["assignCheckReport", "selectedReport", "selectedReportId", "viewReport", "showsthedisplayornot"].forEach(key => sessionStorage.removeItem(key));
            window.location.href = "../Templates/CheckAssign.html";
        });
    });
}

// 24. REFRESH BUTTON
function setupRefresh() {
    document.querySelectorAll("#refreshBtn, .refresh-btn, [data-action='refresh']").forEach(button => {
        if (button.dataset.profileBound === "true") return;
        button.dataset.profileBound = "true";
        button.addEventListener("click", refreshProfile);
    });
}

// 25. DASHBOARD NAVIGATION
function goToDashboard() { window.location.href = "../Templates/index.html"; }

// 26. DOM CHECK HELPER (NEW)
function checkDOMElements() {
    const requiredIds = ["userName", "avatar", "navAvatar", "totalFiles", "totalSize", "totalAnalyses", "lastUpload", "fileCount", "fileList", "reportList"];
    const missing = requiredIds.filter(id => !document.getElementById(id));
    if (missing.length > 0) {
        console.warn("⚠️ Missing required HTML elements with IDs:", missing);
        showToast(`Warning: Missing HTML elements: ${missing.join(", ")}`);
    }
}

// Make functions available to HTML onclick handlers.
window.openReport = openReport;
window.viewReport = viewReport;
window.refreshProfile = refreshProfile;
window.goToDashboard = goToDashboard;

// 27. INITIALIZE PROFILE PAGE
async function initializeProfile() {
    checkDOMElements(); // Verify HTML is correct first
    setupLogout();
    setupNewAnalysis();
    setupRefresh();
    await loadProfile();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeProfile);
} else {
    initializeProfile();
}