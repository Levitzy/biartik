const API_BASE = '/api';

class VideoDownloader {
    constructor() {
        this.initializeElements();
        this.initializeHandlers();
        this.videoData = null;
        this.platform = null;
        this.currentUrl = null;
        this.isVideoLoaded = false;
        this.initializeEventListeners();
        this.initializeUI();
    }
    
    initializeElements() {
        this.form = document.getElementById('downloadForm');
        this.urlInput = document.getElementById('urlInput');
        this.analyzeBtn = document.getElementById('analyzeBtn');
        this.errorAlert = document.getElementById('errorAlert');
        this.errorMessage = document.getElementById('errorMessage');
        this.videoInfo = document.getElementById('videoInfo');
        this.downloadProgress = document.getElementById('downloadProgress');
        this.videoPreview = document.getElementById('videoPreview');
        this.videoThumbnail = document.getElementById('videoThumbnail');
        this.playButtonOverlay = document.getElementById('playButtonOverlay');
        this.videoLoading = document.getElementById('videoLoading');
        this.downloadOptions = document.getElementById('downloadOptions');
        this.platformIcon = document.getElementById('platformIcon');
        
        const requiredElements = [
            'form', 'urlInput', 'analyzeBtn', 'errorAlert', 'errorMessage',
            'videoInfo', 'downloadProgress', 'videoPreview', 'videoThumbnail',
            'playButtonOverlay', 'videoLoading', 'downloadOptions', 'platformIcon'
        ];
        
        for (const element of requiredElements) {
            if (!this[element]) {
                console.error(`Required element not found: ${element}`);
            }
        }
    }
    
    initializeHandlers() {
        this.tiktokHandler = new TikTokHandler(API_BASE);
        this.facebookHandler = new FacebookHandler(API_BASE);
        
        console.log('Platform handlers initialized');
    }
    
    detectPlatform(url) {
        if (this.tiktokHandler.detectTikTokUrl(url)) {
            return 'tiktok';
        } else if (this.facebookHandler.detectFacebookUrl(url)) {
            return 'facebook';
        }
        return 'unknown';
    }
    
    getCurrentHandler() {
        switch (this.platform) {
            case 'tiktok':
                return this.tiktokHandler;
            case 'facebook':
                return this.facebookHandler;
            default:
                return null;
        }
    }
    
