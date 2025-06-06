// DOM Elements
const topicInput = document.getElementById('topic-input');
const summarizeButton = document.getElementById('summarize-button');
const summaryDisplay = document.getElementById('summary-text');
const loadingIndicator = document.getElementById('loading-indicator');
const initialMessage = document.getElementById('initial-message');
const contentArea = document.getElementById('content-area');
const topicTitleElement = document.getElementById('topic-title');
const topicImageElement = document.getElementById('topic-image');
const fullArticleLinkElement = document.getElementById('full-article-link');
const copySummaryButton = document.getElementById('copy-summary-button');
const summaryActionsDiv = document.querySelector('.summary-actions');
const speakSummaryButton = document.getElementById('speak-summary-button');
const suggestionsContainer = document.getElementById('suggestions-container');

// State variables
let fullSummaryText = '';

// Constants for summarization limits (sentences)
const FULL_SUMMARY_SENTENCE_LIMIT = 50; // Increased to show more sentences for full view
const SHORT_SUMMARY_SENTENCE_LIMIT = 10; // Increased for short view as well

// Check for Web Speech API support
const synthesis = window.speechSynthesis;
const utterance = new SpeechSynthesisUtterance();

// Helper function to count sentences (basic implementation)
function countSentences(text) {
    // Simple regex to count sentences ending with ., !, or ?
    return text.split(/[.!?]\s+/).filter(sentence => sentence.trim().length > 0).length;
}

// Helper function to get a truncated summary by sentence count
function getTruncatedSummaryBySentence(text, limit) {
    // This regex splits sentences and keeps the delimiter with the sentence
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];

    if (sentences.length <= limit) {
        return text; // Return original text if it's already within the limit or no sentences found
    }

    // Join the first 'limit' sentences and add '...' at the end
    return sentences.slice(0, limit).join(' ').trim() + '...';
}

// Wait for the DOM to be fully loaded before attaching event listeners
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded.');
    console.log('Summarize button element:', summarizeButton);
    console.log('Copy button element:', copySummaryButton);
    console.log('Listen button element:', speakSummaryButton);
    console.log('Suggestions container element:', suggestionsContainer);

    // Event Listeners
    summarizeButton.addEventListener('click', fetchAndDisplaySummary);
    topicInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            fetchAndDisplaySummary();
        }
    });

    copySummaryButton.addEventListener('click', copySummary);
    
    // Add event listener for speak button if API is supported
    if (speakSummaryButton && synthesis) {
        speakSummaryButton.addEventListener('click', speakSummary);
    } else if (speakSummaryButton) {
        // Hide speak button if API is not supported
        speakSummaryButton.style.display = 'none';
        console.warn('Web Speech API not supported in this browser.');
    }

    // Add input event listener for suggestions
    topicInput.addEventListener('input', handleInputForSuggestions);
});

// Handle input for suggestions
async function handleInputForSuggestions() {
    console.log('Input event detected. Value:', topicInput.value);
    const query = topicInput.value.trim();
    
    // Clear previous suggestions if input is empty
    if (!query) {
        suggestionsContainer.innerHTML = '';
        return;
    }

    try {
        const suggestions = await fetchSuggestions(query);
        displaySuggestions(suggestions);
    } catch (error) {
        console.error('Error fetching suggestions:', error);
        suggestionsContainer.innerHTML = ''; // Clear suggestions on error
    }
}

// Fetch suggestions from Wikipedia API (using action=opensearch)
async function fetchSuggestions(query) {
    const apiUrl = 'https://en.wikipedia.org/w/api.php';
    const params = new URLSearchParams({
        action: 'opensearch',
        search: query,
        limit: 10, // Limit to 10 suggestions
        namespace: 0, // Search only in article namespace
        format: 'json',
        origin: '*'
    });

    const url = `${apiUrl}?${params.toString()}`;

    try {
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data = await res.json();
        // The OpenSearch API returns a specific format, the second element is the array of suggestions
        return data[1] || []; 
    } catch (error) {
        console.error('Error in fetchSuggestions:', query, error);
        throw new Error(`Failed to fetch suggestions for "${query}": ${error.message}`);
    }
}

// Display suggestions in the suggestions container
function displaySuggestions(suggestions) {
    suggestionsContainer.innerHTML = ''; // Clear previous suggestions

    if (suggestions.length === 0) {
        return; // Don't display container if no suggestions
    }

    suggestions.forEach(suggestion => {
        const suggestionElement = document.createElement('div');
        suggestionElement.classList.add('suggestion-item');
        suggestionElement.textContent = suggestion;
        suggestionElement.addEventListener('click', () => {
            topicInput.value = suggestion; // Populate input with clicked suggestion
            suggestionsContainer.innerHTML = ''; // Clear suggestions after selection
             fetchAndDisplaySummary(); // Automatically fetch summary after selecting suggestion
        });
        suggestionsContainer.appendChild(suggestionElement);
    });
}

