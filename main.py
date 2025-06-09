from flask import Flask, request, jsonify, send_file, render_template
from flask_cors import CORS
import os
import time
import threading
from datetime import datetime
import logging

from tiktokscrape import TikTokScraper
from fbvideo import FacebookVideoDownloader

app = Flask(__name__)
CORS(app)

logging.getLogger("werkzeug").setLevel(logging.WARNING)


def detect_platform(url):
    """Detect the platform based on URL"""
    if "tiktok.com" in url:
        return "tiktok"
    elif "facebook.com" in url or "fb.watch" in url:
        return "facebook"
    else:
        return "unknown"


def cleanup_temp_file(file_path, delay=300):
    """Clean up temporary file after delay"""

    def remove_file():
        time.sleep(delay)
        try:
            os.unlink(file_path)
            print(f"Cleaned up temporary file: {file_path}")
        except:
            pass

    threading.Thread(target=remove_file, daemon=True).start()


tiktok_scraper = TikTokScraper()
facebook_scraper = FacebookVideoDownloader()


@app.route("/")
def index():
    """Serve the main page"""
    return render_template("index.html")


@app.route("/api/video-info", methods=["POST"])
def get_video_info():
    """Get video information from TikTok or Facebook URL"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        url = data.get("url", "").strip()

        if not url:
            return jsonify({"error": "URL is required"}), 400

        platform = detect_platform(url)

        if platform == "unknown":
            return (
                jsonify(
                    {
                        "error": "Unsupported platform. Please use TikTok or Facebook URLs"
                    }
                ),
                400,
            )

        print(f"Analyzing {platform.upper()} URL: {url}")

        if platform == "tiktok":
            video_data = tiktok_scraper.get_video_data(url)
        elif platform == "facebook":
            video_data = facebook_scraper.get_video_data(url)

        if "error" in video_data:
            print(f"Error: {video_data['error']}")
            return jsonify(video_data), 400

        response_data = {
            "success": True,
            "platform": platform,
            "data": format_video_response(video_data, platform),
        }

        print("Successfully processed video info")
        return jsonify(response_data)

    except Exception as e:
        error_msg = f"Internal server error: {str(e)}"
        print(error_msg)
        return jsonify({"error": error_msg}), 500


def format_video_response(video_data, platform):
    """Format video data response based on platform"""
    base_data = {
        "title": video_data.get("title", f"{platform.capitalize()} Video"),
        "author": video_data.get("author", "Unknown"),
        "duration": video_data.get("duration", "0:00"),
        "thumbnail": video_data.get("thumbnail", ""),
        "video_id": video_data.get("video_id", ""),
        "width": video_data.get("width", 0),
        "height": video_data.get("height", 0),
    }

    if platform == "tiktok":
        base_data.update(
            {
                "urls": {
                    "no_watermark": video_data.get("video_url_no_watermark"),
                    "watermark": video_data.get("video_url_watermark"),
                    "preview": video_data.get("video_preview_url"),
                },
                "available_formats": {
                    "no_watermark": bool(video_data.get("video_url_no_watermark")),
                    "watermark": bool(video_data.get("video_url_watermark")),
                },
            }
        )
    elif platform == "facebook":
        base_data.update(
            {
                "urls": {
                    "hd": video_data.get("video_url_hd"),
                    "sd": video_data.get("video_url_sd"),
                    "auto": video_data.get("video_url_auto"),
                    "preview": video_data.get("video_url_auto"),
                },
                "available_formats": {
                    "hd": bool(video_data.get("video_url_hd")),
                    "sd": bool(video_data.get("video_url_sd")),
                    "auto": bool(video_data.get("video_url_auto")),
                },
            }
        )

    return base_data


@app.route("/api/download", methods=["POST"])
def download_video():
    """Download video with specified quality"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        url = data.get("url", "").strip()
        quality = data.get("quality", "auto")

        if not url:
            return jsonify({"error": "URL is required"}), 400

        platform = detect_platform(url)

        if platform == "unknown":
            return jsonify({"error": "Unsupported platform"}), 400

        print(f"Downloading {platform} video from: {url}, quality: {quality}")

        if platform == "tiktok":
            return handle_tiktok_download(url, quality)
        elif platform == "facebook":
            return handle_facebook_download(url, quality)

    except Exception as e:
        error_msg = f"Download failed: {str(e)}"
        print(error_msg)
        return jsonify({"error": error_msg}), 500


