const API_BASE = '/api';

class TikTokDownloader {
    constructor() {
        this.initializeElements();
        this.videoData = null;
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
        
        const requiredElements = [
            'form', 'urlInput', 'analyzeBtn', 'errorAlert', 'errorMessage',
            'videoInfo', 'downloadProgress', 'videoPreview', 'videoThumbnail',
            'playButtonOverlay', 'videoLoading'
        ];
        
        for (const element of requiredElements) {
            if (!this[element]) {
                console.error(`Required element not found: ${element}`);
            }
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
        
        const downloadNoWatermarkBtn = document.getElementById('downloadNoWatermark');
        const downloadWatermarkBtn = document.getElementById('downloadWatermark');
        
        if (downloadNoWatermarkBtn) {
            downloadNoWatermarkBtn.addEventListener('click', () => {
                console.log('Download no watermark clicked');
                this.downloadVideo(true);
            });
        }
        
        if (downloadWatermarkBtn) {
            downloadWatermarkBtn.addEventListener('click', () => {
                console.log('Download with watermark clicked');
                this.downloadVideo(false);
            });
        }
        
        if (this.urlInput) {
            this.urlInput.addEventListener('input', () => {
                this.hideError();
            });
            
            this.urlInput.addEventListener('paste', (e) => {
                setTimeout(() => {
                    this.validateUrl();
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
        console.log('TikTok Downloader initialized successfully');
    }
    
    addPlaceholderAnimation() {
        const placeholders = [
            'https://www.tiktok.com/@username/video/...',
            'https://vm.tiktok.com/...',
            'https://m.tiktok.com/v/...',
            'Paste your TikTok URL here...'
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
        if (url && !url.includes('tiktok.com')) {
            this.showError('Please enter a valid TikTok URL');
            return false;
        }
        return true;
    }
    
    showError(message) {
        console.error('Error:', message);
        
        if (this.errorMessage) {
            this.errorMessage.textContent = message;
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
        }, 8000);
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
        
        const previewUrl = this.videoData.urls?.preview || this.videoData.urls?.watermark;
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
            this.showError('Please enter a TikTok URL');
            return;
        }
        
        if (!this.validateUrl()) {
            return;
        }
        
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
            this.displayVideoInfo();
            
        } catch (error) {
            console.error('Analysis error:', error);
            this.showError(error.message || 'Failed to analyze video. Please check the URL and try again.');
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
            thumbnail, 
            available_formats,
            urls
        } = this.videoData;
        
        const elements = {
            videoTitle: title || 'TikTok Video',
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
        
        this.setupVideoPreview(thumbnail, urls?.preview);
        
        const noWatermarkBtn = document.getElementById('downloadNoWatermark');
        const watermarkBtn = document.getElementById('downloadWatermark');
        
        if (noWatermarkBtn) {
            noWatermarkBtn.disabled = !available_formats?.no_watermark;
        }
        
        if (watermarkBtn) {
            watermarkBtn.disabled = !available_formats?.watermark;
        }
        
        const formatStatus = document.getElementById('formatStatus');
        if (formatStatus) {
            formatStatus.innerHTML = `
                <div class="flex items-center space-x-3">
                    <div class="w-3 h-3 rounded-full ${available_formats?.no_watermark ? 'bg-green-500' : 'bg-gray-300'}"></div>
                    <span class="${available_formats?.no_watermark ? 'text-gray-900 font-semibold' : 'text-gray-500'}">
                        No Watermark Version ${available_formats?.no_watermark ? '✅ Available' : '❌ Not Available'}
                    </span>
                </div>
                <div class="flex items-center space-x-3">
                    <div class="w-3 h-3 rounded-full ${available_formats?.watermark ? 'bg-green-500' : 'bg-gray-300'}"></div>
                    <span class="${available_formats?.watermark ? 'text-gray-900 font-semibold' : 'text-gray-500'}">
                        Watermark Version ${available_formats?.watermark ? '✅ Available' : '❌ Not Available'}
                    </span>
                </div>
            `;
        }
        
        if (this.videoInfo) {
            this.videoInfo.classList.remove('hidden');
            this.videoInfo.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
            });
        }
        
        console.log('Video info displayed successfully');
    }
    
    setupVideoPreview(thumbnail, previewUrl) {
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
        
        if (this.videoPreview && previewUrl) {
            const source = this.videoPreview.querySelector('source');
            if (source) {
                source.src = previewUrl;
            }
        }
        
        this.resetVideoPreview();
    }
    
    async downloadVideo(noWatermark) {
        if (!this.videoData) {
            this.showError('Please analyze a video first');
            return;
        }
        
        const formatType = noWatermark ? 'no_watermark' : 'watermark';
        if (!this.videoData.available_formats?.[formatType]) {
            this.showError(`${noWatermark ? 'No watermark' : 'Watermark'} version is not available for this video`);
            return;
        }
        
        console.log('Starting download:', noWatermark ? 'no watermark' : 'with watermark');
        
        this.showDownloadProgress();
        
        try {
            const response = await fetch(`${API_BASE}/download`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url: this.urlInput.value.trim(),
                    no_watermark: noWatermark
                })
            });
            
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
            
            const filename = `tiktok_${this.videoData.video_id || 'video'}_${noWatermark ? 'no_watermark' : 'watermark'}.mp4`;
            a.download = filename;
            
            document.body.appendChild(a);
            a.click();
            
            window.URL.revokeObjectURL(downloadUrl);
            document.body.removeChild(a);
            
            this.showToast(`Download started: ${filename}`, 'success');
            console.log('Download completed:', filename);
            
        } catch (error) {
            console.error('Download error:', error);
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
        
        const noWatermarkBtn = document.getElementById('downloadNoWatermark');
        const watermarkBtn = document.getElementById('downloadWatermark');
        
        if (noWatermarkBtn) noWatermarkBtn.disabled = true;
        if (watermarkBtn) watermarkBtn.disabled = true;
    }
    
    hideDownloadProgress() {
        if (this.downloadProgress) {
            this.downloadProgress.classList.add('hidden');
        }
        
        if (this.videoData?.available_formats) {
            const { available_formats } = this.videoData;
            const noWatermarkBtn = document.getElementById('downloadNoWatermark');
            const watermarkBtn = document.getElementById('downloadWatermark');
            
            if (noWatermarkBtn) {
                noWatermarkBtn.disabled = !available_formats.no_watermark;
            }
            if (watermarkBtn) {
                watermarkBtn.disabled = !available_formats.watermark;
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
            this.urlInput.focus();
        }
        
        this.hideError();
        
        if (this.videoInfo) {
            this.videoInfo.classList.add('hidden');
        }
        
        if (this.downloadProgress) {
            this.downloadProgress.classList.add('hidden');
        }
        
        this.videoData = null;
        this.resetVideoPreview();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing TikTok Downloader...');
    
    try {
        const app = new TikTokDownloader();
        
        window.resetApp = () => {
            app.resetForm();
        };
        
        window.addEventListener('beforeunload', (e) => {
            if (app.downloadProgress && !app.downloadProgress.classList.contains('hidden')) {
                e.preventDefault();
                e.returnValue = 'Download in progress. Are you sure you want to leave?';
            }
        });
        
        console.log('✅ TikTok Downloader initialized successfully!');
        
    } catch (error) {
        console.error('❌ Failed to initialize TikTok Downloader:', error);
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
    module.exports = { TikTokDownloader, formatFileSize, copyToClipboard };
}