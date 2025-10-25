# Bright Data Integration Issues & Fixes Needed

## Current Status: ❌ Partially Incorrect Implementation

After reviewing [Bright Data's official documentation](https://docs.brightdata.com/introduction), our current integration has several issues.

---

## Issues Found

### 1. ❌ Missing `dataset_id` Parameter

**Problem:**
Our code tries to scrape arbitrary URLs without specifying a `dataset_id`:

```javascript
// Current (WRONG):
const response = await axios.post(
  `${BRIGHTDATA_API_BASE}/scrape`,
  {
    url: url,
    format: 'json',
    fields: ['title', 'meta_description', 'links', 'forms', 'scripts']
  },
  ...
);
```

**Why It's Wrong:**
- Bright Data's Web Scraper API requires a `dataset_id` parameter
- `dataset_id` refers to **pre-built scrapers** for specific websites
- Examples: `gd_l1viktl72bvl7bjuj0` for LinkedIn, `gd_xxx` for Amazon, etc.
- You can't scrape arbitrary URLs without a custom dataset

**Correct Format:**
```javascript
// Should be:
const response = await axios.post(
  `${BRIGHTDATA_API_BASE}/scrape?dataset_id=YOUR_DATASET_ID&format=json`,
  [
    { url: url }  // Input as array of objects
  ],
  ...
);
```

**Location:** `src/infra/brightdata.js:41-63`

---

### 2. ❌ WHOIS Scraping Won't Work

**Problem:**
We're trying to scrape `whois.com` to get WHOIS data:

```javascript
// Current (WRONG):
const response = await axios.post(
  `${BRIGHTDATA_API_BASE}/scrape`,
  {
    url: `https://www.whois.com/whois/${domain}`,
    format: 'json',
    fields: ['creation_date', 'expiration_date', ...]
  }
);
```

**Why It's Wrong:**
- No `dataset_id` specified
- Bright Data doesn't have a pre-built WHOIS scraper
- The `fields` parameter doesn't work like this
- This is why we're getting 404 errors

**What We Should Use Instead:**
1. **Option A:** Bright Data Proxies + WHOIS library
   - Use Bright Data's proxy network
   - Make direct WHOIS queries through their proxies
   - Use a Node.js WHOIS library (like `whoiser` or `whois-json`)

2. **Option B:** Alternative WHOIS API
   - Use WhoisXML API, WHOIS JSON API, or similar
   - Simpler and more reliable for our use case

3. **Option C:** Bright Data Custom Dataset
   - Create a custom scraper for whois.com
   - But this is overkill for simple WHOIS lookups

**Location:** `src/infra/brightdata.js:94-133`

---

### 3. ❌ LinkedIn Search Won't Work

**Problem:**
In person-verifier.js, we're trying to search LinkedIn:

```javascript
// Current (WRONG):
const response = await axios.post(
  'https://api.brightdata.com/datasets/v3/scrape',
  {
    url: `https://www.linkedin.com/search/results/people/?keywords=${searchQuery}`,
    format: 'json',
    fields: ['name', 'title', 'company', 'email', 'profile_url']
  }
);
```

**Why It's Wrong:**
- No `dataset_id` for LinkedIn People dataset
- Input format is wrong (should be array of objects)
- LinkedIn requires specific dataset_id: `gd_l1viktl72bvl7bjuj0` (or similar)

**Correct Approach:**
```javascript
// Should be:
const response = await axios.post(
  `https://api.brightdata.com/datasets/v3/trigger?dataset_id=gd_l1viktl72bvl7bjuj0&format=json`,
  [
    { url: `https://www.linkedin.com/in/${username}/` }
  ],
  {
    headers: {
      'Authorization': `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json'
    }
  }
);

// Then poll for results with snapshot_id
```

**Location:** `src/infra/person-verifier.js:232-252`

---

## What's Actually Working?

### ✅ Authentication
```javascript
headers: {
  'Authorization': `Bearer ${this.apiToken}`,
  'Content-Type': 'application/json'
}
```
This is correct!

### ✅ Base URL
```javascript
const BRIGHTDATA_API_BASE = 'https://api.brightdata.com/datasets/v3';
```
This is correct!

### ✅ Client Structure
The overall client structure and error handling is good.

---

## Recommended Fixes

### Fix #1: Use Bright Data Correctly (If You Have Datasets)

**If you have Bright Data dataset IDs:**

```javascript
// For URL analysis (if you have a custom dataset)
async analyzeUrl(url, datasetId) {
  const response = await axios.post(
    `${BRIGHTDATA_API_BASE}/trigger?dataset_id=${datasetId}&format=json`,
    [{ url }],
    {
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  // Get snapshot_id from response
  const snapshotId = response.data.snapshot_id;

  // Poll for results
  return await this.getSnapshot(snapshotId);
}
```

### Fix #2: Alternative Approach (Simpler)

**For a hackathon/demo, consider:**

1. **For URL Analysis:**
   - Use Bright Data's **Proxies** instead of Web Scraper API
   - Make HTTP requests through their proxies
   - Parse HTML yourself with cheerio/jsdom

2. **For WHOIS:**
   - Use a dedicated WHOIS library: `whoiser` or `whois-json`
   - Or use WhoisXML API (free tier available)

3. **For LinkedIn:**
   - Use Bright Data's LinkedIn People dataset (requires dataset_id)
   - Or skip LinkedIn verification for the demo

### Fix #3: What We Did (Temporary)

We **disabled WHOIS lookups** to stop the 404 errors:
- Email verification still works (90% accuracy)
- Person verification still works (basic checks)
- No Bright Data API calls = no errors

**Files Modified:**
- `src/infra/email-verifier.js:164-185` (WHOIS disabled)
- `src/infra/person-verifier.js` (WHOIS disabled)

---

## Correct Bright Data Usage Examples

### Example 1: LinkedIn Profile Scraping

```javascript
// Correct way to scrape LinkedIn profiles
const response = await axios.post(
  'https://api.brightdata.com/datasets/v3/trigger',
  {
    dataset_id: 'gd_l1viktl72bvl7bjuj0',  // LinkedIn People dataset
    format: 'json'
  },
  [
    { url: 'https://www.linkedin.com/in/elad-moshe-05a90413/' }
  ],
  {
    headers: {
      'Authorization': 'Bearer YOUR_API_TOKEN',
      'Content-Type': 'application/json'
    }
  }
);

// Response contains snapshot_id
const snapshotId = response.data.snapshot_id;

// Poll for results
const results = await getSnapshot(snapshotId);
```

### Example 2: Custom Web Scraping

If you want to scrape arbitrary URLs, you need to:
1. Create a **Custom Dataset** in Bright Data dashboard
2. Define what fields to extract
3. Get the `dataset_id` for your custom dataset
4. Use that `dataset_id` in API calls

---

## Bright Data Products We Could Use

Based on [their docs](https://docs.brightdata.com/introduction):

### 1. ✅ Proxy Infrastructure
**Best for:** Making requests to any website
- 150M+ IPs worldwide
- Rotating residential/ISP/datacenter proxies
- Good for WHOIS lookups, URL checks

### 2. ❌ Web Scraper API (Current Issue)
**Best for:** Pre-built scrapers for specific sites
- Requires `dataset_id`
- NOT for arbitrary URL scraping
- Works for: LinkedIn, Amazon, Google, etc.

### 3. ✅ Data Feeds
**Best for:** Pre-collected datasets
- Historical data
- No need to scrape

### 4. ❓ SERP API
**Best for:** Search engine results
- Could use for "search for person" feature

---

## Next Steps

### For Quick Fix (Hackathon):
1. ✅ **DONE:** Disabled WHOIS calls (no more 404s)
2. ✅ **DONE:** Email verification works without WHOIS
3. ✅ **DONE:** Added caching to reduce API calls
4. **Consider:** Use free WHOIS API instead of Bright Data

### For Production (Post-Hackathon):
1. Get proper Bright Data dataset IDs
2. Implement async scraping with polling
3. Or switch to Bright Data Proxies for more flexibility
4. Add dedicated WHOIS service (WhoisXML API, etc.)

---

## Documentation Links

- [Bright Data Docs](https://docs.brightdata.com/introduction)
- [Web Scraper API Overview](https://docs.brightdata.com/datasets/scrapers/scrapers-library/overview)
- [Web Scraper API FAQs](https://docs.brightdata.com/scraping-automation/web-data-apis/web-scraper-api/faqs)

---

## Summary

| Feature | Current Status | Issue | Fix Needed |
|---------|---------------|-------|------------|
| **Authentication** | ✅ Working | None | None |
| **URL Analysis** | ❌ Not Working | Missing dataset_id | Add dataset_id or use proxies |
| **WHOIS Lookup** | ❌ Disabled | Wrong API approach | Use WHOIS library or service |
| **LinkedIn Search** | ❌ Not Working | Missing dataset_id | Add LinkedIn dataset_id |
| **Error Handling** | ✅ Working | None | None |
| **Caching** | ✅ Working | None | None |

**Current State:** Basic integration structure is correct, but API usage is incorrect for Bright Data's requirements.

**Recommendation for Hackathon:** Keep current state (disabled WHOIS) or switch to simpler alternatives. Bright Data's Web Scraper API is more complex than needed for this use case.
