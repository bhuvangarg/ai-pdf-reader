// ─── Overlay Selection State ──────────────────────────
// All other JS files call window.getOverlaySelectedText() instead of
// window.getSelection().toString() so the custom selection is always used.

let _bboxDataCache    = [];   // sorted bbox items for the current page
let _selStartIdx      = -1;   // span index where drag began
let _selEndIdx        = -1;   // span index where drag currently ends
let _isDragging       = false;
let _selectedText     = "";   // final selected text string

// _lastSelectedText holds the most recent FINALIZED selection.
// It survives the visual-clear that happens when the user clicks a button,
// and is only reset at drag-start or page-change.
let _lastSelectedText = "";

// ─── Zoom State ───────────────────────────────────────
// CSS `zoom` is applied to #page-img-container so the image and its
// absolutely-positioned overlay scale as one unit.
// getBoundingClientRect() returns physical (post-zoom) coordinates, so
// _spanIdxAtPoint() keeps working correctly at every zoom level.
let _zoomLevel = 100;   // 50 – 200, persisted in localStorage

window.getOverlaySelectedText = function () {
    // 1. Active drag just finished — _selectedText is fresh
    if (_selectedText && _selectedText.trim()) {
        return _selectedText.trim();
    }

    // 2. User clicked a button after selecting — _lastSelectedText persists
    //    because _clearSelectionHighlights() intentionally does NOT wipe it.
    if (_lastSelectedText && _lastSelectedText.trim()) {
        return _lastSelectedText.trim();
    }

    // 3. Indices still intact — compute on-the-fly
    if (_selStartIdx !== -1 && _selEndIdx !== -1 && _bboxDataCache.length) {
        const lo = Math.min(_selStartIdx, _selEndIdx);
        const hi = Math.max(_selStartIdx, _selEndIdx);
        const text = _bboxDataCache
            .slice(lo, hi + 1)
            .map(it => it.text)
            .join(" ")
            .trim();
        if (text) return text;
    }

    // 4. Plain-text page fallback (native selection)
    return (window.getSelection()?.toString() || "").trim();
};

// Called by highlights.js after overlay is ready to draw saved highlight boxes
window.applyHighlightsToOverlay = function (savedTexts) {
    const container = document.getElementById("page-img-container");
    if (!container || !_bboxDataCache.length) return;

    let layer = document.getElementById("saved-highlights");
    if (!layer) {
        layer = document.createElement("div");
        layer.id = "saved-highlights";
        container.appendChild(layer);
    }
    layer.innerHTML = "";

    savedTexts.forEach(function (text) {
        if (!text) return;
        const needle = text.toLowerCase().trim();

        for (let i = 0; i < _bboxDataCache.length; i++) {
            let accumulated = "";
            let endIdx = -1;

            for (let j = i; j < Math.min(_bboxDataCache.length, i + 30); j++) {
                accumulated = (accumulated + " " + _bboxDataCache[j].text).trim();
                if (accumulated.toLowerCase().includes(needle)) {
                    endIdx = j;
                    break;
                }
            }

            if (endIdx !== -1) {
                for (let k = i; k <= endIdx; k++) {
                    const item = _bboxDataCache[k];
                    const box  = document.createElement("div");
                    box.className      = "saved-highlight-box";
                    box.style.left     = item.left   + "%";
                    box.style.top      = item.top    + "%";
                    box.style.width    = item.width  + "%";
                    box.style.height   = item.height + "%";
                    layer.appendChild(box);
                }
                break;
            }
        }
    });
};

// ─── Reset on every new page ──────────────────────────
function _resetOverlayState() {
    _bboxDataCache    = [];
    _selStartIdx      = -1;
    _selEndIdx        = -1;
    _isDragging       = false;
    _selectedText     = "";
    _lastSelectedText = "";
    // _zoomLevel is intentionally NOT reset — zoom persists across pages
    document.removeEventListener("mousemove", _onDocMousemove);
    document.removeEventListener("mouseup",   _onDocMouseup );
}

