console.log("Content script loaded on YouTube");

//(to be improved)
let captions = document.querySelectorAll(".caption-line"); 
let transcript = "";
captions.forEach(cap => transcript += cap.innerText + " ");

chrome.runtime.sendMessage({ transcript });
