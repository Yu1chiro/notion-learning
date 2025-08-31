const express = require('express');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// GEMINI API KEY - Ganti dengan API key Anda
const GEMINI_API_KEY = 'AIzaSyBJZXqryclnE-tlp0bmlbNTAkjxoDbiUzg';

// In-memory storage untuk notes (dalam production gunakan database)
let notesStorage = {};

// Route untuk halaman utama
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route untuk halaman create note
app.get('/create-note', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'create-note.html'));
});

// Route untuk halaman quiz
app.get('/quiz', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'quiz.html'));
});

// API untuk menyimpan note
app.post('/api/notes', (req, res) => {
    try {
        const { date, youtubeLink, title, description, vocabulary } = req.body;
        
        if (!date || !title) {
            return res.status(400).json({ error: 'Date dan title harus diisi' });
        }

        const noteId = Date.now().toString();
        const note = {
            id: noteId,
            date,
            youtubeLink: youtubeLink || '',
            title,
            description: description || '',
            vocabulary: vocabulary || [],
            createdAt: new Date().toISOString()
        };

        notesStorage[date] = note;
        
        res.json({ success: true, note });
    } catch (error) {
        res.status(500).json({ error: 'Gagal menyimpan note' });
    }
});

// API untuk mendapatkan note berdasarkan tanggal
app.get('/api/notes/:date', (req, res) => {
    try {
        const { date } = req.params;
        const note = notesStorage[date];
        
        if (!note) {
            return res.status(404).json({ error: 'Note tidak ditemukan' });
        }
        
        res.json(note);
    } catch (error) {
        res.status(500).json({ error: 'Gagal mengambil note' });
    }
});

// API untuk mendapatkan semua notes
app.get('/api/notes', (req, res) => {
    try {
        res.json(notesStorage);
    } catch (error) {
        res.status(500).json({ error: 'Gagal mengambil notes' });
    }
});

// API untuk update note
app.put('/api/notes/:date', (req, res) => {
    try {
        const { date } = req.params;
        const { youtubeLink, title, description, vocabulary } = req.body;
        
        if (!notesStorage[date]) {
            return res.status(404).json({ error: 'Note tidak ditemukan' });
        }

        notesStorage[date] = {
            ...notesStorage[date],
            youtubeLink: youtubeLink || '',
            title,
            description: description || '',
            vocabulary: vocabulary || [],
            updatedAt: new Date().toISOString()
        };
        
        res.json({ success: true, note: notesStorage[date] });
    } catch (error) {
        res.status(500).json({ error: 'Gagal update note' });
    }
});

// API untuk delete note
app.delete('/api/notes/:date', (req, res) => {
    try {
        const { date } = req.params;
        
        if (!notesStorage[date]) {
            return res.status(404).json({ error: 'Note tidak ditemukan' });
        }

        delete notesStorage[date];
        res.json({ success: true, message: 'Note berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ error: 'Gagal hapus note' });
    }
});

// API untuk generate quiz menggunakan Gemini
app.post('/api/generate-quiz', async (req, res) => {
    try {
        const { title, description, vocabulary } = req.body;
        
        if (!title && !description && (!vocabulary || vocabulary.length === 0)) {
            return res.status(400).json({ error: 'Minimal harus ada title, description, atau vocabulary' });
        }

        // Buat prompt untuk Gemini
        let prompt = `Buatkan 5 soal pilihan ganda dalam bahasa Jepang berdasarkan materi berikut :\n\n`;
        
        if (description) {
            prompt += `Note: ${description}\n\n`;
        }
        
        if (vocabulary && vocabulary.length > 0) {
            prompt += `Daftar Kosakata:\n`;
            vocabulary.forEach((word, index) => {
                prompt += `${index + 1}. ${word}\n`;
            });
        }
        
        prompt += `\nFormat jawaban dalam JSON seperti ini:
{
  "questions": [
    {
      "question": "明日、仕事があるから、早く＿＿",
      "options": ["A. 寝ないと", "B. 寝られる", "C. 寝ない", "D. 寝させる"],
      "correct": 0,
      "explanation": "Penjelasan jawaban yang benar"
    }
  ]
}

Pastikan soal bervariasi dan menguji pemahaman tentang materi yang diberikan.`;

        const geminiResponse = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`,
            {
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-goog-api-key': GEMINI_API_KEY
                }
            }
        );

        const generatedText = geminiResponse.data.candidates[0].content.parts[0].text;
        
        // Extract JSON from the response
        const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Invalid response format from Gemini');
        }
        
        const quizData = JSON.parse(jsonMatch[0]);
        
        res.json({ success: true, quiz: quizData });
    } catch (error) {
        console.error('Error generating quiz:', error);
        res.status(500).json({ error: 'Gagal generate quiz: ' + error.message });
    }
});

// API untuk get current time WITA
app.get('/api/current-time-wita', (req, res) => {
    try {
        const now = new Date();
        // WITA = UTC+8
        const wita = new Date(now.getTime() + (8 * 60 * 60 * 1000));
        
        res.json({
            currentTime: wita.toISOString(),
            timezone: 'WITA',
            offset: '+08:00'
        });
    } catch (error) {
        res.status(500).json({ error: 'Gagal mendapatkan waktu WITA' });
    }
});

app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});