// ─── Zoom Controls ────────────────────────────────────
function applyZoom(val) {
    _zoomLevel = parseInt(val, 10);

    // Apply to container — overlay is a child so it zooms with it
    const container = document.getElementById("page-img-container");
    if (container) {
        container.style.zoom = _zoomLevel / 100;
    }

    // Sync UI
    const label = document.getElementById("zoom-label");
    if (label) label.innerText = _zoomLevel + "%";

    const slider = document.getElementById("zoom-slider");
    if (slider && slider.value !== String(_zoomLevel)) {
        slider.value = _zoomLevel;
    }

    localStorage.setItem("zoomLevel", _zoomLevel);
}

function resetZoom() {
    applyZoom(100);
}

function initZoom() {
    const saved = parseInt(localStorage.getItem("zoomLevel") || "100", 10);
    _zoomLevel = saved;
    const slider = document.getElementById("zoom-slider");
    if (slider) slider.value = saved;
    const label = document.getElementById("zoom-label");
    if (label) label.innerText = saved + "%";
}

// ─── Page Display ─────────────────────────────────────
async function showPage(num) {
    stopAudio();
    currentPage = num;
    savePageState(num);
    _resetOverlayState();

    const pageTextEl = document.getElementById("page-text");
    pageTextEl.innerHTML = `
        <div id="page-loading" style="text-align:center;padding:80px 40px;color:#7a8099;font-size:15px;">
            ⏳ Loading page...
        </div>`;

    try {
        const imgRes  = await fetch(`/page-image/${num}`);
        const imgData = await imgRes.json();

        if (imgData.image) {
            pageTextEl.innerHTML = `
                <div id="page-img-container">
                    <img src="data:image/png;base64,${imgData.image}"
                         id="page-img"
                         alt="Page ${num + 1}">
                    <div id="text-overlay"></div>
                    <div id="ocr-badge" class="ocr-badge ${imgData.ocr_status}">
                        ${getOcrBadgeText(imgData.ocr_status)}
                    </div>
                </div>`;

            if (imgData.bbox_data && imgData.bbox_data.length > 0) {
                renderTextOverlay(imgData.bbox_data, num);
            } else {
                // No bbox yet — still apply saved zoom to the container
                const c = document.getElementById("page-img-container");
                if (c) c.style.zoom = _zoomLevel / 100;
            }

            if (imgData.ocr_status !== "done" && imgData.ocr_status !== "error") {
                pollOcrStatus(num);
            }
        } else {
            await showPageAsText(num, pageTextEl);
        }

    } catch (e) {
        await showPageAsText(num, pageTextEl);
    }

    document.getElementById("page-info").innerText = `Page ${num + 1}`;
    pagesRead.add(num);
    updateProgress();

    pageTextEl.classList.remove("page-turning");
    void pageTextEl.offsetWidth;
    pageTextEl.classList.add("page-turning");

    const fraction   = document.getElementById("page-fraction");
    const headerInfo = document.getElementById("header-page-info");
    if (fraction)   fraction.innerText   = `${num + 1} / ${totalPages}`;
    if (headerInfo) headerInfo.innerText = `Page ${num + 1} of ${totalPages}`;

    applyModeToUI();
}

