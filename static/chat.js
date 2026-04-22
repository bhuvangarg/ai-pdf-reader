// ─── Chat with Book ───────────────────────────────────
let chatHistory = [];

async function sendChat() {
    const input = document.getElementById("chat-input");
    const question = input.value.trim();

    if (!question) return;

    input.value = "";

    // User bubble add karo
    addBubble(question, "user");

    // Thinking bubble
    const thinkingId = addBubble("🤖 Thinking...", "thinking");

    const res = await fetch("/chat-rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            question: question,
            page: currentPage,
            history: chatHistory
        })
    });

    const data = await res.json();

    // Thinking bubble hata do
    removeBubble(thinkingId);

    // AI answer add karo
    addBubble(data.answer, "ai");

    // History update karo
    chatHistory.push({ role: "user", content: question });
    chatHistory.push({ role: "assistant", content: data.answer });

    // Last 10 messages rakho memory mein
    if (chatHistory.length > 10) {
        chatHistory = chatHistory.slice(-10);
    }
}

function addBubble(text, type) {
    const container = document.getElementById("chat-messages");
    const bubble = document.createElement("div");
    const id = "bubble-" + Date.now();

    bubble.id = id;
    bubble.className = `chat-bubble chat-${type}`;

    if (type === "thinking") {
    bubble.classList.add("chat-thinking");
}
    bubble.innerText = text;

    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;

    return id;
}

function removeBubble(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function clearChat() {
    chatHistory = [];
    document.getElementById("chat-messages").innerHTML = "";
    document.getElementById("chat-input").value = "";
}