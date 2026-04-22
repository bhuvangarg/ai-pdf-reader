// ─── PDF Upload ───────────────────────────────────────
async function uploadPDF() {
    const file = document.getElementById("pdf-input").files[0];
    if (!file) {
        alert("Pehle PDF select kar!");
        return;
    }

    document.getElementById("upload-status").innerText = "Uploading...";

    const formData = new FormData();
    formData.append("pdf", file);

    const res = await fetch("/upload", {
        method: "POST",
        body: formData
    });

    const data = await res.json();
    totalPages = data.total_pages;
    currentPage = 0;

    // 🔥 SAVE STATE
    localStorage.setItem("pdfUploaded", "true");
    localStorage.setItem("currentPage", 0);
    localStorage.setItem("currentBook", file.name);

    document.getElementById("upload-status").innerText =
        `✅ ${totalPages} pages extracted!`;

    // Layout show
    document.getElementById("upload-section").style.display = "none";
    document.getElementById("intro-section").style.display = "block";
    document.getElementById("app-layout").style.display = "grid";

    showPage(0);
    detectAndApplyLanguage(); // ← language detect karo
    applyFontPreferences();
    applyFontPreferences();
    checkExistingBookmark();
}


// ─── AUTO RESTORE AFTER REFRESH 🔥 ─────────────────────
window.addEventListener("load", async function () {
    const uploaded = localStorage.getItem("pdfUploaded");

    if (uploaded === "true") {
        try {
            console.log("Restoring PDF...");

            // 🔥 Loader dikhao (optional)
            document.getElementById("upload-status").innerText = "Restoring...";

            const res = await fetch("/upload", {
                method: "POST"
            });

            const data = await res.json();
            document.getElementById("upload-status").innerText = "";

            if (data.error) {
                console.error("Restore error:", data.error);
                return;
            }

            totalPages = data.total_pages;

            // 🔥 Layout switch
            document.getElementById("upload-section").style.display = "none";
            document.getElementById("intro-section").style.display = "block";
            document.getElementById("app-layout").style.display = "grid";

            // 🔥 Restore page
            const savedPage = parseInt(localStorage.getItem("currentPage")) || 0;

            await showPage(savedPage);

            applyFontPreferences();
            checkExistingBookmark();

            console.log("Restore successful");

        } catch (err) {
            console.error("Restore failed:", err);
        }
    }
});
function resetApp() {

     if (!confirm("Are you sure you want to upload a new book?")) return;
    // 🔥 localStorage clear
    localStorage.removeItem("pdfUploaded");
    localStorage.removeItem("currentPage");

    // UI reset
    document.getElementById("upload-section").style.display = "block";
    document.getElementById("intro-section").style.display = "none";
    document.getElementById("app-layout").style.display = "none";

    // Optional: clear chat
    if (typeof clearChat === "function") clearChat();

    // Optional: clear page content
    document.getElementById("page-text").innerHTML = "";
}