// ─── Text Overlay Renderer ────────────────────────────
function renderTextOverlay(bboxData, pageNum) {
    const img     = document.getElementById("page-img");
    const overlay = document.getElementById("text-overlay");
    if (!img || !overlay) return;

    function doRender() {
        // Apply zoom to container first.
        // CSS `zoom` scales the container and all its children as a unit.
        // Both img and overlay get the same zoom, keeping them perfectly aligned.
        // getBoundingClientRect() returns physical coords post-zoom, so the
        // hit-test in _spanIdxAtPoint uses the correct physical boundaries.
        const container = document.getElementById("page-img-container");
        if (container) {
            container.style.zoom = _zoomLevel / 100;
        }

        const iw = img.offsetWidth;
        const ih = img.offsetHeight;
        if (!iw || !ih) return;

        // ── Sort into natural reading order ──────────
        // Group into rows using a 1.2% vertical tolerance, then sort left→right
        const sorted = bboxData
            .map(function (item, i) { return Object.assign({}, item, { _oi: i }); })
            .sort(function (a, b) {
                const dy = a.top - b.top;
                if (Math.abs(dy) > 1.2) return dy;
                return a.left - b.left;
            });

        _bboxDataCache = sorted;

        // ── Build overlay div ─────────────────────────
        overlay.innerHTML      = "";
        overlay.style.position = "absolute";
        overlay.style.top      = "0";
        overlay.style.left     = "0";
        overlay.style.width    = iw + "px";
        overlay.style.height   = ih + "px";
        // pointer-events: all so the overlay catches clicks in gaps between words
        overlay.style.pointerEvents    = "all";
        overlay.style.cursor           = "text";
        overlay.style.userSelect       = "none";
        overlay.style.webkitUserSelect = "none";

        sorted.forEach(function (item, idx) {
            const span       = document.createElement("span");
            span.className   = "overlay-text";
            span.textContent = item.text;
            span.dataset.idx = String(idx);

            span.style.left     = item.left   + "%";
            span.style.top      = item.top    + "%";
            span.style.width    = item.width  + "%";
            span.style.height   = item.height + "%";

            // Font-size proportional to bbox height so the browser draws the
            // text cursor at the correct vertical position inside the box.
            const heightPx        = (item.height / 100) * ih;
            span.style.fontSize   = Math.max(6, heightPx * 0.88) + "px";
            span.style.lineHeight = "1";

            overlay.appendChild(span);
        });

        // ── Attach custom selection events ───────────
        overlay.removeEventListener("mousedown", _onOverlayMousedown);
        overlay.addEventListener("mousedown", _onOverlayMousedown);

        // ── Restore saved highlights for this page ───
        const bookName       = localStorage.getItem("currentBook") || "unknown";
        const allHighlights  = JSON.parse(localStorage.getItem("highlights") || "{}");
        const pageHighlights = allHighlights[bookName]?.[pageNum] || [];
        const texts          = pageHighlights.map(function (h) { return h.text; }).filter(Boolean);
        if (texts.length) {
            window.applyHighlightsToOverlay(texts);
        }
    }

    if (img.complete && img.naturalWidth > 0) {
        doRender();
    } else {
        img.addEventListener("load", doRender, { once: true });
    }
}

// ─── Hit Testing ─────────────────────────────────────
// Returns the sorted-array index of the span under (clientX, clientY),
// or the nearest span within a reasonable proximity threshold.
// Uses getBoundingClientRect() which accounts for CSS zoom/transform,
// so this works correctly at every zoom level.
function _spanIdxAtPoint(clientX, clientY) {
    const overlay = document.getElementById("text-overlay");
    if (!overlay || !_bboxDataCache.length) return -1;

    const rect = overlay.getBoundingClientRect();
    const px   = ((clientX - rect.left) / rect.width)  * 100;
    const py   = ((clientY - rect.top)  / rect.height) * 100;

    // Exact hit
    for (let i = 0; i < _bboxDataCache.length; i++) {
        const it = _bboxDataCache[i];
        if (px >= it.left && px <= it.left + it.width &&
            py >= it.top  && py <= it.top  + it.height) {
            return i;
        }
    }

    // Nearest span (snap gap clicks to closest word)
    let best = -1, bestDist = Infinity;
    for (let i = 0; i < _bboxDataCache.length; i++) {
        const it   = _bboxDataCache[i];
        const cx   = it.left + it.width  / 2;
        const cy   = it.top  + it.height / 2;
        const dist = Math.hypot(px - cx, py - cy);
        if (dist < bestDist && dist < 10) { bestDist = dist; best = i; }
    }
    return best;
}

