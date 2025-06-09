class FacebookHandler {
    constructor(apiBase) {
        this.apiBase = apiBase;
    }

    detectFacebookUrl(url) {
        return url.includes('facebook.com') || url.includes('fb.watch');
    }

    validateFacebookUrl(url) {
        const patterns = [
            /facebook\.com\/.*\/videos\/\d+/,
            /facebook\.com\/watch\/\?v=\d+/,
            /facebook\.com\/reel\/\d+/,
            /facebook\.com\/.*\/posts\/\d+/,
            /facebook\.com\/share\/v\/[\w-]+/,
            /facebook\.com\/share\/r\/[\w-]+/,
            /fb\.watch\/[\w-]+/,
            /facebook\.com\/video\.php\?v=\d+/
        ];
        
        return patterns.some(pattern => pattern.test(url));
    }

    getFacebookUrlSuggestions() {
        return [
            'https://www.facebook.com/username/videos/...',
            'https://www.facebook.com/watch/?v=...',
            'https://www.facebook.com/reel/...',
            'https://fb.watch/...',
            'https://www.facebook.com/share/v/...'
        ];
    }

    createFacebookDownloadButtons(videoData, downloadCallback) {
        const buttons = [];
        
        const hdBtn = this.createButton(
            'HD Quality',
            'hd',
            'from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700',
            videoData.available_formats?.hd,
            downloadCallback
        );
        
        const sdBtn = this.createButton(
            'SD Quality',
            'sd',
            'from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700',
            videoData.available_formats?.sd,
            downloadCallback
        );
        
        const autoBtn = this.createButton(
            'Auto Quality',
            'auto',
            'from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700',
            videoData.available_formats?.auto,
            downloadCallback
        );
        
        buttons.push(hdBtn, sdBtn, autoBtn);
        return buttons;
    }

    createButton(text, quality, colorClasses, available, callback) {
        const button = document.createElement('button');
        button.className = `bg-gradient-to-r ${colorClasses} text-white font-bold py-3 sm:py-4 px-4 sm:px-6 rounded-xl transition-all duration-200 focus:outline-none focus:ring-4 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0`;
        button.disabled = !available;
        
        const icon = this.getQualityIcon(quality);
        
        button.innerHTML = `
            <div class="flex items-center justify-center space-x-2 sm:space-x-3">
                ${icon}
                <span class="text-sm sm:text-lg">${text}</span>
            </div>
        `;
        
        if (available) {
            button.addEventListener('click', () => callback(quality));
        }
        
        return button;
    }

    getQualityIcon(quality) {
        const icons = {
            hd: '<svg class="w-5 sm:w-6 h-5 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
            sd: '<svg class="w-5 sm:w-6 h-5 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>',
            auto: '<svg class="w-5 sm:w-6 h-5 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"/></svg>'
        };
        
        return icons[quality] || icons.auto;
    }

    getFacebookFormatStatus(videoData) {
        const formats = [
            { key: 'hd', label: 'HD Quality (1080p+)' },
            { key: 'sd', label: 'SD Quality (720p)' },
            { key: 'auto', label: 'Auto Quality (Best Available)' }
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
        return videoData.urls?.preview || videoData.urls?.auto;
    }

    getPlatformIcon() {
        return '👥';
    }

    getPlatformName() {
        return 'Facebook';
    }

    getStyleBorderColor() {
        return '#1877f2';
    }

    detectFacebookContentType(url) {
        if (url.includes('/reel/') || url.includes('/share/r/')) {
            return 'reel';
        } else if (url.includes('/watch/') || url.includes('/videos/')) {
            return 'video';
        } else if (url.includes('/posts/')) {
            return 'post';
        } else if (url.includes('fb.watch')) {
            return 'watch';
        }
        return 'unknown';
    }

    getFacebookSpecificInfo(videoData, url) {
        const contentType = this.detectFacebookContentType(url);
        
        return {
            contentType,
            isReel: contentType === 'reel',
            isVideo: contentType === 'video',
            hasHD: !!videoData.urls?.hd,
            hasSD: !!videoData.urls?.sd,
            hasAuto: !!videoData.urls?.auto,
            qualityCount: [
                videoData.urls?.hd,
                videoData.urls?.sd,
                videoData.urls?.auto
            ].filter(Boolean).length
        };
    }

    enhanceFacebookDisplay(videoData, container, url) {
        const info = this.getFacebookSpecificInfo(videoData, url);
        
        const contentTypeBadge = document.createElement('div');
        contentTypeBadge.className = 'absolute top-2 left-2 bg-facebook-500/90 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm font-semibold';
        contentTypeBadge.textContent = info.contentType.toUpperCase();
        
        const qualityBadge = document.createElement('div');
        qualityBadge.className = 'absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm';
        qualityBadge.textContent = `${info.qualityCount} Quality${info.qualityCount !== 1 ? 's' : ''}`;
        
        const videoContainer = container?.querySelector('.relative');
        if (videoContainer) {
            videoContainer.appendChild(contentTypeBadge);
            videoContainer.appendChild(qualityBadge);
        }
        
        if (info.isReel) {
            const reelIndicator = document.createElement('div');
            reelIndicator.className = 'absolute bottom-2 left-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm font-bold';
            reelIndicator.innerHTML = '🎬 Reel';
            
            if (videoContainer) {
                videoContainer.appendChild(reelIndicator);
            }
        }
    }

    async downloadFacebookVideo(url, quality) {
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
                throw new Error(errorData.error || 'Facebook download failed');
            }
            
            return response;
            
        } catch (error) {
            console.error('Facebook download error:', error);
            throw error;
        }
    }

    getFacebookAnalysisStatus(videoData) {
        const status = {
            hasVideo: !!(videoData.urls?.hd || videoData.urls?.sd || videoData.urls?.auto),
            hasPreview: !!videoData.urls?.preview,
            hasThumbnail: !!videoData.thumbnail,
            hasInfo: !!(videoData.title && videoData.author),
            multipleQualities: [videoData.urls?.hd, videoData.urls?.sd, videoData.urls?.auto].filter(Boolean).length > 1,
            bestQuality: 'unknown'
        };
        
        if (videoData.urls?.hd) {
            status.bestQuality = 'hd';
        } else if (videoData.urls?.sd) {
            status.bestQuality = 'sd';
        } else if (videoData.urls?.auto) {
            status.bestQuality = 'auto';
        }
        
        return status;
    }

    formatFacebookVideoInfo(videoData, url) {
        const info = this.getFacebookSpecificInfo(videoData, url);
        const analysis = this.getFacebookAnalysisStatus(videoData);
        
        return {
            ...videoData,
            platformInfo: {
                platform: 'facebook',
                contentType: info.contentType,
                isReel: info.isReel,
                qualityAnalysis: analysis,
                availableQualities: info.qualityCount,
                extractionMethod: analysis.hasVideo ? 'success' : 'failed'
            }
        };
    }

    getFacebookErrorSuggestions(error) {
        const suggestions = [];
        
        if (error.includes('private') || error.includes('login')) {
            suggestions.push('The video might be private. Try with a public video.');
            suggestions.push('Make sure the video is accessible without logging in.');
        }
        
        if (error.includes('reel')) {
            suggestions.push('For Facebook Reels, try using the direct reel URL.');
            suggestions.push('Some reels might have restricted download access.');
        }
        
        if (error.includes('video not found') || error.includes('404')) {
            suggestions.push('Check if the video URL is correct and still exists.');
            suggestions.push('The video might have been deleted or moved.');
        }
        
        if (error.includes('geographic') || error.includes('region')) {
            suggestions.push('The video might be geo-restricted in your region.');
        }
        
        if (suggestions.length === 0) {
            suggestions.push('Try refreshing the page and trying again.');
            suggestions.push('Check if the Facebook URL is valid and public.');
        }
        
        return suggestions;
    }

    logFacebookActivity(action, data) {
        console.log(`[Facebook] ${action}:`, {
            timestamp: new Date().toISOString(),
            action,
            data: {
                url: data.url?.substring(0, 50) + '...',
                contentType: this.detectFacebookContentType(data.url || ''),
                quality: data.quality,
                success: data.success,
                error: data.error
            }
        });
    }

    getOptimalFacebookQuality(videoData) {
        if (videoData.urls?.hd) return 'hd';
        if (videoData.urls?.sd) return 'sd';
        if (videoData.urls?.auto) return 'auto';
        return null;
    }

    estimateDownloadSize(quality) {
        const estimates = {
            hd: '50-150 MB',
            sd: '20-80 MB',
            auto: '10-100 MB'
        };
        
        return estimates[quality] || 'Unknown';
    }
}

if (typeof window !== 'undefined') {
    window.FacebookHandler = FacebookHandler;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FacebookHandler;
}