def handle_tiktok_download(url, quality):
    """Handle TikTok video download"""
    no_watermark = quality == "no_watermark"
    video_data = tiktok_scraper.get_video_data(url)

    if "error" in video_data:
        return jsonify(video_data), 400

    video_url = None
    if no_watermark:
        video_url = video_data.get("video_url_no_watermark")
    else:
        video_url = video_data.get("video_url_watermark")

    if not video_url:
        return (
            jsonify(
                {
                    "error": f'Video URL not available for {"no watermark" if no_watermark else "watermark"} format'
                }
            ),
            400,
        )

    temp_file_path = tiktok_scraper.download_video_file(video_url, no_watermark)
    if not temp_file_path:
        return jsonify({"error": "Failed to download video"}), 500

    video_id = video_data.get("video_id", "unknown")
    watermark_suffix = "_no_watermark" if no_watermark else "_watermark"
    filename = f"tiktok_{video_id}{watermark_suffix}.mp4"

    cleanup_temp_file(temp_file_path)

    return send_file(
        temp_file_path,
        as_attachment=True,
        download_name=filename,
        mimetype="video/mp4",
    )


def handle_facebook_download(url, quality):
    """Handle Facebook video download"""
    video_data = facebook_scraper.get_video_data(url)

    if "error" in video_data:
        return jsonify(video_data), 400

    video_url = None
    if quality == "hd" and video_data.get("video_url_hd"):
        video_url = video_data.get("video_url_hd")
    elif quality == "sd" and video_data.get("video_url_sd"):
        video_url = video_data.get("video_url_sd")
    else:
        video_url = video_data.get("video_url_auto")

    if not video_url:
        return jsonify({"error": f"Video URL not available for {quality} quality"}), 400

    temp_file_path = facebook_scraper.download_video_file(video_url, None)
    if not temp_file_path:
        return jsonify({"error": "Failed to download video"}), 500

    video_id = video_data.get("video_id", "unknown")
    filename = f"facebook_{video_id}_{quality}.mp4"

    cleanup_temp_file(temp_file_path)

    return send_file(
        temp_file_path,
        as_attachment=True,
        download_name=filename,
        mimetype="video/mp4",
    )


@app.route("/api/proxy-video", methods=["POST"])
def proxy_video():
    """Proxy video for preview"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        video_url = data.get("url", "").strip()
        if not video_url:
            return jsonify({"error": "URL is required"}), 400

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://www.tiktok.com/",
            "Accept": "video/webm,video/ogg,video/*;q=0.9,*/*;q=0.5",
        }

        response = tiktok_scraper.session.get(
            video_url, headers=headers, stream=True, timeout=30
        )
        response.raise_for_status()

        return send_file(
            response.raw,
            mimetype="video/mp4",
            as_attachment=False,
            download_name="preview.mp4",
        )

    except Exception as e:
        return jsonify({"error": f"Proxy failed: {str(e)}"}), 500


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify(
        {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "version": "3.0.0",
            "supported_platforms": ["tiktok", "facebook"],
            "modules": {"tiktok_scraper": "active", "facebook_scraper": "active"},
        }
    )


@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500


app_handler = app

if __name__ == "__main__":
    print("🚀 Multi-Platform Video Downloader Server Starting...")
    print("📁 Project Structure:")
    print("   ├── main.py (Main Flask Application)")
    print("   ├── tiktokscrape.py (TikTok Scraper Module)")
    print("   ├── fbvideo.py (Facebook Scraper Module)")
    print("   ├── templates/")
    print("   │   └── index.html")
    print("   └── static/")
    print("       ├── styles.css")
    print("       ├── main.js")
    print("       ├── tiktok.js")
    print("       └── facebook.js")
    print("\n🌐 Server will be available at: http://localhost:5000")
    print("🔧 Debug mode: ON")
    print("✨ Supported platforms: TikTok, Facebook")
    print("📦 Modular architecture with separated scrapers")

    app.run(debug=True, host="0.0.0.0", port=5000)
