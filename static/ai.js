// ─── AI Introduction ──────────────────────────────────
async function getIntroduction() {
    const btn = event.target;
    btn.innerText = "⏳ Generating...";
    btn.disabled  = true;

    const res  = await fetch("/introduction", { method: "POST" });
    const data = await res.json();

    document.getElementById("intro-text").innerText     = data.introduction;
    document.getElementById("intro-box").style.display  = "block";

    btn.innerText = "🔄 Regenerate";
    btn.disabled  = false;
}

// ─── Explain This ─────────────────────────────────────
async function explainSelected() {
    // Use custom overlay selection first, fall back to native
    const selectedText = (typeof window.getOverlaySelectedText === "function")
        ? window.getOverlaySelectedText()
        : (window.getSelection()?.toString() || "").trim();

    if (!selectedText) {
        alert("Pehle koi text select karo page se! (Mouse se drag karo)");
        return;
    }

    const btn = event.target;
    btn.innerText = "⏳ Explaining...";
    btn.disabled  = true;

    const res  = await fetch("/explain", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text: selectedText })
    });

    const data = await res.json();

    document.getElementById("explain-text").innerText    = data.explanation;
    document.getElementById("explain-box").style.display = "block";
    document.getElementById("explain-box").scrollIntoView({ behavior: "smooth" });

    btn.innerText = "✨ Explain This";
    btn.disabled  = false;
}

// ─── Play Explanation Audio ────────────────────────────
async function playExplanationAudio() {
    const explanationText = document.getElementById("explain-text").innerText;
    if (!explanationText) return;

    const btn    = document.getElementById("explain-audio-btn");
    btn.innerText = "⏳ Loading...";
    btn.disabled  = true;

    const voice = document.getElementById("voice-choice").value;

    const res = await fetch("/explain-voice", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text: explanationText, voice: voice })
    });

    if (!res.ok) {
        alert("Audio generate nahi hua!");
        btn.innerText = "🔊 Listen to Explanation";
        btn.disabled  = false;
        return;
    }

    const blob     = await res.blob();
    const audioUrl = URL.createObjectURL(blob);
    const audio    = new Audio(audioUrl);

    audio.oncanplay = function () {
        btn.innerText = "🔊 Listen to Explanation";
        btn.disabled  = false;
        audio.play();
    };
    audio.onerror = function () {
        btn.innerText = "🔊 Listen to Explanation";
        btn.disabled  = false;
        alert("Audio play nahi hua!");
    };
}
