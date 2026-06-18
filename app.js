/**
 * BigQuery Release Notes Explorer & Twitter Sharer
 * Plain JavaScript Application
 */

// Application State
const state = {
  allUpdates: [],
  filteredUpdates: [],
  currentFilter: 'all',
  searchQuery: '',
  selectedUpdateForTweet: null,
  activeSource: 'loading'
};

// DOM Elements
const elements = {
  refreshBtn: document.getElementById('refresh-btn'),
  refreshIcon: document.getElementById('refresh-icon'),
  sourceIndicator: document.getElementById('source-indicator'),
  sourceText: document.getElementById('source-text'),
  searchInput: document.getElementById('search-input'),
  clearSearchBtn: document.getElementById('clear-search-btn'),
  typeFilters: document.getElementById('type-filters'),
  statTotalCount: document.getElementById('stat-total-count'),
  statLastDate: document.getElementById('stat-last-date'),
  feedSkeleton: document.getElementById('feed-skeleton'),
  feedEmpty: document.getElementById('feed-empty'),
  feedContainer: document.getElementById('feed-container'),
  resetFiltersBtn: document.getElementById('reset-filters-btn'),
  
  // Twitter Modal Elements
  tweetModal: document.getElementById('tweet-modal'),
  closeModalBtn: document.getElementById('close-modal-btn'),
  cancelTweetBtn: document.getElementById('cancel-tweet-btn'),
  sendTweetBtn: document.getElementById('send-tweet-btn'),
  modalUpdateType: document.getElementById('modal-update-type'),
  modalUpdateDate: document.getElementById('modal-update-date'),
  modalUpdateText: document.getElementById('modal-update-text'),
  tweetTextarea: document.getElementById('tweet-textarea'),
  charCounter: document.getElementById('char-counter'),
  tweetLiveText: document.getElementById('tweet-live-text'),
  toastContainer: document.getElementById('toast-container')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  fetchReleaseNotes();
});

// Setup Events
function setupEventListeners() {
  // Refresh Button
  elements.refreshBtn.addEventListener('click', () => {
    fetchReleaseNotes(true);
  });

  // Search Input
  elements.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    elements.clearSearchBtn.style.display = state.searchQuery ? 'flex' : 'none';
    filterAndRender();
  });

  // Clear Search
  elements.clearSearchBtn.addEventListener('click', () => {
    elements.searchInput.value = '';
    state.searchQuery = '';
    elements.clearSearchBtn.style.display = 'none';
    filterAndRender();
  });

  // Filters Tabs
  elements.typeFilters.addEventListener('click', (e) => {
    const tab = e.target.closest('.filter-tab');
    if (!tab) return;
    
    // Toggle active class
    document.querySelectorAll('.filter-tab').forEach(el => el.classList.remove('active'));
    tab.classList.add('active');
    
    state.currentFilter = tab.dataset.type;
    filterAndRender();
  });

  // Reset Filters Button
  elements.resetFiltersBtn.addEventListener('click', resetFilters);

  // Modal Closure
  elements.closeModalBtn.addEventListener('click', closeTweetModal);
  elements.cancelTweetBtn.addEventListener('click', closeTweetModal);
  
  // Close modal on overlay click
  elements.tweetModal.addEventListener('click', (e) => {
    if (e.target === elements.tweetModal) {
      closeTweetModal();
    }
  });

  // Tweet Textarea Input (Live Preview & Character Counter)
  elements.tweetTextarea.addEventListener('input', updateTweetPreview);

  // Hashtag quick chips
  document.querySelectorAll('.tag-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const tag = chip.dataset.tag;
      const text = elements.tweetTextarea.value;
      if (!text.includes(tag)) {
        elements.tweetTextarea.value = text.trim() + ' ' + tag;
        updateTweetPreview();
      }
    });
  });

  // Send Tweet
  elements.sendTweetBtn.addEventListener('click', executeTweet);
}

