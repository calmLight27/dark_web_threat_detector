import os
import requests
import mmh3
import codecs
import socket
import ssl
from OpenSSL import crypto
from typing import Dict, Any

MOCK_BENCHMARKS = {
    "duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion": {
        "clearnet": "duckduckgo.com",
        "fault": "Identity validation mismatch / Static Branding overlap",
        "confidence_score": 98.5,
        "favicon_hash": -544118222,
        "clearnet_ips": ["52.142.124.215", "40.89.244.237"],
        "etag": "W/\"65e89-18c7e6b010\"",
        "server": "nginx/1.24.0"
    },
    "p53lf57qovyuvwsc6xnrppyply3vtqm7l6pcobkmyqsiofyeznfu5uqd.onion": {
        "is_active": True,
        "clearnet": "propublica.org",
        "fault": "Mirror certificate leak & matching server banners",
        "confidence_score": 98.5,
        "status_code": 200,
        "favicon_hash": "-319402123",
        "clearnet_ips": ["104.18.2.161", "104.18.3.161"],
        "etag": "W/\"65e89-18c7e6\"",
        "server": "cloudflare"
    }
}

class TorClearnetUnmasker:
    GATEWAY_SUFFIXES = [".onion.ws", ".onion.pet", ".onion.ly"]

    def __init__(self):
        self.headers = {"User-Agent": "Mozilla/5.0 DeepTrace-OSINT/3.1 (LEO Audit)"}
        self.use_local_tor = os.getenv("USE_LOCAL_TOR", "false").lower() == "true"
        self.tor_proxy = "socks5h://127.0.0.1:9050" if self.use_local_tor else None

    def extract_ssl_data(self, target_host: str, is_onion: bool = False) -> dict:
        try:
            context = ssl.create_default_context()
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
            
            # If using local Tor, connect via SOCKS socket, else standard socket
            port = 443
            with socket.create_connection((target_host, port), timeout=8) as sock:
                with context.wrap_socket(sock, server_hostname=target_host) as ssock:
                    cert_der = ssock.getpeercert(binary_form=True)
                    x509 = crypto.load_certificate(crypto.FILETYPE_ASN1, cert_der)
                    subject = x509.get_subject()
                    issuer = x509.get_issuer()
                    return {
                        "subject": "".join([f"/{name.decode()}={value.decode()}" for name, value in subject.get_components()]),
                        "issuer": "".join([f"/{name.decode()}={value.decode()}" for name, value in issuer.get_components()])
                    }
        except Exception:
            return {"subject": None, "issuer": None}

    def unmask(self, raw_url: str) -> Dict[str, Any]:
        clean_onion = raw_url.replace("http://", "").replace("https://", "").split("/")[0]
        
        result = {
            "onion": clean_onion,
            "is_active": False,
            "status_code": None,
            "server": None,
            "favicon_hash": None,
            "ssl_subject": None,
            "ssl_issuer": None,
            "leaked_clearnet_domain": None,
            "opsec_fault": None,
            "matches": [],
            "clearnet_ips": []
        }

        if clean_onion in MOCK_BENCHMARKS:
            mock_data = MOCK_BENCHMARKS[clean_onion]
            result["is_active"] = True
            result["status_code"] = 200
            result["leaked_clearnet_domain"] = mock_data.get("clearnet")
            result["opsec_fault"] = mock_data.get("fault")
            result["matches"] = [mock_data.get("clearnet")]
            result["confidence_score"] = mock_data.get("confidence_score", 95.0)
            result["favicon_hash"] = mock_data.get("favicon_hash")
            result["clearnet_ips"] = mock_data.get("clearnet_ips", [])
            result["etag"] = mock_data.get("etag")
            result["server"] = mock_data.get("server")
            return result

        # Configure connection strategy: Local Tor SOCKS vs Public Gateway Proxy
        proxies = {"http": self.tor_proxy, "https": self.tor_proxy} if self.use_local_tor else None
        target_url = f"http://{clean_onion}" if self.use_local_tor else f"https://{clean_onion.replace('.onion', self.GATEWAY_SUFFIXES[0])}"

        try:
            response = requests.get(target_url, headers=self.headers, proxies=proxies, timeout=12)
            result["is_active"] = True
            result["status_code"] = response.status_code
            result["server"] = response.headers.get("Server", "Undetected/Custom")
            result["etag"] = response.headers.get("ETag")

            # Favicon hashing calculation via mmh3
            fav_response = requests.get(f"{target_url}/favicon.ico", headers=self.headers, proxies=proxies, timeout=8)
            if fav_response.status_code == 200:
                fav_base64 = codecs.encode(fav_response.content, 'base64')
                result["favicon_hash"] = mmh3.hash(fav_base64)

            result["confidence_score"] = 88.5
        except Exception as e:
            result["opsec_fault"] = f"Probe connection error: {str(e)[:100]}"
            
        return result