// ─── Custom Selection Events ──────────────────────────
function _onOverlayMousedown(e) {
    if (e.button !== 0) return;
    e.preventDefault();    // suppress native browser selection entirely

    _isDragging       = true;
    _selectedText     = "";    // reset only when a fresh drag begins
    _lastSelectedText = "";
    _clearSelectionHighlights();

    const idx    = _spanIdxAtPoint(e.clientX, e.clientY);
    _selStartIdx = idx;
    _selEndIdx   = idx;

    if (idx !== -1) _renderSelectionHighlights(_selStartIdx, _selEndIdx);

    document.removeEventListener("mousemove", _onDocMousemove);
    document.removeEventListener("mouseup",   _onDocMouseup);
    document.addEventListener("mousemove", _onDocMousemove);
    document.addEventListener("mouseup",   _onDocMouseup, { once: true });
}

function _onDocMousemove(e) {
    if (!_isDragging || _selStartIdx === -1) return;
    const idx = _spanIdxAtPoint(e.clientX, e.clientY);
    if (idx !== -1 && idx !== _selEndIdx) {
        _selEndIdx = idx;
        _renderSelectionHighlights(_selStartIdx, _selEndIdx);
    }
}

function _onDocMouseup(e) {
    if (!_isDragging) return;
    _isDragging = false;
    document.removeEventListener("mousemove", _onDocMousemove);

    // Finalize text
    if (_selStartIdx !== -1 && _selEndIdx !== -1) {
        const lo = Math.min(_selStartIdx, _selEndIdx);
        const hi = Math.max(_selStartIdx, _selEndIdx);
        _selectedText = _bboxDataCache
            .slice(lo, hi + 1)
            .map(function (it) { return it.text; })
            .join(" ")
            .trim();
        // Persist across the button mousedown → click timing gap
        _lastSelectedText = _selectedText;
    }
    _renderSelectionHighlights(_selStartIdx, _selEndIdx);
}

// ─── Highlight Box Rendering ──────────────────────────
function _renderSelectionHighlights(startIdx, endIdx) {
    const container = document.getElementById("page-img-container");
    if (!container) return;

    let layer = document.getElementById("selection-highlights");
    if (!layer) {
        layer = document.createElement("div");
        layer.id = "selection-highlights";
        container.appendChild(layer);
    }
    layer.innerHTML = "";

    if (startIdx === -1 || endIdx === -1) return;

    const lo = Math.min(startIdx, endIdx);
    const hi = Math.max(startIdx, endIdx);

    for (let i = lo; i <= hi; i++) {
        const item = _bboxDataCache[i];
        if (!item) continue;
        const box        = document.createElement("div");
        box.className    = "selection-highlight-box";
        box.style.left   = item.left   + "%";
        box.style.top    = item.top    + "%";
        box.style.width  = item.width  + "%";
        box.style.height = item.height + "%";
        layer.appendChild(box);
    }
}

// Clears only the VISUAL selection boxes + indices.
// _selectedText is intentionally preserved so that button click handlers
// (which fire AFTER a mousedown-outside clears visuals) can still read
// the last selection via window.getOverlaySelectedText().
// _selectedText resets only when a new drag begins or the page changes.
function _clearSelectionHighlights() {
    const layer = document.getElementById("selection-highlights");
    if (layer) layer.innerHTML = "";
    _selStartIdx = -1;
    _selEndIdx   = -1;
    // ← _selectedText intentionally NOT cleared here
}

// Clear visual selection when clicking outside the overlay
document.addEventListener("mousedown", function (e) {
    const overlay = document.getElementById("text-overlay");
    if (overlay && !overlay.contains(e.target) && e.button === 0) {
        _clearSelectionHighlights();
    }
});

// Ctrl+C copies overlay selection (native browser selection is disabled)
document.addEventListener("keydown", function (e) {
    if (e.ctrlKey && e.key === "c") {
        const text = window.getOverlaySelectedText();
        if (text) {
            navigator.clipboard.writeText(text);
            e.preventDefault();
        }
    }
});

