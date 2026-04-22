// ─── Smart Notes Generator ────────────────────────────
async function generateNotes(mode) {
    const btns = document.querySelectorAll("#notes-buttons button");
    btns.forEach(b => b.disabled = true);

    const modeLabels = {
        "summary": "📝 Summary",
        "bullets": "• Bullet Points",
        "revision": "🎯 Revision Notes"
    };

    // Active button loading state
    const activeBtn = event.target;
    const originalText = activeBtn.innerText;
    activeBtn.innerText = "⏳ Generating...";

    const res = await fetch("/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            page: currentPage,
            mode: mode
        })
    });

    const data = await res.json();

    document.getElementById("notes-mode-label").innerText =
        `${modeLabels[mode]} — Page ${currentPage + 1}`;
    document.getElementById("notes-text").innerText = data.notes;
    document.getElementById("notes-box").style.display = "block";
    document.getElementById("notes-box").scrollIntoView({ behavior: "smooth" });

    // Buttons reset
    btns.forEach(b => b.disabled = false);
    activeBtn.innerText = originalText;
}

// ─── Copy Notes ───────────────────────────────────────
function copyNotes() {
    const text = document.getElementById("notes-text").innerText;
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById("notes-copy-btn");
        btn.innerText = "✅ Copied!";
        setTimeout(() => btn.innerText = "📋 Copy", 2000);
    });
}