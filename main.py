from flask import Flask, request, jsonify, send_file, render_template
from flask_cors import CORS
import requests
import re
import json
import os
import tempfile
from urllib.parse import urlparse, parse_qs, unquote
from typing import Dict, Optional
import threading
import time
from datetime import datetime
import logging

app = Flask(__name__)
CORS(app)

logging.getLogger("werkzeug").setLevel(logging.WARNING)


class TikTokScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
                "Accept-Encoding": "gzip, deflate",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1",
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "none",
                "Cache-Control": "max-age=0",
            }
        )

    def normalize_url(self, url: str) -> str:
        try:
            if "vm.tiktok.com" in url or "vt.tiktok.com" in url:
                response = self.session.head(url, allow_redirects=True, timeout=10)
                url = response.url

            if "m.tiktok.com" in url:
                url = url.replace("m.tiktok.com", "www.tiktok.com")

            if "?" in url:
                url = url.split("?")[0]

            return url
        except Exception as e:
            print(f"URL normalization error: {e}")
            return url

    def extract_video_id(self, url: str) -> Optional[str]:
        patterns = [
            r"/video/(\d+)",
            r"/v/(\d+)",
            r"tiktok\.com/.*?/video/(\d+)",
            r"tiktok\.com/@[\w.-]+/video/(\d+)",
            r"tiktok\.com/t/(\w+)",
            r"tiktok\.com/@[^/]+/video/(\d+)",
        ]

        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None

    def remove_watermark_from_url(self, url: str) -> str:
        if not url:
            return url

        url = unquote(url)

        watermark_replacements = [
            ("watermark=1", "watermark=0"),
            ("/watermark/", "/nowatermark/"),
            ("wm=1", "wm=0"),
            ("&watermark=1", ""),
            ("?watermark=1", ""),
            ("play_addr", "download_addr"),
            ("playAddr", "downloadAddr"),
            ("/play/", "/download/"),
            ("_watermark", "_nowatermark"),
            ("watermark%3D1", "watermark%3D0"),
            ("&wm=1", ""),
            ("?wm=1", ""),
            ("/play_", "/download_"),
        ]

        clean_url = url
        for old, new in watermark_replacements:
            clean_url = clean_url.replace(old, new)

        if any(
            domain in clean_url
            for domain in ["muscdn.com", "byteoversea.com", "tiktokcdn.com"]
        ):
            try:
                parsed = urlparse(clean_url)
                if parsed.query:
                    query_params = parse_qs(parsed.query)
                    for param in ["watermark", "wm"]:
                        query_params.pop(param, None)

                    if query_params:
                        new_query = "&".join(
                            [f"{k}={v[0]}" for k, v in query_params.items()]
                        )
                        clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}?{new_query}"
                    else:
                        clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
            except:
                pass

        return clean_url

    def get_video_data_from_api(self, video_id: str) -> Optional[Dict]:
        try:
            api_url = "https://api22-normal-c-alisg.tiktokv.com/aweme/v1/feed/"
            params = {
                "aweme_id": video_id,
                "version_name": "26.2.0",
                "version_code": "2018022632",
                "build_number": "26.2.0",
                "manifest_version_code": "2018022632",
                "update_version_code": "2018022632",
                "openudid": "0cf407a766c9c4ad",
                "uuid": "6",
                "region": "US",
                "ts": str(int(time.time())),
                "device_type": "SM-G973F",
                "device_brand": "samsung",
                "device_id": "7318518857994389254",
                "resolution": "900*1600",
                "dpi": "300",
                "os_version": "10",
                "version": "9",
                "app_name": "trill",
                "app_version": "26.2.0",
            }

            headers = {
                "User-Agent": "com.ss.android.ugc.trill/2018022632 (Linux; U; Android 10; en_US; SM-G973F; Build/QP1A.190711.020; Cronet/TTNetVersion:368b3e98 2020-03-26 QuicVersion:0144d358 2020-03-24)",
                "Accept-Encoding": "gzip, deflate",
            }

            response = self.session.get(
                api_url, params=params, headers=headers, timeout=15
            )

            if response.status_code == 200:
                try:
                    data = response.json()
                    if data and "aweme_list" in data and data["aweme_list"]:
                        aweme = data["aweme_list"][0]
                        return self.extract_video_info_from_api(aweme)
                except json.JSONDecodeError:
                    print("API returned invalid JSON")

        except Exception as e:
            print(f"API request failed: {e}")
        return None

    def extract_video_info_from_api(self, aweme: Dict) -> Dict:
        try:
            video = aweme.get("video", {})
            play_addr = video.get("play_addr", {})
            download_addr = video.get("download_addr", {})
            bit_rate = video.get("bit_rate", [])

            watermark_url = None
            no_watermark_url = None
            preview_url = None

            if play_addr.get("url_list"):
                watermark_url = play_addr["url_list"][0]
                preview_url = watermark_url

            if download_addr.get("url_list"):
                no_watermark_url = download_addr["url_list"][0]

            if bit_rate:
                for quality in sorted(
                    bit_rate, key=lambda x: x.get("bit_rate", 0), reverse=True
                ):
                    if quality.get("play_addr", {}).get("url_list"):
                        candidate_url = quality["play_addr"]["url_list"][0]
                        if not no_watermark_url:
                            no_watermark_url = self.remove_watermark_from_url(
                                candidate_url
                            )
                        break

            if not no_watermark_url and watermark_url:
                no_watermark_url = self.remove_watermark_from_url(watermark_url)

            statistics = aweme.get("statistics", {})
            author_info = aweme.get("author", {})
            cover_url = ""

            if video.get("cover", {}).get("url_list"):
                cover_url = video["cover"]["url_list"][0]
            elif video.get("origin_cover", {}).get("url_list"):
                cover_url = video["origin_cover"]["url_list"][0]
            elif video.get("dynamic_cover", {}).get("url_list"):
                cover_url = video["dynamic_cover"]["url_list"][0]

            views = statistics.get("play_count", 0) or statistics.get("view_count", 0)
            likes = statistics.get("digg_count", 0) or statistics.get("like_count", 0)
            shares = statistics.get("share_count", 0) or statistics.get(
                "forward_count", 0
            )

            return {
                "video_url_no_watermark": no_watermark_url,
                "video_url_watermark": watermark_url,
                "video_preview_url": preview_url,
                "title": aweme.get("desc", "TikTok Video"),
                "author": author_info.get("nickname", "Unknown"),
                "duration": video.get("duration", 0),
                "thumbnail": cover_url,
                "views": int(views) if views else 0,
                "likes": int(likes) if likes else 0,
                "shares": int(shares) if shares else 0,
                "width": video.get("width", 0),
                "height": video.get("height", 0),
            }
        except Exception as e:
            print(f"Failed to extract video info from API: {e}")
            return {"error": f"Failed to extract video info: {str(e)}"}

    def scrape_from_web(self, url: str) -> Dict:
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Accept-Encoding": "gzip, deflate",
                "Cache-Control": "no-cache",
                "Pragma": "no-cache",
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "none",
            }

            response = self.session.get(url, headers=headers, timeout=20)
            response.raise_for_status()
            html_content = response.text

            script_patterns = [
                r'<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">(.*?)</script>',
                r'<script id="SIGI_STATE" type="application/json">(.*?)</script>',
                r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
                r"window\.__INITIAL_STATE__\s*=\s*({.*?});",
                r"window\.__DATA__\s*=\s*({.*?});",
                r'window\["SIGI_STATE"\]\s*=\s*({.*?});',
            ]

            for pattern in script_patterns:
                script_match = re.search(pattern, html_content, re.DOTALL)
                if script_match:
                    try:
                        json_data = script_match.group(1)
                        json_data = json_data.replace('\\"', '"').replace("\\/", "/")
                        data = json.loads(json_data)
                        result = self.parse_json_data(data)
                        if result and "error" not in result:
                            return result
                    except Exception as e:
                        print(f"JSON parsing failed: {e}")
                        continue

            video_url_patterns = [
                r'"playAddr":"([^"]+)"',
                r'"downloadAddr":"([^"]+)"',
                r'"play_addr":\s*{\s*"url_list":\s*\[\s*"([^"]+)"',
                r'"download_addr":\s*{\s*"url_list":\s*\[\s*"([^"]+)"',
                r'playAddr["\s]*:\s*["\s]*([^"]+)',
                r'downloadAddr["\s]*:\s*["\s]*([^"]+)',
                r'"playApi":"([^"]+)"',
                r'"downloadApi":"([^"]+)"',
            ]

            for pattern in video_url_patterns:
                match = re.search(pattern, html_content)
                if match:
                    video_url = match.group(1)
                    video_url = (
                        video_url.replace("\\u002F", "/")
                        .replace("\\/", "/")
                        .replace("\\u0026", "&")
                    )
                    video_url = unquote(video_url)

                    title_match = re.search(r'"desc":"([^"]+)"', html_content)
                    author_match = re.search(r'"nickname":"([^"]+)"', html_content)

                    views_patterns = [
                        r'"playCount":(\d+)',
                        r'"play_count":(\d+)',
                        r'"view_count":(\d+)',
                        r'"viewCount":(\d+)',
                    ]

                    likes_patterns = [
                        r'"diggCount":(\d+)',
                        r'"digg_count":(\d+)',
                        r'"like_count":(\d+)',
                        r'"likeCount":(\d+)',
                    ]

                    shares_patterns = [
                        r'"shareCount":(\d+)',
                        r'"share_count":(\d+)',
                        r'"forward_count":(\d+)',
                        r'"forwardCount":(\d+)',
                    ]

                    views = 0
                    likes = 0
                    shares = 0

                    for pattern in views_patterns:
                        match = re.search(pattern, html_content)
                        if match:
                            views = int(match.group(1))
                            break

                    for pattern in likes_patterns:
                        match = re.search(pattern, html_content)
                        if match:
                            likes = int(match.group(1))
                            break

                    for pattern in shares_patterns:
                        match = re.search(pattern, html_content)
                        if match:
                            shares = int(match.group(1))
                            break

                    return {
                        "video_url_no_watermark": self.remove_watermark_from_url(
                            video_url
                        ),
                        "video_url_watermark": video_url,
                        "video_preview_url": video_url,
                        "title": (
                            title_match.group(1) if title_match else "TikTok Video"
                        ),
                        "author": author_match.group(1) if author_match else "Unknown",
                        "duration": 0,
                        "thumbnail": "",
                        "views": views,
                        "likes": likes,
                        "shares": shares,
                        "width": 0,
                        "height": 0,
                    }

            return {"error": "Could not extract video data from webpage"}

        except Exception as e:
            return {"error": f"Web scraping failed: {str(e)}"}

    def parse_json_data(self, data: Dict) -> Optional[Dict]:
        try:
            patterns = [
                lambda d: d["__DEFAULT_SCOPE__"]["webapp.video-detail"]["itemInfo"][
                    "itemStruct"
                ],
                lambda d: d["ItemModule"][
                    next(k for k in d["ItemModule"].keys() if k.isdigit())
                ],
                lambda d: d["props"]["pageProps"]["itemInfo"]["itemStruct"],
            ]

            for pattern in patterns:
                try:
                    video_detail = pattern(data)
                    return self.extract_video_info_from_web(video_detail)
                except (KeyError, TypeError, StopIteration):
                    continue

        except Exception as e:
            print(f"JSON data parsing failed: {e}")
        return None

    def extract_video_info_from_web(self, video_detail: Dict) -> Dict:
        try:
            video = video_detail.get("video", {})
            download_addr = video.get("downloadAddr")
            play_addr = video.get("playAddr")

            watermark_url = play_addr
            no_watermark_url = download_addr
            preview_url = play_addr

            if not no_watermark_url and watermark_url:
                no_watermark_url = self.remove_watermark_from_url(watermark_url)

            stats = video_detail.get("stats", {})
            author_info = video_detail.get("author", {})
            cover_url = (
                video.get("cover", "")
                or video.get("originCover", "")
                or video.get("dynamicCover", "")
            )

            views = (
                stats.get("playCount", 0)
                or stats.get("play_count", 0)
                or stats.get("viewCount", 0)
                or stats.get("view_count", 0)
            )
            likes = (
                stats.get("diggCount", 0)
                or stats.get("digg_count", 0)
                or stats.get("likeCount", 0)
                or stats.get("like_count", 0)
            )
            shares = (
                stats.get("shareCount", 0)
                or stats.get("share_count", 0)
                or stats.get("forwardCount", 0)
                or stats.get("forward_count", 0)
            )

            return {
                "video_url_no_watermark": no_watermark_url,
                "video_url_watermark": watermark_url,
                "video_preview_url": preview_url,
                "title": video_detail.get("desc", "TikTok Video"),
                "author": author_info.get("nickname", "Unknown"),
                "duration": video.get("duration", 0),
                "thumbnail": cover_url,
                "views": int(views) if views else 0,
                "likes": int(likes) if likes else 0,
                "shares": int(shares) if shares else 0,
                "width": video.get("width", 0),
                "height": video.get("height", 0),
            }
        except Exception as e:
            return {"error": f"Failed to extract video info from web: {str(e)}"}

    def get_video_data(self, url: str) -> Dict:
        try:
            print(f"Processing URL: {url}")

            normalized_url = self.normalize_url(url)
            print(f"Normalized URL: {normalized_url}")

            video_id = self.extract_video_id(normalized_url)
            if not video_id:
                return {
                    "error": "Could not extract video ID from URL. Please check the URL format."
                }

            print(f"Video ID: {video_id}")

            api_result = self.get_video_data_from_api(video_id)
            if api_result and "error" not in api_result:
                if api_result.get("video_url_no_watermark") or api_result.get(
                    "video_url_watermark"
                ):
                    api_result["video_id"] = video_id
                    print("Successfully extracted from API")
                    return api_result

            print("API failed, trying web scraping...")

            web_result = self.scrape_from_web(normalized_url)
            if "error" not in web_result:
                web_result["video_id"] = video_id
                print("Successfully extracted from web scraping")
                return web_result

            return web_result

        except Exception as e:
            error_msg = f"Failed to get video data: {str(e)}"
            print(error_msg)
            return {"error": error_msg}