// ─── Poll OCR — refresh overlay when done ────────────
function pollOcrStatus(pageNum) {
    const interval = setInterval(async function () {
        try {
            const res  = await fetch(`/ocr-status/${pageNum}`);
            const data = await res.json();

            if (currentPage === pageNum) {
                const badge = document.getElementById("ocr-badge");
                if (badge) {
                    badge.className = `ocr-badge ${data.status}`;
                    badge.innerText = getOcrBadgeText(data.status);
                }
                if (data.status === "done" && data.bbox_data && data.bbox_data.length > 0) {
                    renderTextOverlay(data.bbox_data, pageNum);
                }
            }

            if (data.status === "done" || data.status === "error") {
                clearInterval(interval);
            }
        } catch (e) {
            clearInterval(interval);
        }
    }, 2000);
}

// ─── Fallback: Plain text display ────────────────────
async function showPageAsText(num, pageTextEl) {
    try {
        const res        = await fetch(`/page/${num}`);
        const data       = await res.json();
        const paragraphs = (data.text || "").split("\n\n");
        pageTextEl.innerHTML = paragraphs
            .map(function (p) { return p.trim(); })
            .filter(function (p) { return p.length > 0; })
            .map(function (p) { return `<p>${escapeHtml(p)}</p>`; })
            .join("");
    } catch (e) {
        pageTextEl.innerHTML = `<p style="color:#e8445a;">Page load failed. Try again.</p>`;
    }
}

// ─── OCR Badge ────────────────────────────────────────
function getOcrBadgeText(status) {
    if (status === "done")       return "✅ OCR Ready";
    if (status === "processing") return "🔄 OCR Processing...";
    if (status === "error")      return "⚠️ OCR Failed";
    return "⏳ OCR Pending";
}

// ─── Progress ─────────────────────────────────────────
function updateProgress() {
    const percent = Math.round((pagesRead.size / totalPages) * 100);
    document.getElementById("progress-bar").style.setProperty("--progress", `${percent}%`);
    document.getElementById("progress-text").innerText = `${percent}%`;
}

function nextPage() { if (currentPage < totalPages - 1) showPage(currentPage + 1); }
function prevPage() { if (currentPage > 0) showPage(currentPage - 1); }

function escapeHtml(text) {
    return text
        .replace(/&/g,  "&amp;")
        .replace(/</g,  "&lt;")
        .replace(/>/g,  "&gt;")
        .replace(/"/g,  "&quot;");
}

// ─── Tab Switching ────────────────────────────────────
function switchAiTab(tabName, btn) {
    document.querySelectorAll(".ai-tab-content").forEach(function (t) { t.classList.remove("active"); });
    document.querySelectorAll(".ai-tab").forEach(function (b) { b.classList.remove("active"); });
    document.getElementById(`ai-tab-${tabName}`).classList.add("active");
    btn.classList.add("active");
}

// ─── Reading Mode UI ──────────────────────────────────
function applyModeToUI() {
    const aiPanel  = document.getElementById("ai-panel");
    const pageText = document.getElementById("page-text");
    const topBar   = document.getElementById("top-bar");
    const controls = document.getElementById("audio-controls");

    if (aiPanel)  { aiPanel.style.opacity = "1"; aiPanel.style.pointerEvents = "auto"; }
    if (pageText) { pageText.style.maxWidth = "800px"; pageText.style.margin = "0"; }
    if (topBar)   topBar.style.opacity   = "1";
    if (controls) controls.style.opacity = "1";

    if (state.readingMode === "listen") {
        if (aiPanel)  { aiPanel.style.opacity = "0"; aiPanel.style.pointerEvents = "none"; }
        if (pageText) pageText.style.maxWidth = "700px";
    }

    if (state.readingMode === "focus") {
        if (aiPanel)  { aiPanel.style.opacity = "0"; aiPanel.style.pointerEvents = "none"; }
        if (pageText) { pageText.style.maxWidth = "700px"; pageText.style.margin = "0 auto"; }
        if (topBar)   topBar.style.opacity   = "0.2";
        if (controls) controls.style.opacity = "0.2";
    }
}

// ─── State Persistence ────────────────────────────────
async function savePageState(pageNum) {
    try {
        await fetch("/state/save", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ page: pageNum })
        });
        localStorage.setItem("currentPage", pageNum);
    } catch (e) { /* non-fatal */ }
}

// ─── Initialise zoom from localStorage on script load ─
initZoom();
