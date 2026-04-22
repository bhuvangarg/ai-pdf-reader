// ─── Play / Pause Toggle ──────────────────────────────
let autoPlayEnabled = false;

async function togglePlayPause() {
    const btn = document.getElementById("play-pause-btn");

    if (audioPlayer && !audioPlayer.paused) {
        audioPlayer.pause();
        isAudioPaused = true;
        btn.innerText = "▶ Resume";
        return;
    }

    if (audioPlayer && audioPlayer.paused && isAudioPaused) {
        audioPlayer.play();
        isAudioPaused = false;
        btn.innerText = "⏸ Pause";
        return;
    }

    loadAndPlay(currentPage);
}

async function loadAndPlay(pageNum) {
    const btn = document.getElementById("play-pause-btn");
    stopAudio();

    btn.innerText = "⏳ Loading...";
    btn.disabled  = true;

    const voice     = document.getElementById("voice-choice").value;
    const timestamp = new Date().getTime();
    const lang      = localStorage.getItem("bookLanguage") || "English";

    const audioUrl = `/speak/${pageNum}?voice=${encodeURIComponent(voice)}&lang=${encodeURIComponent(lang)}&t=${timestamp}`;
    audioPlayer    = new Audio(audioUrl);
    isAudioPaused  = false;

    const speed  = parseFloat(document.getElementById("speed-choice").value);
    const volume = parseFloat(document.getElementById("volume-slider").value);
    audioPlayer.playbackRate = speed;
    audioPlayer.volume       = volume;

    audioPlayer.oncanplay = function () {
        btn.innerText = "⏸ Pause";
        btn.disabled  = false;
        audioPlayer.play();
        document.getElementById("page-text").classList.add("playing");
    };

    audioPlayer.onended = function () {
        btn.innerText = "▶ Play";
        isAudioPaused = false;
        audioPlayer   = null;
        document.getElementById("page-text").classList.remove("playing");
        if (autoPlayEnabled && currentPage < totalPages - 1) {
            showPage(currentPage + 1).then(function () { loadAndPlay(currentPage); });
        }
    };

    audioPlayer.onerror = function () {
        btn.innerText = "▶ Play";
        btn.disabled  = false;
        alert("Audio load nahi hua, try again!");
    };

    audioPlayer.load();
}

// ─── Volume + Speed ───────────────────────────────────
function setVolume(val) {
    if (audioPlayer) audioPlayer.volume = parseFloat(val);
}

document.getElementById("speed-choice").addEventListener("change", function () {
    if (audioPlayer) audioPlayer.playbackRate = parseFloat(this.value);
});

// ─── Auto Play Toggle ─────────────────────────────────
function toggleAutoPlay() {
    autoPlayEnabled = !autoPlayEnabled;
    const btn = document.getElementById("autoplay-btn");
    if (autoPlayEnabled) {
        btn.innerText       = "🔁 Auto: ON";
        btn.style.background = "#2ecc71";
    } else {
        btn.innerText       = "🔁 Auto: OFF";
        btn.style.background = "";
    }
}

// ─── Stop ─────────────────────────────────────────────
function stopAudio() {
    if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.src = "";
        audioPlayer     = null;
    }
    isAudioPaused = false;
    document.getElementById("page-text").classList.remove("playing");
    const btn = document.getElementById("play-pause-btn");
    if (btn) { btn.innerText = "▶ Play"; btn.disabled = false; }
}

// ─── Play From Here ───────────────────────────────────
async function playSelectedText() {
    // Use custom overlay selection — works on image-based pages
    const selectedText = (typeof window.getOverlaySelectedText === "function")
        ? window.getOverlaySelectedText()
        : (window.getSelection()?.toString() || "").trim();

    if (!selectedText) {
        alert("Pehle koi text select karo!");
        return;
    }

    const btn     = event.target;
    btn.innerText = "⏳ Loading...";
    btn.disabled  = true;

    stopAudio();

    // Build "play from here" text: selected word(s) + rest of page
    // Walk the overlay spans in DOM order (already reading-sorted) from
    // the first matching span to the end of the page.
    const spans    = document.querySelectorAll(".overlay-text");
    let textToPlay = "";

    if (spans.length > 0) {
        let startIdx = -1;
        const needle = selectedText.toLowerCase();

        for (let i = 0; i < spans.length; i++) {
            if (spans[i].textContent.toLowerCase().includes(needle) ||
                needle.includes(spans[i].textContent.toLowerCase())) {
                startIdx = i;
                break;
            }
        }

        if (startIdx !== -1) {
            for (let i = startIdx; i < spans.length; i++) {
                textToPlay += spans[i].textContent + " ";
            }
        }
    }

    // Fallback: use plain-text content if overlay spans not available
    if (!textToPlay.trim()) {
        const pageText = document.getElementById("page-text").innerText;
        const idx      = pageText.indexOf(selectedText);
        textToPlay     = idx !== -1 ? pageText.substring(idx) : selectedText;
    }

    const voice = document.getElementById("voice-choice").value;

    const res = await fetch("/speak-text", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text: textToPlay.trim(), voice: voice })
    });

    if (!res.ok) {
        alert("Audio generate nahi hua!");
        btn.innerText = "🔊 Play From Here";
        btn.disabled  = false;
        return;
    }

    const blob     = await res.blob();
    const audioUrl = URL.createObjectURL(blob);
    audioPlayer    = new Audio(audioUrl);
    isAudioPaused  = false;

    const speed  = parseFloat(document.getElementById("speed-choice").value);
    const volume = parseFloat(document.getElementById("volume-slider").value);
    audioPlayer.playbackRate = speed;
    audioPlayer.volume       = volume;

    const playBtn = document.getElementById("play-pause-btn");

    audioPlayer.oncanplay = function () {
        btn.innerText = "🔊 Play From Here";
        btn.disabled  = false;
        audioPlayer.play();
        playBtn.innerText = "⏸ Pause";
        document.getElementById("page-text").classList.add("playing");
    };

    audioPlayer.onended = function () {
        playBtn.innerText = "▶ Play";
        isAudioPaused     = false;
        audioPlayer       = null;
        document.getElementById("page-text").classList.remove("playing");
    };

    audioPlayer.onerror = function () {
        btn.innerText     = "🔊 Play From Here";
        btn.disabled      = false;
        playBtn.innerText = "▶ Play";
        alert("Audio play nahi hua!");
    };
}