scraper = TikTokScraper()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/video-info", methods=["POST"])
def get_video_info():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        url = data.get("url", "").strip()

        if not url:
            return jsonify({"error": "URL is required"}), 400

        if "tiktok.com" not in url:
            return jsonify({"error": "Invalid TikTok URL"}), 400

        print(f"Analyzing URL: {url}")

        video_data = scraper.get_video_data(url)

        if "error" in video_data:
            print(f"Error: {video_data['error']}")
            return jsonify(video_data), 400

        response_data = {
            "success": True,
            "data": {
                "title": video_data.get("title", "TikTok Video"),
                "author": video_data.get("author", "Unknown"),
                "duration": video_data.get("duration", 0),
                "thumbnail": video_data.get("thumbnail", ""),
                "video_id": video_data.get("video_id", ""),
                "views": video_data.get("views", 0),
                "likes": video_data.get("likes", 0),
                "shares": video_data.get("shares", 0),
                "width": video_data.get("width", 0),
                "height": video_data.get("height", 0),
                "urls": {
                    "no_watermark": video_data.get("video_url_no_watermark"),
                    "watermark": video_data.get("video_url_watermark"),
                    "preview": video_data.get("video_preview_url"),
                },
                "available_formats": {
                    "no_watermark": bool(video_data.get("video_url_no_watermark")),
                    "watermark": bool(video_data.get("video_url_watermark")),
                },
            },
        }

        print("Successfully processed video info")
        return jsonify(response_data)

    except Exception as e:
        error_msg = f"Internal server error: {str(e)}"
        print(error_msg)
        return jsonify({"error": error_msg}), 500


