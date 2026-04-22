// ─── Word Meaning ─────────────────────────────────────
async function getWordMeaning() {
    // Use custom overlay selection first, fall back to native
    const selectedText = (typeof window.getOverlaySelectedText === "function")
        ? window.getOverlaySelectedText()
        : (window.getSelection()?.toString() || "").trim();

    if (!selectedText) {
        alert("Pehle ek word select karo!");
        return;
    }

    if (selectedText.split(" ").length > 3) {
        alert("Word Meaning ke liye sirf 1-2 words select karo!\nZyada text ke liye 'Explain This' use karo!");
        return;
    }

    const btn     = event.target;
    btn.innerText = "⏳ Finding...";
    btn.disabled  = true;

    const pageText = document.getElementById("page-text").innerText;

    const res  = await fetch("/meaning", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
            word:    selectedText,
            context: pageText.substring(0, 500)
        })
    });

    const data = await res.json();

    document.getElementById("meaning-text").innerText    = data.meaning;
    document.getElementById("meaning-box").style.display = "block";
    document.getElementById("meaning-box").scrollIntoView({ behavior: "smooth" });

    btn.innerText = "📖 Word Meaning";
    btn.disabled  = false;
}