    initializeEventListeners() {
        if (this.form) {
            this.form.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('Form submitted');
                this.analyzeVideo();
            });
        }
        
        if (this.urlInput) {
            this.urlInput.addEventListener('input', () => {
                this.hideError();
                this.updatePlatformDetection();
            });
            
            this.urlInput.addEventListener('paste', (e) => {
                setTimeout(() => {
                    this.validateUrl();
                    this.updatePlatformDetection();
                }, 100);
            });
        }
        
        if (this.playButtonOverlay) {
            this.playButtonOverlay.addEventListener('click', () => {
                this.loadVideoPreview();
            });
            
            this.playButtonOverlay.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.loadVideoPreview();
                }
            });
        }
        
        if (this.videoPreview) {
            this.videoPreview.addEventListener('loadstart', () => {
                this.showVideoLoading();
            });
            
            this.videoPreview.addEventListener('canplay', () => {
                this.hideVideoLoading();
                this.showVideoPreview();
            });
            
            this.videoPreview.addEventListener('error', (e) => {
                console.error('Video preview error:', e);
                this.handleVideoPreviewError();
            });
            
            this.videoPreview.addEventListener('loadeddata', () => {
                this.hideVideoLoading();
                this.showVideoPreview();
            });
        }
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideError();
            }
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.analyzeVideo();
            }
            if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                this.resetForm();
            }
        });
        
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && this.urlInput && !this.urlInput.value) {
                this.urlInput.focus();
            }
        });
    }
    
    initializeUI() {
        if (this.urlInput) {
            this.urlInput.focus();
            this.addPlaceholderAnimation();
        }
        console.log('Multi-Platform Video Downloader initialized successfully');
    }
    
    updatePlatformDetection() {
        if (!this.urlInput) return;
        
        const url = this.urlInput.value.trim();
        const detectedPlatform = this.detectPlatform(url);
        
        if (url && detectedPlatform !== 'unknown') {
            const detectionHandler = detectedPlatform === 'tiktok' ? this.tiktokHandler : this.facebookHandler;
            this.urlInput.style.borderColor = detectionHandler.getStyleBorderColor();
            
            const platformHint = document.createElement('div');
            platformHint.className = 'absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none';
            platformHint.innerHTML = `<span class="text-xs font-semibold px-2 py-1 rounded-full" style="background-color: ${detectionHandler.getStyleBorderColor()}; color: white;">${detectionHandler.getPlatformName()}</span>`;
            
            const existingHint = this.urlInput.parentElement.querySelector('.absolute.right-3');
            if (existingHint) {
                existingHint.remove();
            }
            
            this.urlInput.parentElement.appendChild(platformHint);
        } else {
            this.urlInput.style.borderColor = '';
            const existingHint = this.urlInput.parentElement.querySelector('.absolute.right-3');
            if (existingHint) {
                existingHint.remove();
            }
        }
    }
    
    addPlaceholderAnimation() {
        const tiktokSuggestions = this.tiktokHandler.getTikTokUrlSuggestions();
        const facebookSuggestions = this.facebookHandler.getFacebookUrlSuggestions();
        
        const placeholders = [
            ...tiktokSuggestions,
            ...facebookSuggestions,
            'Paste your TikTok or Facebook URL here...'
        ];
        
        let currentIndex = 0;
        
        setInterval(() => {
            if (this.urlInput && !this.urlInput.value && document.activeElement !== this.urlInput) {
                currentIndex = (currentIndex + 1) % placeholders.length;
                this.urlInput.placeholder = placeholders[currentIndex];
            }
        }, 4000);
    }
    
    validateUrl() {
        if (!this.urlInput) return false;
        
        const url = this.urlInput.value.trim();
        if (url) {
            const platform = this.detectPlatform(url);
            if (platform === 'unknown') {
                this.showError('Please enter a valid TikTok or Facebook URL');
                return false;
            }
            
            const validationHandler = platform === 'tiktok' ? this.tiktokHandler : this.facebookHandler;
            if (!validationHandler.validateTikTokUrl?.(url) && !validationHandler.validateFacebookUrl?.(url)) {
                this.showError(`Please enter a valid ${platform} URL format`);
                return false;
            }
        }
        return true;
    }
    
    showError(message, suggestions = []) {
        console.error('Error:', message);
        
        if (this.errorMessage) {
            let errorHtml = message;
            
            if (suggestions.length > 0) {
                errorHtml += '<br><br><strong>Suggestions:</strong><ul class="mt-2 ml-4">';
                suggestions.forEach(suggestion => {
                    errorHtml += `<li class="list-disc text-sm">${suggestion}</li>`;
                });
                errorHtml += '</ul>';
            }
            
            this.errorMessage.innerHTML = errorHtml;
        }
        
        if (this.errorAlert) {
            this.errorAlert.classList.remove('hidden');
        }
        
        if (this.videoInfo) {
            this.videoInfo.classList.add('hidden');
        }
        
        this.hideLoading();
        
        if (this.errorAlert) {
            this.errorAlert.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
            });
        }
        
        setTimeout(() => {
            this.hideError();
        }, 10000);
    }
    
    hideError() {
        if (this.errorAlert) {
            this.errorAlert.classList.add('hidden');
        }
    }
    
    showLoading() {
        console.log('Showing loading state');
        
        if (this.analyzeBtn) {
            this.analyzeBtn.disabled = true;
            
            const analyzeText = this.analyzeBtn.querySelector('.analyze-text');
            const loadingText = this.analyzeBtn.querySelector('.loading-text');
            
            if (analyzeText) analyzeText.classList.add('hidden');
            if (loadingText) loadingText.classList.remove('hidden');
        }
        
        if (this.urlInput) {
            this.urlInput.disabled = true;
        }
    }
    
    hideLoading() {
        console.log('Hiding loading state');
        
        if (this.analyzeBtn) {
            this.analyzeBtn.disabled = false;
            
            const analyzeText = this.analyzeBtn.querySelector('.analyze-text');
            const loadingText = this.analyzeBtn.querySelector('.loading-text');
            
            if (analyzeText) analyzeText.classList.remove('hidden');
            if (loadingText) loadingText.classList.add('hidden');
        }
        
        if (this.urlInput) {
            this.urlInput.disabled = false;
        }
    }
    
    showVideoLoading() {
        if (this.videoLoading) {
            this.videoLoading.classList.remove('hidden');
        }
        if (this.playButtonOverlay) {
            this.playButtonOverlay.classList.add('hidden');
        }
    }
    
    hideVideoLoading() {
        if (this.videoLoading) {
            this.videoLoading.classList.add('hidden');
        }
    }
    
    showVideoPreview() {
        if (this.videoPreview) {
            this.videoPreview.classList.remove('hidden');
        }
        if (this.videoThumbnail) {
            this.videoThumbnail.classList.add('hidden');
        }
        if (this.playButtonOverlay) {
            this.playButtonOverlay.classList.add('hidden');
        }
        this.isVideoLoaded = true;
    }
    
    showThumbnailFallback() {
        if (this.videoPreview) {
            this.videoPreview.classList.add('hidden');
        }
        if (this.videoThumbnail) {
            this.videoThumbnail.classList.remove('hidden');
        }
        if (this.playButtonOverlay) {
            this.playButtonOverlay.classList.remove('hidden');
        }
        this.isVideoLoaded = false;
    }
    
    handleVideoPreviewError() {
        console.error('Video preview failed to load, trying thumbnail fallback');
        this.hideVideoLoading();
        this.showThumbnailFallback();
        
        if (this.videoData && this.videoData.thumbnail) {
            if (this.videoThumbnail) {
                this.videoThumbnail.src = this.videoData.thumbnail;
                this.videoThumbnail.style.display = 'block';
            }
        }
    }
    
    async loadVideoPreview() {
        if (this.isVideoLoaded || !this.videoData) return;
        
        const currentHandler = this.getCurrentHandler();
        if (!currentHandler) return;
        
        const previewUrl = currentHandler.getPreviewUrl(this.videoData);
        
        if (!previewUrl) {
            this.showToast('Video preview not available', 'error');
            return;
        }
        
        console.log('Loading video preview:', previewUrl);
        this.showVideoLoading();
        
        try {
            const proxyResponse = await fetch(`${API_BASE}/proxy-video`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: previewUrl })
            });

            if (proxyResponse.ok) {
                const videoBlob = await proxyResponse.blob();
                const videoUrl = URL.createObjectURL(videoBlob);
                
                if (this.videoPreview) {
                    const source = this.videoPreview.querySelector('source');
                    if (source) {
                        source.src = videoUrl;
                    }
                    this.videoPreview.src = videoUrl;
                    this.videoPreview.load();
                }
            } else {
                throw new Error('Proxy request failed');
            }
        } catch (error) {
            console.error('Video preview error:', error);
            
            if (this.videoPreview) {
                const source = this.videoPreview.querySelector('source');
                if (source) {
                    source.src = previewUrl;
                }
                this.videoPreview.src = previewUrl;
                this.videoPreview.load();
            }
        }
        
        setTimeout(() => {
            if (!this.isVideoLoaded) {
                this.handleVideoPreviewError();
            }
        }, 15000);
    }
    
    async analyzeVideo() {
        if (!this.urlInput) {
            this.showError('URL input not found');
            return;
        }
        
        const url = this.urlInput.value.trim();
        
        console.log('Analyzing video:', url);
        
        if (!url) {
            this.showError('Please enter a TikTok or Facebook URL');
            return;
        }
        
        if (!this.validateUrl()) {
            return;
        }
        
        this.currentUrl = url;
        this.platform = this.detectPlatform(url);
        
        this.hideError();
        this.showLoading();
        this.resetVideoPreview();
        
        try {
            console.log('Making API request to:', `${API_BASE}/video-info`);
            
            const response = await fetch(`${API_BASE}/video-info`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url })
            });
            
            console.log('API response status:', response.status);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('API response data:', data);
            
            if (!data.success || !data.data) {
                throw new Error('Invalid response format from server');
            }
            
            this.videoData = data.data;
            this.platform = data.platform;
            
            const analysisHandler = this.getCurrentHandler();
            if (analysisHandler && analysisHandler.logTikTokActivity) {
                analysisHandler.logTikTokActivity('analysis_success', { url, success: true });
            } else if (analysisHandler && analysisHandler.logFacebookActivity) {
                analysisHandler.logFacebookActivity('analysis_success', { url, success: true });
            }
            
            this.displayVideoInfo();
            
        } catch (error) {
            console.error('Analysis error:', error);
            
            const errorHandler = this.getCurrentHandler();
            let suggestions = [];
            
            if (errorHandler && errorHandler.getFacebookErrorSuggestions && this.platform === 'facebook') {
                suggestions = errorHandler.getFacebookErrorSuggestions(error.message);
            }
            
            if (errorHandler && errorHandler.logTikTokActivity) {
                errorHandler.logTikTokActivity('analysis_error', { url, error: error.message, success: false });
            } else if (errorHandler && errorHandler.logFacebookActivity) {
                errorHandler.logFacebookActivity('analysis_error', { url, error: error.message, success: false });
            }
            
            this.showError(error.message || 'Failed to analyze video. Please check the URL and try again.', suggestions);
        } finally {
            this.hideLoading();
        }
    }
    
    resetVideoPreview() {
        if (this.videoPreview) {
            this.videoPreview.classList.add('hidden');
            this.videoPreview.src = '';
            this.videoPreview.removeAttribute('poster');
            
            const source = this.videoPreview.querySelector('source');
            if (source) {
                source.src = '';
            }
        }
        
        if (this.videoThumbnail) {
            this.videoThumbnail.classList.remove('hidden');
        }
        
        if (this.playButtonOverlay) {
            this.playButtonOverlay.classList.remove('hidden');
        }
        
        this.hideVideoLoading();
        this.isVideoLoaded = false;
    }
    
    displayVideoInfo() {
        if (!this.videoData) {
            console.error('No video data to display');
            return;
        }
        
        console.log('Displaying video info:', this.videoData);
        
        const { 
            title, 
            author, 
            duration, 
            thumbnail
        } = this.videoData;
        
        const elements = {
            videoTitle: title || `${this.platform === 'tiktok' ? 'TikTok' : 'Facebook'} Video`,
            videoAuthor: author ? `@${author}` : '@Unknown',
            videoDuration: duration || '0:00'
        };
        
        for (const [elementId, value] of Object.entries(elements)) {
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = value;
            } else {
                console.warn(`Element not found: ${elementId}`);
            }
        }
        
        const displayHandler = this.getCurrentHandler();
        if (this.platformIcon && displayHandler) {
            this.platformIcon.textContent = displayHandler.getPlatformIcon();
        }
        
        this.setupVideoPreview(thumbnail);
        this.setupDownloadOptions();
        this.updateFormatStatus();
        this.enhancePlatformSpecificDisplay();
        
        if (this.videoInfo) {
            this.videoInfo.classList.remove('hidden');
            this.videoInfo.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
            });
        }
        
        console.log('Video info displayed successfully');
    }
    
    setupDownloadOptions() {
        if (!this.downloadOptions) return;
        
        this.downloadOptions.innerHTML = '';
        
        const downloadHandler = this.getCurrentHandler();
        if (!downloadHandler) return;
        
        let buttons = [];
        
        if (this.platform === 'tiktok') {
            buttons = downloadHandler.createTikTokDownloadButtons(this.videoData, (quality) => {
                this.downloadVideo(quality);
            });
        } else if (this.platform === 'facebook') {
            buttons = downloadHandler.createFacebookDownloadButtons(this.videoData, (quality) => {
                this.downloadVideo(quality);
            });
        }
        
        buttons.forEach(button => {
            this.downloadOptions.appendChild(button);
        });
    }
    
    updateFormatStatus() {
        const formatStatus = document.getElementById('formatStatus');
        if (!formatStatus) return;
        
        formatStatus.innerHTML = '';
        
        const formatHandler = this.getCurrentHandler();
        if (!formatHandler) return;
        
        let formats = [];
        
        if (this.platform === 'tiktok') {
            formats = formatHandler.getTikTokFormatStatus(this.videoData);
        } else if (this.platform === 'facebook') {
            formats = formatHandler.getFacebookFormatStatus(this.videoData);
        }
        
        formats.forEach(format => {
            const statusDiv = document.createElement('div');
            statusDiv.className = 'flex items-center space-x-3';
            statusDiv.innerHTML = `
                <div class="w-3 h-3 rounded-full ${format.available ? 'bg-green-500' : 'bg-gray-300'}"></div>
                <span class="${format.available ? 'text-gray-900 font-semibold' : 'text-gray-500'}">
                    ${format.label} ${format.status}
                </span>
            `;
            formatStatus.appendChild(statusDiv);
        });
    }
    
    enhancePlatformSpecificDisplay() {
        const enhanceHandler = this.getCurrentHandler();
        if (!enhanceHandler || !this.currentUrl) return;
        
        if (enhanceHandler.enhanceTikTokDisplay && this.platform === 'tiktok') {
            enhanceHandler.enhanceTikTokDisplay(this.videoData, this.videoInfo);
        } else if (enhanceHandler.enhanceFacebookDisplay && this.platform === 'facebook') {
            enhanceHandler.enhanceFacebookDisplay(this.videoData, this.videoInfo, this.currentUrl);
        }
    }
    
    setupVideoPreview(thumbnail) {
        if (this.videoThumbnail && thumbnail) {
            this.videoThumbnail.src = thumbnail;
            this.videoThumbnail.style.display = 'block';
            
            if (this.videoPreview) {
                this.videoPreview.poster = thumbnail;
            }
            
            this.videoThumbnail.onerror = () => {
                console.warn('Thumbnail failed to load');
                if (this.videoThumbnail) {
                    this.videoThumbnail.style.display = 'none';
                }
            };
        } else if (this.videoThumbnail) {
            this.videoThumbnail.style.display = 'none';
        }
        
        this.resetVideoPreview();
    }
    
    async downloadVideo(quality) {
        if (!this.videoData) {
            this.showError('Please analyze a video first');
            return;
        }
        
        const available = this.videoData.available_formats?.[quality];
        if (!available) {
            this.showError(`${quality.replace('_', ' ').toUpperCase()} quality is not available for this video`);
            return;
        }
        
        console.log('Starting download:', quality);
        
        this.showDownloadProgress();
        
        try {
            const downloadHandler = this.getCurrentHandler();
            let response;
            
            if (this.platform === 'tiktok' && downloadHandler.downloadTikTokVideo) {
                response = await downloadHandler.downloadTikTokVideo(this.currentUrl, quality);
            } else if (this.platform === 'facebook' && downloadHandler.downloadFacebookVideo) {
                response = await downloadHandler.downloadFacebookVideo(this.currentUrl, quality);
            } else {
                response = await fetch(`${API_BASE}/download`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        url: this.currentUrl,
                        quality: quality
                    })
                });
            }
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Download failed');
            }
            
            const blob = await response.blob();
            
            if (blob.size === 0) {
                throw new Error('Downloaded file is empty');
            }
            
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = downloadUrl;
            
            const platform = this.platform;
            const videoId = this.videoData.video_id || 'video';
            const filename = `${platform}_${videoId}_${quality}.mp4`;
            a.download = filename;
            
            document.body.appendChild(a);
            a.click();
            
            window.URL.revokeObjectURL(downloadUrl);
            document.body.removeChild(a);
            
            const successHandler = this.getCurrentHandler();
            if (successHandler && successHandler.logTikTokActivity) {
                successHandler.logTikTokActivity('download_success', { url: this.currentUrl, quality, success: true });
            } else if (successHandler && successHandler.logFacebookActivity) {
                successHandler.logFacebookActivity('download_success', { url: this.currentUrl, quality, success: true });
            }
            
            this.showToast(`Download started: ${filename}`, 'success');
            console.log('Download completed:', filename);
            
        } catch (error) {
            console.error('Download error:', error);
            
            const errorDownloadHandler = this.getCurrentHandler();
            if (errorDownloadHandler && errorDownloadHandler.logTikTokActivity) {
                errorDownloadHandler.logTikTokActivity('download_error', { url: this.currentUrl, quality, error: error.message, success: false });
            } else if (errorDownloadHandler && errorDownloadHandler.logFacebookActivity) {
                errorDownloadHandler.logFacebookActivity('download_error', { url: this.currentUrl, quality, error: error.message, success: false });
            }
            
            this.showError(error.message || 'Download failed. Please try again.');
        } finally {
            this.hideDownloadProgress();
        }
    }
    
    showDownloadProgress() {
        if (this.downloadProgress) {
            this.downloadProgress.classList.remove('hidden');
            this.downloadProgress.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
            });
        }
        
        const buttons = this.downloadOptions?.querySelectorAll('button');
        if (buttons) {
            buttons.forEach(btn => btn.disabled = true);
        }
    }
    
    hideDownloadProgress() {
        if (this.downloadProgress) {
            this.downloadProgress.classList.add('hidden');
        }
        
        if (this.videoData?.available_formats) {
            const buttons = this.downloadOptions?.querySelectorAll('button');
            if (buttons) {
                buttons.forEach((btn, index) => {
                    let qualities = [];
                    
                    if (this.platform === 'tiktok') {
                        qualities = ['no_watermark', 'watermark'];
                    } else if (this.platform === 'facebook') {
                        qualities = ['hd', 'sd', 'auto'];
                    }
                    
                    if (qualities[index]) {
                        btn.disabled = !this.videoData.available_formats[qualities[index]];
                    }
                });
            }
        }
    }
    
    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 z-50 max-w-sm px-6 py-4 rounded-2xl shadow-2xl transform translate-x-full transition-transform duration-300 ${
            type === 'success' 
                ? 'bg-gradient-to-r from-green-500 to-green-600 text-white' 
                : 'bg-gradient-to-r from-red-500 to-red-600 text-white'
        }`;
        
        const icon = type === 'success' 
            ? '<svg class="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>'
            : '<svg class="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>';
        
        toast.innerHTML = `
            <div class="flex items-center space-x-3">
                ${icon}
                <div>
                    <div class="font-bold">${type === 'success' ? 'Success!' : 'Error!'}</div>
                    <div class="text-sm opacity-90">${message}</div>
                </div>
                <button class="ml-4 opacity-70 hover:opacity-100" onclick="this.parentElement.parentElement.remove()">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
        }, 100);
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.transform = 'translateX(full)';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.remove();
                    }
                }, 300);
            }
        }, 5000);
    }
    
    resetForm() {
        console.log('Resetting form');
        
        if (this.urlInput) {
            this.urlInput.value = '';
            this.urlInput.style.borderColor = '';
            this.urlInput.focus();
        }
        
        const existingHint = this.urlInput?.parentElement.querySelector('.absolute.right-3');
        if (existingHint) {
            existingHint.remove();
        }
        
        this.hideError();
        
        if (this.videoInfo) {
            this.videoInfo.classList.add('hidden');
        }
        
        if (this.downloadProgress) {
            this.downloadProgress.classList.add('hidden');
        }
        
        this.videoData = null;
        this.platform = null;
        this.currentUrl = null;
        this.resetVideoPreview();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing Multi-Platform Video Downloader...');
    
    try {
        const app = new VideoDownloader();
        
        window.resetApp = () => {
            app.resetForm();
        };
        
        window.addEventListener('beforeunload', (e) => {
            if (app.downloadProgress && !app.downloadProgress.classList.contains('hidden')) {
                e.preventDefault();
                e.returnValue = 'Download in progress. Are you sure you want to leave?';
            }
        });
        
        console.log('✅ Multi-Platform Video Downloader initialized successfully!');
        console.log('📱 Supported platforms: TikTok, Facebook');
        console.log('🔧 Modular architecture with separated handlers');
        
    } catch (error) {
        console.error('❌ Failed to initialize Video Downloader:', error);
    }
});

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'absolute';
        textArea.style.left = '-999999px';
        document.body.prepend(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
        } catch (error) {
            console.error('Copy failed:', error);
        } finally {
            textArea.remove();
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VideoDownloader, formatFileSize, copyToClipboard };
}