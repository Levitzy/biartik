import requests
import re
import json
import time
import tempfile
import threading
import os
from urllib.parse import urlparse, parse_qs, unquote
from typing import Dict, Optional


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

    def format_duration(self, duration_ms: int) -> str:
        if not duration_ms or duration_ms <= 0:
            return "0:00"

        total_seconds = duration_ms // 1000
        minutes = total_seconds // 60
        seconds = total_seconds % 60

        return f"{minutes}:{seconds:02d}"

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

            duration = video.get("duration", 0)
            formatted_duration = self.format_duration(duration)

            return {
                "video_url_no_watermark": no_watermark_url,
                "video_url_watermark": watermark_url,
                "video_preview_url": preview_url,
                "title": aweme.get("desc", "TikTok Video"),
                "author": author_info.get("nickname", "Unknown"),
                "duration": formatted_duration,
                "thumbnail": cover_url,
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
                        "duration": "0:00",
                        "thumbnail": "",
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

            author_info = video_detail.get("author", {})
            cover_url = (
                video.get("cover", "")
                or video.get("originCover", "")
                or video.get("dynamicCover", "")
            )

            duration = video.get("duration", 0)
            formatted_duration = self.format_duration(duration)

            return {
                "video_url_no_watermark": no_watermark_url,
                "video_url_watermark": watermark_url,
                "video_preview_url": preview_url,
                "title": video_detail.get("desc", "TikTok Video"),
                "author": author_info.get("nickname", "Unknown"),
                "duration": formatted_duration,
                "thumbnail": cover_url,
                "width": video.get("width", 0),
                "height": video.get("height", 0),
            }
        except Exception as e:
            return {"error": f"Failed to extract video info from web: {str(e)}"}

    def get_video_data(self, url: str) -> Dict:
        try:
            print(f"Processing TikTok URL: {url}")

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
                    print("Successfully extracted from TikTok API")
                    return api_result

            print("TikTok API failed, trying web scraping...")

            web_result = self.scrape_from_web(normalized_url)
            if "error" not in web_result:
                web_result["video_id"] = video_id
                print("Successfully extracted from TikTok web scraping")
                return web_result

            return web_result

        except Exception as e:
            error_msg = f"Failed to get TikTok video data: {str(e)}"
            print(error_msg)
            return {"error": error_msg}

    def download_video_file(self, video_url, no_watermark=True):
        try:
            headers = {
                "User-Agent": self.session.headers["User-Agent"],
                "Referer": "https://www.tiktok.com/",
                "Accept": "video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5",
            }

            video_response = self.session.get(
                video_url, stream=True, headers=headers, timeout=60
            )
            video_response.raise_for_status()

            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")

            for chunk in video_response.iter_content(chunk_size=8192):
                if chunk:
                    temp_file.write(chunk)

            temp_file.close()

            def remove_file():
                time.sleep(300)
                try:
                    os.unlink(temp_file.name)
                except:
                    pass

            threading.Thread(target=remove_file, daemon=True).start()

            return temp_file.name

        except Exception as e:
            print(f"TikTok download failed: {e}")
            return None