// Fetch Release Notes with robust proxy & fallback logic
async function fetchReleaseNotes(forceRefresh = false) {
  setLoadingState(true);
  
  const feedUrl = 'https://docs.cloud.google.com/feeds/bigquery-release-notes.xml';
  
  // CORS Proxies
  const proxies = [
    // Direct URL (Tries first, will work if CORS headers allow or running in non-CORS context)
    { 
      url: feedUrl, 
      type: 'live', 
      label: 'Live Feed' 
    },
    // CORS proxy 1: corsproxy.io
    { 
      url: `https://corsproxy.io/?${encodeURIComponent(feedUrl)}`, 
      type: 'proxy', 
      label: 'CORS Proxy 1' 
    },
    // CORS proxy 2: allorigins
    { 
      url: `https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}`, 
      type: 'proxy', 
      label: 'CORS Proxy 2' 
    },
    // Local fallback backup file
    { 
      url: './backup-feed.xml', 
      type: 'backup', 
      label: 'Backup Cache' 
    }
  ];

  let fetchSuccess = false;
  let errorMessages = [];

  for (const proxy of proxies) {
    try {
      if (proxy.type === 'live' && !forceRefresh) {
        // Skip direct fetch on regular load to save time since it usually CORS blocks in browsers
        continue;
      }
      
      console.log(`Attempting fetch from: ${proxy.label} (${proxy.url})`);
      const response = await fetch(proxy.url, { 
        headers: { 'Accept': 'application/xml, text/xml, */*' } 
      });
      
      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }
      
      const xmlText = await response.text();
      
      // Basic validation of xml text
      if (!xmlText || !xmlText.trim().startsWith('<?xml') && !xmlText.trim().includes('<feed')) {
        throw new Error('Invalid XML format returned');
      }

      // Successful Parse
      const updates = parseXMLFeed(xmlText);
      if (updates.length > 0) {
        state.allUpdates = updates;
        state.activeSource = proxy.type;
        updateSourceIndicator(proxy.type, proxy.label);
        showToast(`Successfully loaded ${updates.length} updates from ${proxy.label}`, 'success');
        fetchSuccess = true;
        break;
      } else {
        throw new Error('Parsed 0 updates from the feed');
      }
    } catch (err) {
      console.warn(`Failed loading from ${proxy.label}:`, err.message);
      errorMessages.push(`${proxy.label}: ${err.message}`);
    }
  }

  if (!fetchSuccess) {
    console.error('All fetch channels failed:', errorMessages);
    showToast('Failed to connect to feed. Showing offline sample.', 'error');
    // Load mock offline sample if completely disconnected and backup file fails
    loadOfflineMockData();
  }

  setLoadingState(false);
  filterAndRender();
}

// Set UI loading elements
function setLoadingState(isLoading) {
  if (isLoading) {
    elements.refreshIcon.classList.add('spinning');
    elements.refreshBtn.disabled = true;
    elements.feedSkeleton.style.display = 'flex';
    elements.feedContainer.style.display = 'none';
    elements.feedEmpty.style.display = 'none';
  } else {
    elements.refreshIcon.classList.remove('spinning');
    elements.refreshBtn.disabled = false;
    elements.feedSkeleton.style.display = 'none';
    elements.feedContainer.style.display = 'grid';
  }
}

// Update source indicator badge in header
function updateSourceIndicator(type, label) {
  elements.sourceIndicator.className = `source-badge ${type}`;
  elements.sourceText.textContent = label;
  
  let iconClass = 'fa-circle-nodes';
  if (type === 'live') iconClass = 'fa-signal';
  if (type === 'proxy') iconClass = 'fa-server';
  if (type === 'backup') iconClass = 'fa-floppy-disk';
  
  const icon = elements.sourceIndicator.querySelector('i');
  icon.className = `fa-solid ${iconClass}`;
}