@app.route("/api/download", methods=["POST"])
def download_video():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        url = data.get("url", "").strip()
        no_watermark = data.get("no_watermark", True)

        if not url:
            return jsonify({"error": "URL is required"}), 400

        print(f"Downloading video from: {url}, no_watermark: {no_watermark}")

        video_data = scraper.get_video_data(url)

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

        print(f"Downloading from URL: {video_url}")

        headers = {
            "User-Agent": scraper.session.headers["User-Agent"],
            "Referer": "https://www.tiktok.com/",
            "Accept": "video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5",
        }

        video_response = scraper.session.get(
            video_url, stream=True, headers=headers, timeout=60
        )
        video_response.raise_for_status()

        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")

        for chunk in video_response.iter_content(chunk_size=8192):
            if chunk:
                temp_file.write(chunk)

        temp_file.close()

        video_id = video_data.get("video_id", "unknown")
        watermark_suffix = "_no_watermark" if no_watermark else "_watermark"
        filename = f"tiktok_{video_id}{watermark_suffix}.mp4"

        def remove_file():
            time.sleep(300)
            try:
                os.unlink(temp_file.name)
                print(f"Cleaned up temporary file: {temp_file.name}")
            except:
                pass

        threading.Thread(target=remove_file, daemon=True).start()

        print(f"Download successful: {filename}")

        return send_file(
            temp_file.name,
            as_attachment=True,
            download_name=filename,
            mimetype="video/mp4",
        )

    except Exception as e:
        error_msg = f"Download failed: {str(e)}"
        print(error_msg)
        return jsonify({"error": error_msg}), 500


@app.route("/api/proxy-video", methods=["POST"])
def proxy_video():
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

        response = scraper.session.get(
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
    return jsonify(
        {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "version": "2.0.0",
        }
    )


if __name__ == "__main__":
    print("🚀 TikTok Downloader Server Starting...")
    print("📁 Make sure you have the following structure:")
    print("   ├── main.py")
    print("   ├── templates/")
    print("   │   └── index.html")
    print("   └── static/")
    print("       ├── styles.css")
    print("       └── main.js")
    print("\n🌐 Server will be available at: http://localhost:5000")
    print("🔧 Debug mode: ON")

    app.run(debug=True, host="0.0.0.0", port=5000)
