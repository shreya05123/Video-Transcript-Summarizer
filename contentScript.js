console.log("✅ Content script injected");

// Listen for message from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Check if the message is for getting the transcript
  if (request.action === "get_transcript") {
    console.log("📩 Received get_transcript message in content script");
    
    // Use an immediately-invoked async function to handle the async operation
    (async () => {
      try {
        const transcriptText = await fetchTranscriptFromPage();
        if (transcriptText) {
          console.log("📤 Sending transcript back to popup");
          sendResponse({ success: true, transcript: transcriptText });
        } else {
           console.warn("⚠️ Could not fetch or parse transcript");
           sendResponse({ success: false, error: "Transcript not found or couldn't be parsed." });
        }
      } catch (error) {
          console.error("❌ Error fetching transcript:", error);
          sendResponse({ success: false, error: `Error fetching transcript: ${error.message}` });
      }
    })();
    
    // Return true to indicate you wish to send a response asynchronously
    return true; 
  }
});

// Function to find the player response object in the page
function getPlayerResponse() {
  // Try finding it directly on the window object
  if (window.ytInitialPlayerResponse) {
    return window.ytInitialPlayerResponse;
  }
  
  // If not found, search through script tags
  const scripts = document.querySelectorAll("script");
  for (const script of scripts) {
    if (script.textContent.includes('ytInitialPlayerResponse')) {
      try {
         // Extract the JSON part
        const match = script.textContent.match(/ytInitialPlayerResponse\s*=\s*(\{.*?\});/);
        if (match && match[1]) {
          return JSON.parse(match[1]);
        }
      } catch (error) {
        console.error("❌ Error parsing ytInitialPlayerResponse from script tag:", error);
      }
    }
  }
  console.warn("❌ ytInitialPlayerResponse not found.");
  return null; // Return null if not found
}

// Async function to fetch and parse transcript data
async function fetchTranscriptFromPage() {
  const playerResponse = getPlayerResponse();

  // Check if playerResponse and caption data exist
  if (!playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
    console.warn("❌ No captions track list found in ytInitialPlayerResponse");
    return null; // No captions available
  }

  try {
    const captionTracks = playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
    
    // Find an English track (prefer non-auto-generated)
    let englishTrack = captionTracks.find(track => track.languageCode === "en");
    if (!englishTrack) {
        // If no "en", find any English variant like "en-GB", "en-US" etc.
        englishTrack = captionTracks.find(track => track.languageCode.startsWith("en-"));
    }
     // If still no track, try the first available track as a fallback
    if (!englishTrack && captionTracks.length > 0) {
        console.warn("⚠️ No English track found, using first available track:", captionTracks[0].languageCode);
        englishTrack = captionTracks[0]; 
    }

    if (!englishTrack || !englishTrack.baseUrl) {
      console.warn("❌ No suitable caption track with baseUrl found.");
      return null; // No suitable track found
    }

    console.log(`💡 Found caption track: ${englishTrack.name?.simpleText || 'Unknown Name'}, URL: ${englishTrack.baseUrl}`);

    // Fetch the transcript data from the baseUrl
    const response = await fetch(englishTrack.baseUrl);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const transcriptXML = await response.text();

    // Parse the XML transcript
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(transcriptXML, "text/xml");
    const textNodes = xmlDoc.querySelectorAll("text"); // YouTube captions use <text> tags

    let fullTranscript = "";
    textNodes.forEach((node, index) => {
        // Decode HTML entities (like &amp;, &#39;) and append with a space
        const text = node.textContent || "";
        const tempElement = document.createElement('div'); // Use a temporary element for decoding
        tempElement.innerHTML = text; 
        fullTranscript += tempElement.textContent + (index < textNodes.length - 1 ? " " : ""); // Add space between segments
    });

    return fullTranscript.trim(); // Return the concatenated text

  } catch (err) {
    console.error("❌ Error processing caption tracks or fetching/parsing transcript:", err);
    throw err; // Re-throw the error to be caught by the caller
  }
}