// Parse Atom Feed XML content
function parseXMLFeed(xmlText) {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    // Check parser errors
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      throw new Error('XML parsing failed: ' + parseError.textContent);
    }
    
    const entries = xmlDoc.getElementsByTagName('entry');
    let parsedUpdates = [];
    
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      
      const title = entry.getElementsByTagName('title')[0]?.textContent || 'Update';
      const id = entry.getElementsByTagName('id')[0]?.textContent || `update_${i}`;
      const updatedStr = entry.getElementsByTagName('updated')[0]?.textContent || '';
      
      // Get alternate link
      let link = 'https://docs.cloud.google.com/bigquery/docs/release-notes';
      const links = entry.getElementsByTagName('link');
      for (let j = 0; j < links.length; j++) {
        const lnk = links[j];
        if (lnk.getAttribute('rel') === 'alternate' || !lnk.getAttribute('rel')) {
          link = lnk.getAttribute('href') || link;
          break;
        }
      }
      
      // HTML content
      const contentEl = entry.getElementsByTagName('content')[0];
      const contentHtml = contentEl?.textContent || contentEl?.innerHTML || '';
      
      // Parse content HTML to split multi-heading entries into single items
      const subUpdates = splitEntryContent(title, updatedStr, link, id, contentHtml);
      parsedUpdates = parsedUpdates.concat(subUpdates);
    }
    
    return parsedUpdates;
  } catch (err) {
    console.error('Error parsing XML feed:', err);
    return [];
  }
}

// Split multi-heading day content into individual card objects
function splitEntryContent(entryTitle, entryDateStr, entryLink, entryId, contentHtml) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = contentHtml;
  
  const subUpdates = [];
  const children = Array.from(tempDiv.children);
  
  // Format clean date
  let formattedDate = entryTitle; // fallback
  let dateObj = null;
  if (entryDateStr) {
    dateObj = new Date(entryDateStr);
    if (!isNaN(dateObj.getTime())) {
      formattedDate = dateObj.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    }
  }

  // If there are no HTML tags or no h3 tags, treat entire content as General
  const hasHeadings = tempDiv.querySelector('h3, h4, h2') !== null;
  
  if (children.length === 0 || !hasHeadings) {
    subUpdates.push({
      id: `${entryId}_0`,
      date: dateObj || new Date(),
      dateString: formattedDate,
      type: 'General',
      htmlContent: contentHtml,
      plainText: tempDiv.textContent.trim(),
      link: entryLink
    });
    return subUpdates;
  }
  
  let currentType = 'General';
  let currentElements = [];
  let index = 0;
  
  for (const child of children) {
    if (['H2', 'H3', 'H4'].includes(child.tagName)) {
      // If we already accumulated content for a previous type, push it
      if (currentElements.length > 0) {
        const sectionHtml = currentElements.map(el => el.outerHTML).join('');
        const sectionText = currentElements.map(el => el.textContent).join(' ').replace(/\s+/g, ' ').trim();
        
        subUpdates.push({
          id: `${entryId}_${index++}`,
          date: dateObj || new Date(),
          dateString: formattedDate,
          type: normalizeUpdateType(currentType),
          htmlContent: sectionHtml,
          plainText: sectionText,
          link: entryLink
        });
        currentElements = [];
      }
      currentType = child.textContent.trim();
    } else {
      currentElements.push(child);
    }
  }
  
  // Push the final segment
  if (currentElements.length > 0) {
    const sectionHtml = currentElements.map(el => el.outerHTML).join('');
    const sectionText = currentElements.map(el => el.textContent).join(' ').replace(/\s+/g, ' ').trim();
    
    subUpdates.push({
      id: `${entryId}_${index++}`,
      date: dateObj || new Date(),
      dateString: formattedDate,
      type: normalizeUpdateType(currentType),
      htmlContent: sectionHtml,
      plainText: sectionText,
      link: entryLink
    });
  }
  
  return subUpdates;
}

// Normalize Heading strings to standard types
function normalizeUpdateType(typeText) {
  const type = typeText.toLowerCase().trim();
  if (type.includes('feature') || type.includes('new')) return 'Feature';
  if (type.includes('change') || type.includes('update')) return 'Change';
  if (type.includes('deprecat')) return 'Deprecated';
  if (type.includes('fix') || type.includes('bug') || type.includes('issue')) return 'Bug Fix';
  return 'General';
}

