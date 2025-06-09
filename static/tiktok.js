class TikTokHandler {
    constructor(apiBase) {
        this.apiBase = apiBase;
    }

    detectTikTokUrl(url) {
        return url.includes('tiktok.com');
    }

    validateTikTokUrl(url) {
        const patterns = [
            /tiktok\.com\/@[\w.-]+\/video\/\d+/,
            /vm\.tiktok\.com\/[\w]+/,
            /vt\.tiktok\.com\/[\w]+/,
            /m\.tiktok\.com\/v\/\d+/,
            /tiktok\.com\/t\/[\w]+/
        ];
        
        return patterns.some(pattern => pattern.test(url));
    }

    getTikTokUrlSuggestions() {
        return [
            'https://www.tiktok.com/@username/video/...',
            'https://vm.tiktok.com/...',
            'https://m.tiktok.com/v/...',
            'https://vt.tiktok.com/...'
        ];
    }

    createTikTokDownloadButtons(videoData, downloadCallback) {
        const buttons = [];
        
        const noWatermarkBtn = this.createButton(
            'No Watermark',
            'no_watermark',
            'from-success-500 to-success-600 hover:from-success-600 hover:to-success-700',
            videoData.available_formats?.no_watermark,
            downloadCallback
        );
        
        const watermarkBtn = this.createButton(
            'With Watermark',
            'watermark',
            'from-warning-500 to-warning-600 hover:from-warning-600 hover:to-warning-700',
            videoData.available_formats?.watermark,
            downloadCallback
        );
        
        buttons.push(noWatermarkBtn, watermarkBtn);
        return buttons;
    }

    createButton(text, quality, colorClasses, available, callback) {
        const button = document.createElement('button');
        button.className = `bg-gradient-to-r ${colorClasses} text-white font-bold py-3 sm:py-4 px-4 sm:px-6 rounded-xl transition-all duration-200 focus:outline-none focus:ring-4 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0`;
        button.disabled = !available;
        
        button.innerHTML = `
            <div class="flex items-center justify-center space-x-2 sm:space-x-3">
                <svg class="w-5 sm:w-6 h-5 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
                <span class="text-sm sm:text-lg">${text}</span>
            </div>
        `;
        
        if (available) {
            button.addEventListener('click', () => callback(quality));
        }
        
        return button;
    }

    getTikTokFormatStatus(videoData) {
        const formats = [
            { key: 'no_watermark', label: 'No Watermark Version' },
            { key: 'watermark', label: 'Watermark Version' }
        ];
        
        return formats.map(format => {
            const available = videoData.available_formats?.[format.key];
            return {
                available,
                label: format.label,
                status: available ? '✅ Available' : '❌ Not Available'
            };
        });
    }

    getPreviewUrl(videoData) {
        return videoData.urls?.preview || videoData.urls?.watermark;
    }

    getPlatformIcon() {
        return '🎵';
    }

    getPlatformName() {
        return 'TikTok';
    }

    getStyleBorderColor() {
        return '#000000';
    }

    getTikTokSpecificInfo(videoData) {
        return {
            width: videoData.width || 0,
            height: videoData.height || 0,
            aspectRatio: videoData.width && videoData.height 
                ? (videoData.width / videoData.height).toFixed(2)
                : '0.56',
            hasWatermark: !!videoData.urls?.watermark,
            hasNoWatermark: !!videoData.urls?.no_watermark
        };
    }

    enhanceTikTokDisplay(videoData, container) {
        const aspectRatio = this.getTikTokSpecificInfo(videoData).aspectRatio;
        
        if (container && aspectRatio !== '0.56') {
            const videoContainer = container.querySelector('.aspect-\\[9\\/16\\]');
            if (videoContainer && aspectRatio > 1) {
                videoContainer.classList.remove('aspect-[9/16]');
                videoContainer.classList.add('aspect-video');
            }
        }
        
        const qualityBadge = document.createElement('div');
        qualityBadge.className = 'absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm';
        qualityBadge.textContent = 'TikTok';
        
        const videoContainer = container?.querySelector('.relative');
        if (videoContainer) {
            videoContainer.appendChild(qualityBadge);
        }
    }

    async downloadTikTokVideo(url, quality) {
        try {
            const response = await fetch(`${this.apiBase}/download`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url: url,
                    quality: quality
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'TikTok download failed');
            }
            
            return response;
            
        } catch (error) {
            console.error('TikTok download error:', error);
            throw error;
        }
    }

    getTikTokAnalysisStatus(videoData) {
        const status = {
            hasVideo: !!(videoData.urls?.watermark || videoData.urls?.no_watermark),
            hasPreview: !!videoData.urls?.preview,
            hasThumbnail: !!videoData.thumbnail,
            hasInfo: !!(videoData.title && videoData.author),
            quality: 'unknown'
        };
        
        if (videoData.urls?.no_watermark && videoData.urls?.watermark) {
            status.quality = 'both';
        } else if (videoData.urls?.no_watermark) {
            status.quality = 'no_watermark_only';
        } else if (videoData.urls?.watermark) {
            status.quality = 'watermark_only';
        }
        
        return status;
    }

    formatTikTokVideoInfo(videoData) {
        const info = this.getTikTokSpecificInfo(videoData);
        const analysis = this.getTikTokAnalysisStatus(videoData);
        
        return {
            ...videoData,
            platformInfo: {
                platform: 'tiktok',
                aspectRatio: info.aspectRatio,
                dimensions: `${info.width}x${info.height}`,
                qualityAnalysis: analysis,
                extractionMethod: analysis.hasVideo ? 'success' : 'failed'
            }
        };
    }

    logTikTokActivity(action, data) {
        console.log(`[TikTok] ${action}:`, {
            timestamp: new Date().toISOString(),
            action,
            data: {
                url: data.url?.substring(0, 50) + '...',
                quality: data.quality,
                success: data.success,
                error: data.error
            }
        });
    }
}

if (typeof window !== 'undefined') {
    window.TikTokHandler = TikTokHandler;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TikTokHandler;
}