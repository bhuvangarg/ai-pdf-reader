const state = {
    currentPage: 0,
    totalPages: 0,

    audio: {
        player: null,
        isPaused: false,
        speed: 1.0
    },

    readingMode: "study",

    pagesRead: new Set()
};

// ===== TEMP COMPATIBILITY (IMPORTANT) =====

// old variables (so app doesn't break)
let currentPage = state.currentPage;
let totalPages = state.totalPages;
let audioPlayer = state.audio.player;
let isAudioPaused = state.audio.isPaused;
let pagesRead = state.pagesRead;

// ===== MODE SYSTEM =====

function setReadingMode(mode) {
    state.readingMode = mode;

    document.body.classList.remove("study-mode", "listen-mode", "focus-mode");
    document.body.classList.add(`${mode}-mode`);

    // ✅ Active button highlight
    document.querySelectorAll("#reading-modes button").forEach(btn => {
        btn.classList.remove("active-mode");
    });

    const activeBtn = document.querySelector(`#reading-modes button[onclick="setReadingMode('${mode}')"]`);
    if (activeBtn) activeBtn.classList.add("active-mode");

    if (mode === "listen") {
    // auto start audio
    setTimeout(() => {
        if (typeof togglePlayPause === "function") {
            togglePlayPause();
        }
    }, 300);
}

    applyReadingMode();
    applyModeToUI();
}
function applyReadingMode() {
    if (state.readingMode === "study") {
        state.audio.speed = 0.9;
    }

    if (state.readingMode === "listen") {
        state.audio.speed = 1.1;
    }

    if (state.readingMode === "focus") {
        state.audio.speed = 1.0;
    }
}