// Render filtered release updates list
function filterAndRender() {
  const query = state.searchQuery.toLowerCase().trim();
  
  // 1. Filter by category & search query
  state.filteredUpdates = state.allUpdates.filter(item => {
    // Type Filter
    if (state.currentFilter !== 'all' && item.type !== state.currentFilter) {
      return false;
    }
    
    // Keyword Search
    if (query) {
      const textMatch = item.plainText.toLowerCase().includes(query);
      const dateMatch = item.dateString.toLowerCase().includes(query);
      const typeMatch = item.type.toLowerCase().includes(query);
      return textMatch || dateMatch || typeMatch;
    }
    
    return true;
  });
  
  // Sort updates descending (newest date first)
  state.filteredUpdates.sort((a, b) => b.date - a.date);

  // 2. Render statistics
  elements.statTotalCount.textContent = state.filteredUpdates.length;
  if (state.filteredUpdates.length > 0) {
    elements.statLastDate.textContent = state.filteredUpdates[0].dateString;
  } else {
    elements.statLastDate.textContent = '-';
  }

  // 3. Render feed container
  if (state.filteredUpdates.length === 0) {
    elements.feedContainer.style.display = 'none';
    elements.feedEmpty.style.display = 'block';
  } else {
    elements.feedContainer.style.display = 'grid';
    elements.feedEmpty.style.display = 'none';
    
    elements.feedContainer.innerHTML = state.filteredUpdates.map(item => {
      const badgeClass = `badge-${item.type.toLowerCase().replace(' ', '')}`;
      const cardTypeClass = `type-${item.type.toLowerCase().replace(' ', '')}`;
      
      // Perform highlighting if search is active
      let highlightedHtml = item.htmlContent;
      if (query) {
        highlightedHtml = highlightHTML(item.htmlContent, state.searchQuery);
      }
      
      return `
        <article class="update-card ${cardTypeClass}" id="card-${item.id}">
          <div class="card-time-column">
            <span class="update-date">${item.dateString}</span>
            <span class="update-timestamp">${item.date.toLocaleDateString()}</span>
          </div>
          
          <div class="card-content-column">
            <span class="badge ${badgeClass}">${item.type}</span>
            <div class="update-body-text">
              ${highlightedHtml}
            </div>
          </div>
          
          <div class="card-action-column">
            <button class="action-btn btn-tweet-card" onclick="openTweetEditor('${item.id}')" title="Tweet this update">
              <i class="fa-brands fa-x-twitter"></i>
            </button>
            <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="action-btn" title="View official release documentation">
              <i class="fa-solid fa-arrow-up-right-from-square"></i>
            </a>
          </div>
        </article>
      `;
    }).join('');
  }
}

// Highlight text occurrences outside of HTML brackets
function highlightHTML(html, search) {
  if (!search) return html;
  const esc = search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`(${esc})(?=[^<>]*([<]|$))`, 'gi');
  return html.replace(regex, '<mark class="highlight">$1</mark>');
}

// Reset filters back to default
function resetFilters() {
  elements.searchInput.value = '';
  state.searchQuery = '';
  elements.clearSearchBtn.style.display = 'none';
  state.currentFilter = 'all';
  
  // Set All active
  document.querySelectorAll('.filter-tab').forEach(el => {
    el.classList.toggle('active', el.dataset.type === 'all');
  });
  
  filterAndRender();
}

// Open Twitter customized share modal editor
window.openTweetEditor = function(id) {
  const item = state.allUpdates.find(u => u.id === id);
  if (!item) return;
  
  state.selectedUpdateForTweet = item;
  
  // Setup modal details
  elements.modalUpdateType.textContent = item.type;
  elements.modalUpdateType.className = `badge badge-${item.type.toLowerCase().replace(' ', '')}`;
  elements.modalUpdateDate.textContent = item.dateString;
  elements.modalUpdateText.textContent = item.plainText;
  
  // Construct default Tweet message
  // limit detail length dynamically to respect X/Twitter's 280-char limit
  const baseLen = `📢 New Google Cloud #BigQuery Update! (${item.type}):\n""\n\n Read details: ${item.link} #GoogleCloud`.length;
  const charsRemainingForText = Math.max(80, 280 - baseLen);
  
  let textSample = item.plainText;
  if (textSample.length > charsRemainingForText) {
    textSample = textSample.slice(0, charsRemainingForText - 3) + '...';
  }
  
  const defaultTweet = `📢 New Google Cloud #BigQuery Update! (${item.type}):\n"${textSample}"\n\nRead details: ${item.link}`;
  
  elements.tweetTextarea.value = defaultTweet;
  elements.tweetModal.classList.add('open');
  
  updateTweetPreview();
};

