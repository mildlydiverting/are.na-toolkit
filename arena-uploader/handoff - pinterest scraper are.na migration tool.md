# Handoff: Pinterest Scraper & Are.na Migration Tool

## Context
- **New project**: Pinterest data extraction and migration to Are.na
- **Repo**: TBD (new repo to be created, or add to existing are.na-toolkit or md-tools)
- **File(s) created this session**: 
  - `pinterest_scraper.py` (main scraper with login logic and throttling)
  - `arena_uploader.py` (Are.na API integration for migration)
  - `requirements.txt` ✓ (already created and added to repo)

## What we built this session

Created a two-part pipeline for extracting Pinterest board data and migrating it to Are.na:

1. **Pinterest scraper** - extracts pins from boards with:
   - Login authentication using session management and CSRF tokens
   - Speed throttling with random delays (configurable 2-5 second range)
   - Pagination support for large boards
   - Downloads high-resolution images
   - Creates markdown files for each pin with embedded image and metadata
   - Configurable max pins limit

2. **Are.na uploader** - migrates scraped content to Are.na using v2 API:
   - Channel creation capability
   - Block upload with image, title, and description
   - Batch processing of scraped Pinterest data

## Technical setup completed

1. **Python environment management** - established workflow using:
   - pyenv for Python version management
   - virtualenv for isolated project environments
   - Python 3.10.4 recommended (f-strings require 3.6+)

2. **Dependencies** (see `requirements.txt`):
   - `requests>=2.28.0` - used by both scripts for HTTP requests and file uploads
   - `beautifulsoup4>=4.11.0` - used by pinterest scraper only for HTML parsing

## Known issues / limitations

1. **Pinterest login** - basic implementation that may not handle:
   - CAPTCHA challenges
   - Two-factor authentication
   - Changing Pinterest HTML structure
   - Session expiry over long scraping runs

2. **Pinterest scraping** - relies on HTML selectors that may break if Pinterest changes their markup:
   - Pin container class: `'Pin'`
   - Image selector: `pin.find('img')['src']`
   - Description selector: `pin.find('div', class_='description')`

3. **Are.na API** - uses v2 endpoint, but Kim's other tools use v3:
   - Should migrate to v3 (`https://api.are.na/v3`) for consistency
   - v3 uses `.src` for image URLs (not `.url`)
   - Channel slug is short form only in v3

4. **Terms of Service** - Pinterest web scraping may violate their ToS; no official personal account API exists

5. **Authentication storage** - credentials currently hardcoded in script; should be moved to separate config file (like `arena-config.js` pattern in are.na-picks)

## What needs to happen next

### Immediate next steps:
1. Test the Pinterest login logic with actual credentials
2. Inspect Pinterest's actual HTML structure and update selectors if needed
3. Create Are.na access token from account settings
4. Create target Are.na channel for migration
5. Update Are.na uploader to use v3 API endpoints for consistency with other tools

### Recommended improvements:
1. Separate credentials into a config file (not version-controlled)
2. Add error handling and logging throughout
3. Handle Pinterest pagination more robustly
4. Add retry logic for failed downloads
5. Implement progress indicators for long-running scrapes
6. Add dry-run mode to preview what would be scraped
7. Consider rate limiting on Are.na uploads too
8. Add metadata extraction (pin URL, creator, board name, save date, etc.)
9. Preserve original Pinterest image filenames when possible

### Integration opportunities:
- Could be added to `are.na-toolkit` repo alongside arena-palette
- Markdown output format aligns with Kim's existing knowledge management system
- Could potentially integrate with Eagle.app local REST API for local library backup

## Relevant technical constraints or decisions made

1. **Python 3.6+ required** - uses f-strings for string formatting
2. **Session-based authentication** - maintains cookies across requests for Pinterest login
3. **Random delay throttling** - delays between 2-5 seconds (configurable) to avoid rate limiting/blocking
4. **Markdown + embedded image storage** - each pin becomes a .md file with downloaded image
5. **Vanilla requests + BeautifulSoup** - no Selenium/browser automation (lighter weight but less robust against anti-scraping)
6. **Are.na v2 API** - should be updated to v3 for consistency

## Key learnings from this session

1. **F-strings** (`f"text {variable}"`) are Python 3.6+ syntax for string interpolation
2. **pyenv + virtualenv workflow** - standard Python environment management on macOS
3. **requests.Session()** - essential for maintaining login state across scraping requests
4. **Random delays** - `time.sleep(random.uniform(min, max))` makes scraping more human-like
5. **CSRF tokens** - web forms often require extracting and submitting these for authentication

## Files to create/organize

- [x] `requirements.txt` - created and added to repo
- [ ] Create project directory structure
- [ ] Set up pyenv local Python version (3.10.4)
- [ ] Create virtualenv (`python -m venv venv`)
- [ ] Create `pinterest_scraper.py` (main scraper script)
- [ ] Create `arena_uploader.py` (Are.na migration script)
- [ ] Create `config.py` or `config.json` for credentials (add to .gitignore)
- [ ] Create `.gitignore` (include: venv/, config.py, pinterest_data/, *.pyc, __pycache__/)
- [ ] Create README.md with setup and usage instructions

## Additional context

Kim has extensive experience with:
- Are.na API v3 (from are.na-picks and arena-palette projects)
- Browser-based single-file HTML tools (no build step preference)
- Metadata enrichment and classification systems
- macOS zsh scripting
- Iterative debugging with clear root-cause explanations

This project differs from Kim's usual workflow by:
- Being Python-based rather than browser JavaScript
- Requiring server-side scraping rather than client-side API calls
- Needing credential management for authentication
- Potentially running afoul of ToS (Pinterest scraping)

---
*Session date: 2026-05-01*
*Template adapted from: ~/Development/are.na-toolkit/handoff-template.md*