// Fetch and display Wikipedia summary
async function fetchAndDisplaySummary() {
    // Stop any ongoing speech when fetching a new summary
    if (synthesis && synthesis.speaking) {
        synthesis.cancel();
    }

    const topic = topicInput.value.trim();
    if (!topic) return;

    // Clear previous content and hide elements
    summaryDisplay.textContent = '';
    topicTitleElement.textContent = '';
    topicImageElement.style.display = 'none';
    topicImageElement.src = '';
    fullArticleLinkElement.style.display = 'none';
    fullArticleLinkElement.href = '#';
    contentArea.style.display = 'none';
    initialMessage.style.display = 'none';
    loadingIndicator.style.display = 'block';
    summaryDisplay.style.color = '#333';
    summaryActionsDiv.style.display = 'none';
    
    // Hide speak button while loading or no summary if it exists
    if(speakSummaryButton) {
        speakSummaryButton.style.display = 'none';
    }

    try {
        const data = await fetchWikipediaContent(topic);

        if (data && data.query && data.query.pages) {
            const pageId = Object.keys(data.query.pages)[0];
            const page = data.query.pages[pageId];

            if (page.extract) {
                // Store the full summary text
                fullSummaryText = page.extract;

                // Display the full summary
                summaryDisplay.textContent = fullSummaryText;

                // Display topic title
                topicTitleElement.textContent = page.title;

                // Display image if available
                if (page.thumbnail && page.thumbnail.source) {
                    topicImageElement.src = page.thumbnail.source;
                    topicImageElement.style.display = 'block';
                }

                // Display full article link
                console.log('Wikipedia API response page object:', page);
                // Always show the link and construct href from topic input
                const topicForUrl = topicInput.value.trim().replace(/ /g, '_');
                fullArticleLinkElement.href = `https://en.wikipedia.org/wiki/${encodeURIComponent(topicForUrl)}`;
                fullArticleLinkElement.style.display = 'inline-block';

                // Show the content area and actions div
                contentArea.style.display = 'block';
                summaryActionsDiv.style.display = 'flex';
                
                // Show speak button if supported and it exists
                if (speakSummaryButton && synthesis) {
                     speakSummaryButton.style.display = 'inline-block';
                }

            } else {
                fullSummaryText = ''; // Clear stored text if no extract
                summaryDisplay.style.color = '#555';
                summaryDisplay.textContent = 'No summary found for this topic.';
                contentArea.style.display = 'block';
                topicTitleElement.textContent = page.title || 'Unknown Topic';
                summaryActionsDiv.style.display = 'none';
            }
        } else if (data.error) {
            throw new Error(data.error.info);
        } else {
            throw new Error('Could not fetch Wikipedia content.');
        }

    } catch (error) {
        console.error('Error fetching Wikipedia content:', error);
        fullSummaryText = ''; // Clear stored text on error
        summaryDisplay.style.color = 'red';
        summaryDisplay.textContent = `Error: ${error.message}`;
        contentArea.style.display = 'block';
        summaryActionsDiv.style.display = 'none';
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

// Fetch data from Wikipedia API (using action=query)
async function fetchWikipediaContent(topic) {
    const apiUrl = 'https://en.wikipedia.org/w/api.php';
    const params = new URLSearchParams({
        action: 'query',
        format: 'json',
        titles: topic,
        prop: 'extracts|pageimages|info',
        exsentences: 50,  // Fetch approximately 50 sentences (roughly 1000-1200 words)
        explaintext: true,
        pithumbsize: 300,
        redirects: 1,
        origin: '*'
    });

    const url = `${apiUrl}?${params.toString()}`;

    try {
        console.log('Fetching summary from URL:', url);
        const res = await fetch(url);

        if (!res.ok) {
            const errorText = await res.text();
            console.error('HTTP error fetching summary:', res.status, res.statusText, errorText);
             try {
                 const errorData = JSON.parse(errorText);
                 if (errorData.error && errorData.error.info) {
                      throw new Error(`API error: ${errorData.error.info}`);
                 }
             } catch (parseError) {
             }
            throw new Error(`HTTP error! status: ${res.status}`);
        }

        const data = await res.json();
        console.log('Successfully fetched data for:', topic, data);
        return data;

    } catch (error) {
        console.error('Error in fetchWikipediaContent for topic:', topic, error);
        throw new Error(`Failed to fetch Wikipedia content for "${topic}": ${error.message}`);
    }
}

// Copy summary text to clipboard
function copySummary() {
    const textToCopy = summaryDisplay.textContent; // Copy currently displayed text

    navigator.clipboard.writeText(textToCopy).then(() => {
        // Provide feedback to the user on the button itself
        if (copySummaryButton) {
            const originalText = copySummaryButton.textContent;
            copySummaryButton.textContent = 'Copied!';
            setTimeout(() => {
                copySummaryButton.textContent = originalText;
            }, 2000);
        }
    }).catch(err => {
        console.error('Failed to copy summary: ', err);
         if (copySummaryButton) {
            const originalText = copySummaryButton.textContent;
            copySummaryButton.textContent = 'Copy Failed!';
            setTimeout(() => {
                copySummaryButton.textContent = originalText;
            }, 2000);
        }
    });
}

// Function to speak the summary text
function speakSummary() {
    if (synthesis && summaryDisplay.textContent) {
        // If speech is already speaking, stop it
        if (synthesis.speaking) {
            synthesis.cancel();
            return; // Exit the function after stopping
        }
        
        // Cancel any ongoing speech (redundant check, but good practice)
        synthesis.cancel();
        
        // Set the text to speak
        utterance.text = summaryDisplay.textContent;
        
        // Speak the text
        synthesis.speak(utterance);
    }
}

// Footer Form Handling
document.addEventListener('DOMContentLoaded', function() {
    const feedbackForm = document.getElementById('feedback-form');

    // Handle Feedback Form Submission
    feedbackForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const feedbackText = document.getElementById('feedback-text').value;
        
        // Create mailto link with the feedback
        const subject = 'Wikipedia Summarizer Feedback';
        const body = encodeURIComponent(feedbackText);
        const mailtoLink = `mailto:projectfeedback06@gmail.com?subject=${encodeURIComponent(subject)}&body=${body}`;
        
        // Open default email client
        window.location.href = mailtoLink;
        
        // Reset form
        feedbackForm.reset();
    });
}); 