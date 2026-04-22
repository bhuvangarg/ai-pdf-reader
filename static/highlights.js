// ─── Highlight + Save ─────────────────────────────────
function saveHighlight() {
    // Use custom overlay selection (works on image pages)
    const selectedText = (typeof window.getOverlaySelectedText === "function")
        ? window.getOverlaySelectedText()
        : (window.getSelection()?.toString() || "").trim();

    if (!selectedText) {
        alert("Pehle koi text select karo page se!");
        return;
    }

    // Save to localStorage
    const bookName      = localStorage.getItem("currentBook") || "unknown";
    const allHighlights = JSON.parse(localStorage.getItem("highlights") || "{}");

    if (!allHighlights[bookName])             allHighlights[bookName] = {};
    if (!allHighlights[bookName][currentPage]) allHighlights[bookName][currentPage] = [];

    const exists = allHighlights[bookName][currentPage].some(function (h) {
        return h.text === selectedText;
    });

    if (!exists) {
        allHighlights[bookName][currentPage].push({ text: selectedText });
    }

    localStorage.setItem("highlights", JSON.stringify(allHighlights));

    // Draw the highlight box immediately on the current overlay
    if (typeof window.applyHighlightsToOverlay === "function") {
        const texts = allHighlights[bookName][currentPage].map(function (h) { return h.text; });
        window.applyHighlightsToOverlay(texts);
    }

    renderHighlightsList();
}

// ─── Apply highlights on page/overlay load ───────────
// For image pages this is handled inside reader.js doRender().
// This function still exists for plain-text fallback pages.
function applyHighlights(pageNum) {
    const bookName       = localStorage.getItem("currentBook") || "unknown";
    const allHighlights  = JSON.parse(localStorage.getItem("highlights") || "{}");
    const pageHighlights = allHighlights[bookName]?.[pageNum] || [];

    if (pageHighlights.length === 0) return;

    // Image-based page — overlay system handles it
    if (document.getElementById("text-overlay")) return;

    // Fallback: plain-text page
    const texts = pageHighlights.map(function (h) { return h.text; }).filter(Boolean);
    setTimeout(function () {
        const pageTextEl = document.getElementById("page-text");
        texts.forEach(function (text) {
            const paragraphs = pageTextEl.querySelectorAll("p");
            paragraphs.forEach(function (p) {
                if (!p.textContent.includes(text)) return;
                if (p.innerHTML.includes('class="highlight"')) return;
                p.innerHTML = p.innerHTML.replace(
                    text,
                    `<mark class="highlight">${text}</mark>`
                );
            });
        });
    }, 150);
}

// ─── Highlights List ──────────────────────────────────
function renderHighlightsList() {
    const bookName      = localStorage.getItem("currentBook") || "unknown";
    const allHighlights = JSON.parse(localStorage.getItem("highlights") || "{}");
    const bookHighlights = allHighlights[bookName] || {};

    const container = document.getElementById("highlights-list");
    container.innerHTML = "";

    let hasHighlights = false;

    Object.keys(bookHighlights).sort(function (a, b) { return a - b; }).forEach(function (pageNum) {
        bookHighlights[pageNum].forEach(function (h, idx) {
            hasHighlights = true;
            const item = document.createElement("div");
            item.className = "highlight-item";
            item.innerHTML = `
                <span class="highlight-page">Pg ${parseInt(pageNum) + 1}</span>
                <span class="highlight-text">"${h.text}"</span>
                <button onclick="showPage(${pageNum})" class="bm-go">Go</button>
                <button onclick="deleteHighlight(${pageNum}, ${idx})" class="bm-del">✕</button>
            `;
            container.appendChild(item);
        });
    });

    const noMsg = document.getElementById("no-highlights-msg");
    if (noMsg) noMsg.style.display = hasHighlights ? "none" : "block";
    document.getElementById("highlights-section").style.display = "block";
}

function deleteHighlight(pageNum, idx) {
    const bookName      = localStorage.getItem("currentBook") || "unknown";
    const allHighlights = JSON.parse(localStorage.getItem("highlights") || "{}");

    allHighlights[bookName][pageNum].splice(idx, 1);
    localStorage.setItem("highlights", JSON.stringify(allHighlights));

    // Redraw overlay highlights
    if (typeof window.applyHighlightsToOverlay === "function") {
        const remaining = (allHighlights[bookName][pageNum] || []).map(function (h) { return h.text; });
        const layer = document.getElementById("saved-highlights");
        if (layer) layer.innerHTML = "";
        if (remaining.length) window.applyHighlightsToOverlay(remaining);
    }

    renderHighlightsList();
}
