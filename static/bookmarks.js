// ─── Bookmark System ─────────────────────────────────────────

// 🔖 Save bookmark
function bookmarkPage() {
    const bookName = localStorage.getItem("currentBook") || "unknown";
    const bookmarks = JSON.parse(localStorage.getItem("bookmarks") || "{}");

    if (!bookmarks[bookName]) bookmarks[bookName] = [];

    if (!bookmarks[bookName].includes(currentPage)) {
        bookmarks[bookName].push(currentPage);
    }

    localStorage.setItem("bookmarks", JSON.stringify(bookmarks));

    document.getElementById("bookmark-status").innerText =
        `🔖 Page ${currentPage + 1} bookmarked!`;

    updateBookmarkUI();
}




// 🔄 Check existing bookmarks (on load)
function checkExistingBookmark() {
    const bookName = localStorage.getItem("currentBook") || "unknown";
    const bookmarks = JSON.parse(localStorage.getItem("bookmarks") || "{}");
    const pages = bookmarks[bookName] || [];

    if (pages.length > 0) {
        document.getElementById("bookmark-status").innerText =
            `🔖 ${pages.length} bookmark(s) saved`;
    } else {
        document.getElementById("bookmark-status").innerText = "";
    }

    renderBookmarkList();
    renderHighlightsList();
}


// 🔥 Toggle bookmark panel
function toggleBookmarks() {
    const dropdown = document.getElementById("bookmark-dropdown");

    if (!dropdown) return;

    dropdown.classList.toggle("hidden");

    renderBookmarkList();
}

// 📌 Render bookmark list
function renderBookmarkList() {
    const list = document.getElementById("bookmark-list");
    if (!list) return;

    list.innerHTML = "";

    const bookName = localStorage.getItem("currentBook") || "unknown";
    const bookmarks = JSON.parse(localStorage.getItem("bookmarks") || "{}");
    const pages = bookmarks[bookName] || [];

    if (pages.length === 0) {
        list.innerHTML = "<li>No bookmarks</li>";
        return;
    }

    pages.sort((a, b) => a - b);

    pages.forEach((page) => {
        const li = document.createElement("li");

        li.innerHTML = `
            <span>Page ${page + 1}</span>
            <button onclick="goToBookmark(${page})">Go</button>
        `;

        list.appendChild(li);
    });
}

// 👉 Jump to bookmark
function goToBookmark(page) {
    showPage(page);

    document.getElementById("bookmark-status").innerText =
        `📖 Jumped to page ${page + 1}`;

    // close panel after click
    const panel = document.getElementById("bookmark-panel");
    if (panel) panel.style.display = "none";
}


// ❌ Delete bookmark
function deleteBookmark(page) {
    const bookName = localStorage.getItem("currentBook") || "unknown";
    const bookmarks = JSON.parse(localStorage.getItem("bookmarks") || "{}");

    bookmarks[bookName] = bookmarks[bookName].filter(p => p !== page);

    localStorage.setItem("bookmarks", JSON.stringify(bookmarks));

    document.getElementById("bookmark-status").innerText =
        `🗑️ Page ${page + 1} removed`;

    updateBookmarkUI();
}


// 🔄 Update UI after changes
function updateBookmarkUI() {
    const bookName = localStorage.getItem("currentBook") || "unknown";
    const bookmarks = JSON.parse(localStorage.getItem("bookmarks") || "{}");
    const pages = bookmarks[bookName] || [];

    if (pages.length > 0) {
        document.getElementById("bookmark-status").innerText =
            `🔖 ${pages.length} bookmark(s) saved`;
    } else {
        document.getElementById("bookmark-status").innerText = "";
    }

    renderBookmarkList();
}
document.addEventListener("click", function (e) {
    const dropdown = document.getElementById("bookmark-dropdown");
    const button = e.target.closest(".btn-icon");

    if (!dropdown) return;

    if (!dropdown.contains(e.target) && !button) {
        dropdown.classList.add("hidden");
    }
});