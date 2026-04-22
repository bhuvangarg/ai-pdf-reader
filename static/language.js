// ─── Language Config ──────────────────────────────────
const LANGUAGE_CONFIG = {
    "Hindi": {
        ttsVoice: "hi-IN-SwaraNeural",
        ttsVoiceMale: "hi-IN-MadhurNeural",
        flag: "🇮🇳",
        label: "Hindi",
        rtl: false
    },
    "English": {
        ttsVoice: "en-US-JennyNeural",
        ttsVoiceMale: "en-US-GuyNeural",
        flag: "🇺🇸",
        label: "English",
        rtl: false
    },
    "French": {
        ttsVoice: "fr-FR-DeniseNeural",
        ttsVoiceMale: "fr-FR-HenriNeural",
        flag: "🇫🇷",
        label: "French",
        rtl: false
    },
    "Spanish": {
        ttsVoice: "es-ES-ElviraNeural",
        ttsVoiceMale: "es-ES-AlvaroNeural",
        flag: "🇪🇸",
        label: "Spanish",
        rtl: false
    },
    "German": {
        ttsVoice: "de-DE-KatjaNeural",
        ttsVoiceMale: "de-DE-ConradNeural",
        flag: "🇩🇪",
        label: "German",
        rtl: false
    },
    "Urdu": {
        ttsVoice: "ur-PK-UzmaNeural",
        ttsVoiceMale: "ur-PK-AsadNeural",
        flag: "🇵🇰",
        label: "Urdu",
        rtl: true
    },
    "Bengali": {
        ttsVoice: "bn-IN-TanishaaNeural",
        ttsVoiceMale: "bn-IN-BashkarNeural",
        flag: "🇧🇩",
        label: "Bengali",
        rtl: false
    },
    "Tamil": {
        ttsVoice: "ta-IN-PallaviNeural",
        ttsVoiceMale: "ta-IN-ValluvarNeural",
        flag: "🇮🇳",
        label: "Tamil",
        rtl: false
    }
};

// ─── Detect + Apply Language ──────────────────────────
async function detectAndApplyLanguage() {
    const statusEl = document.getElementById("lang-status");
    if (statusEl) statusEl.innerText = "🔍 Detecting language...";

    try {
        const res = await fetch("/detect-language", { method: "POST" });
        const data = await res.json();
        const detected = data.language;

        // Save karo
        localStorage.setItem("bookLanguage", detected);

        // Config find karo
        const config = LANGUAGE_CONFIG[detected] || LANGUAGE_CONFIG["English"];

        // TTS voice update karo
        applyLanguageVoice(config);

        // UI update karo
        if (statusEl) {
            statusEl.innerText = `${config.flag} ${config.label} detected`;
        }

        // RTL support
        const pageText = document.getElementById("page-text");
        if (pageText) {
            pageText.style.direction = config.rtl ? "rtl" : "ltr";
            pageText.style.textAlign = config.rtl ? "right" : "left";
        }

        console.log(`Language detected: ${detected}`);
        return detected;

    } catch(e) {
        console.log("Language detection error:", e);
        if (statusEl) statusEl.innerText = "🌐 English (default)";
        return "English";
    }
}

function applyLanguageVoice(config) {
    const voiceSelect = document.getElementById("voice-choice");
    if (!voiceSelect) return;

    // Current selection check karo
    const currentVal = voiceSelect.value;

    // Agar English voice selected hai toh auto switch karo
    if (currentVal.startsWith("en-") || currentVal.startsWith("hi-")) {
        // Female voice set karo by default
        const optionExists = Array.from(voiceSelect.options)
            .some(o => o.value === config.ttsVoice);

        if (!optionExists) {
            // Naya option add karo
            const opt = document.createElement("option");
            opt.value = config.ttsVoice;
            opt.text = `${config.flag} ${config.label} (Female)`;
            voiceSelect.appendChild(opt);

            const optM = document.createElement("option");
            optM.value = config.ttsVoiceMale;
            optM.text = `${config.flag} ${config.label} (Male)`;
            voiceSelect.appendChild(optM);
        }

        voiceSelect.value = config.ttsVoice;
    }
}

// ─── Get current language config ─────────────────────
function getCurrentLanguage() {
    const lang = localStorage.getItem("bookLanguage") || "English";
    return LANGUAGE_CONFIG[lang] || LANGUAGE_CONFIG["English"];
}