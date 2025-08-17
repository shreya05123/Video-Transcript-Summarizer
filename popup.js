// jsPDF things
const { jsPDF } = window.jspdf;

// Transcript part
function requestTranscript() {
    const transcriptBox = document.getElementById("transcriptInput");
    const summaryOutput = document.getElementById("summaryOutput");
    const downloadBtn = document.getElementById("downloadPdfBtn");

    transcriptBox.value = "";
    transcriptBox.placeholder = "Fetching transcript...";
    summaryOutput.textContent = "";
    downloadBtn.disabled = true;

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs.length === 0 || !tabs[0].id) {
            transcriptBox.placeholder = "Error: Could not find active tab.";
            console.error("Error: No active tab found.");
            return;
        }
        if (!tabs[0].url || !tabs[0].url.includes("youtube.com")) {
            transcriptBox.placeholder = "Not a YouTube page.";
            console.log("Not a YouTube page, skipping transcript fetch.");
            return;
        }
        chrome.tabs.sendMessage(tabs[0].id, { action: "get_transcript" }, function (response) {
            if (chrome.runtime.lastError) {
                console.error("Error sending message:", chrome.runtime.lastError.message);
                transcriptBox.placeholder = "Error connecting to page. Try reloading the YouTube tab.";
                return;
            }
            if (response && response.success && response.transcript) {
                transcriptBox.value = response.transcript;
                transcriptBox.placeholder = "Transcript loaded.";
                downloadBtn.disabled = false;
            } else {
                const errorMessage = response?.error || "Transcript not available or could not be fetched.";
                console.warn("Failed to get transcript:", errorMessage);
                transcriptBox.placeholder = errorMessage;
                downloadBtn.disabled = true;
            }
        });
    });
}

// Auto-fetch part
document.addEventListener("DOMContentLoaded", requestTranscript);

// Backend part
async function summarizeTranscript(text) {
    const summaryOutput = document.getElementById("summaryOutput");
    summaryOutput.textContent = "Summarizing...";

    try {
        const response = await fetch("http://127.0.0.1:5000/summarize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transcript: text })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.summary || `Backend error: ${response.status}`);
        }
        const data = await response.json();
        return data.summary || "Could not generate summary.";
    } catch (error) {
        console.error("Error calling backend:", error);
        summaryOutput.textContent = `Error: ${error.message || 'Could not connect to summarizer.'}`;
        return null;
    }
}

// Summarize button part 
document.getElementById("summarizeBtn").addEventListener("click", async () => {
    const transcript = document.getElementById("transcriptInput").value;
    const summaryOutput = document.getElementById("summaryOutput");
    const downloadBtn = document.getElementById("downloadPdfBtn");

    if (!transcript.trim()) {
        alert("Transcript is empty or could not be fetched.");
        return;
    }

    const summary = await summarizeTranscript(transcript);
    if (summary) {
        summaryOutput.textContent = summary;
        downloadBtn.disabled = false; // Enable download after summary
    }
});

// PDF Download Part
document.getElementById("downloadPdfBtn").addEventListener("click", () => {
    const summaryText = document.getElementById("summaryOutput").textContent;
    const downloadBtn = document.getElementById("downloadPdfBtn");

    if (!summaryText.trim()) {
        alert("Summary is empty. Cannot download PDF.");
        return;
    }

    downloadBtn.disabled = true;
    downloadBtn.textContent = "Generating PDF...";

    try {
        const doc = new jsPDF();
        const margin = 15;
        const usableWidth = 210 - 2 * margin;
        doc.setFontSize(11);
        const lines = doc.splitTextToSize(summaryText, usableWidth);
        doc.text(lines, margin, margin);

        const date = new Date();
        const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1)
            .toString()
            .padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
        const filename = `youtube_summary_${formattedDate}.pdf`;

        doc.save(filename);
        console.log("PDF of summary generated and downloaded.");
    } catch (error) {
        console.error("Error generating summary PDF:", error);
        alert("An error occurred while generating the PDF.");
    } finally {
        downloadBtn.disabled = false;
        downloadBtn.textContent = "Download Summary as PDF";
    }
});