// Update Modal preview & character counter
function updateTweetPreview() {
  const text = elements.tweetTextarea.value;
  
  // Calculate Length with special Twitter rule: links count as 23 chars
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  let len = text.length;
  
  const urls = text.match(urlRegex);
  if (urls) {
    urls.forEach(url => {
      // Remove original link length, add 23
      len = len - url.length + 23;
    });
  }
  
  elements.charCounter.textContent = `${len} / 280`;
  
  // Color code counter
  elements.charCounter.className = 'char-counter';
  if (len > 250 && len <= 280) {
    elements.charCounter.classList.add('limit-warning');
  } else if (len > 280) {
    elements.charCounter.classList.add('limit-exceeded');
  }
  
  // Render tweet live preview card
  let previewText = text;
  // Convert urls to blue links inside preview
  previewText = previewText.replace(urlRegex, url => `<a href="${url}" target="_blank">${url}</a>`);
  // Highlight hashtags
  previewText = previewText.replace(/(#[a-zA-Z0-9_]+)/g, tag => `<span style="color: var(--twitter-blue);">${tag}</span>`);
  
  elements.tweetLiveText.innerHTML = previewText || 'Live preview of your customized post...';
  
  // Disable send button if empty or exceeded limit
  elements.sendTweetBtn.disabled = len <= 0 || len > 280;
}

// Close Twitter Share Modal
function closeTweetModal() {
  elements.tweetModal.classList.remove('open');
  state.selectedUpdateForTweet = null;
}

// Execute Twitter Web Intent Redirect
function executeTweet() {
  const tweetText = elements.tweetTextarea.value;
  if (!tweetText || tweetText.length > 500) return;
  
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
  
  // Open Tweet Intent
  window.open(twitterUrl, '_blank', 'noopener,noreferrer,width=600,height=400');
  
  showToast('Twitter sharing window opened!', 'success');
  closeTweetModal();
}

// Toast Notification System
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconClass = 'fa-circle-check';
  if (type === 'error') iconClass = 'fa-circle-xmark';
  if (type === 'info') iconClass = 'fa-circle-info';
  
  toast.innerHTML = `
    <i class="fa-solid ${iconClass}"></i>
    <span>${message}</span>
  `;
  
  elements.toastContainer.appendChild(toast);
  
  // Force browser layout update
  toast.offsetHeight;
  
  // Slide in
  toast.classList.add('show');
  
  // Remove toast after 4s
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 400);
  }, 4000);
}

// Offline fallback mock data just in case
function loadOfflineMockData() {
  const mockXmlText = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>BigQuery - Release notes (Offline Mode)</title>
  <updated>2026-06-18T00:00:00-07:00</updated>
  <entry>
    <title>June 17, 2026</title>
    <updated>2026-06-17T00:00:00-07:00</updated>
    <link href="https://docs.cloud.google.com/bigquery/docs/release-notes#June_17_2026"/>
    <content type="html"><![CDATA[<h3>Feature</h3>
<p>You can enable <a href="https://docs.cloud.google.com/bigquery/docs/autonomous-embedding-generation">autonomous embedding generation</a> on new or existing tables that you make with the <a href="https://docs.cloud.google.com/bigquery/docs/autonomous-embedding-generation">Vertex AI text-embedding models</a>.</p>
<h3>Change</h3>
<p>BigQuery SQL syntax now supports extended aggregation window syntax in analytical statements.</p>]]></content>
  </entry>
  <entry>
    <title>June 10, 2026</title>
    <updated>2026-06-10T00:00:00-07:00</updated>
    <link href="https://docs.cloud.google.com/bigquery/docs/release-notes#June_10_2026"/>
    <content type="html"><![CDATA[<h3>Bug Fix</h3>
<p>Fixed an issue where some multi-region queries involving materialized views returned transient errors during partition expiration checks.</p>
<h3>Deprecated</h3>
<p>Legacy SQL billing APIs will be fully deprecated on September 1st, 2026. Please transition to BigQuery Reservation API.</p>]]></content>
  </entry>
</feed>`;
  
  const updates = parseXMLFeed(mockXmlText);
  state.allUpdates = updates;
  state.activeSource = 'backup';
  updateSourceIndicator('backup', 'Sample Cache');
}
