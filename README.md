# AI Interactive PDF Reader
An AI-powered interactive PDF reader that transforms documents into intelligent learning tools using OCR, text-to-speech, and RAG-based question answering.

---

## 🚀 Project Overview

This project converts static PDFs into an interactive experience where users can listen, select, and understand content using AI.  
It combines OCR, audio generation, and intelligent querying to enhance document readability and learning.

---

## Features

- Upload and view PDF files  
- OCR-based text extraction (supports scanned PDFs)  
- Select text and get:
  - Explanation  
  - Meaning  
  - Notes  
- Chat with document (RAG-based Q&A)  
- Convert text to speech (audiobook mode)  
- Background processing for smooth UI  
- Caching (OCR + audio) for performance

---

## 🛠️ Tech Stack

**Backend**
- Python (Flask)
- EasyOCR
- PyMuPDF (fitz)
- FAISS (Vector Search)
- Sentence Transformers
- Groq API (LLM)

**Frontend**
- HTML
- CSS
- JavaScript (Vanilla JS)

**Other**
- SQLite (Caching)
- Edge-TTS (Text-to-Speech)

---
## 📸 Screenshots

<img width="743" height="640" alt="Screenshot 2026-04-11 213816" src="https://github.com/user-attachments/assets/a2f50093-1a28-43dc-b145-661bbbfc8692" />
<img width="734" height="683" alt="Screenshot 2026-04-11 213752" src="https://github.com/user-attachments/assets/4c28c183-6a06-4b07-ae82-37228bf5924d" />
<img width="1850" height="985" alt="Screenshot 2026-04-11 213343" src="https://github.com/user-attachments/assets/0535b3fd-8cc0-478b-99de-c9eba8db1a90" />
<img width="1861" height="981" alt="Screenshot 2026-04-11 211707" src="https://github.com/user-attachments/assets/3583d373-2ade-42fb-929e-085ca07f37e4" />
<img width="1863" height="969" alt="Screenshot 2026-04-11 211521" src="https://github.com/user-attachments/assets/a981f556-46f1-4cde-ba7e-ad1e86bb44db" />

## How to Run

### 1. Clone the repository
git clone https://github.com/bhuvangarg/ai-pdf-reader.git
cd ai-pdf-reader

### 2. Install dependencies
pip install -r requirements.txt

### 3. Run the backend
python app.py

### 4. Open in browser
http://127.0.0.1:5000

## Notes

- OCR is resource-intensive; performance may vary on low-end systems
- Initial processing may take time but results are cached

## Future Improvements 
- Multi-user support 
- Better UI/UX polish
- Faster OCR pipeline Cloud deployment  
- Contribution 
- Feel free to fork and improve the project.

## Contact
Bhuvan Garg GitHub: https://github.com/bhuvangarg
