import re
from typing import List, Optional, Dict
from dataclasses import dataclass


@dataclass
class DetectedPixelItem:
    category: str  # "pixel"
    name: str      # "Meta Pixel", "TikTok Pixel", "LinkedIn Insight Tag", "Pinterest Tag", "Snapchat Pixel", "Reddit Pixel"
    status: str    # "Detected", "Not detected"
    identifier: Optional[str]
    confidence: float
    evidence: str
    source_url: str
    server_side_note: Optional[str] = None


META_PIXEL_ID_REGEX = re.compile(r"fbq\s*\(\s*['\"]init['\"]\s*,\s*['\"](\d{10,20})['\"]", re.I)
TIKTOK_PIXEL_ID_REGEX = re.compile(r"ttq\.load\s*\(\s*['\"]([A-Z0-9]+)['\"]", re.I)
LINKEDIN_PARTNER_REGEX = re.compile(r"_linkedin_partner_id\s*=\s*['\"]?(\d+)['\"]?", re.I)
PINTEREST_TAG_REGEX = re.compile(r"pintrk\s*\(\s*['\"]load['\"]\s*,\s*['\"]([0-9a-zA-Z]+)['\"]", re.I)


class SocialPixelDetector:
    """Detect advertising pixels across Meta, TikTok, LinkedIn, Pinterest, Snapchat, Reddit."""

    def detect(self, pages: List[dict]) -> List[DetectedPixelItem]:
        pixels: List[DetectedPixelItem] = []
        found: Dict[str, DetectedPixelItem] = {}

        for page in pages:
            url = page.get("url", "")
            html = page.get("html", "")
            network_reqs = page.get("network_requests", [])
            full_context = html + " " + " ".join(network_reqs)

            if not full_context.strip():
                continue

            # 1. Meta Pixel
            if "Meta Pixel" not in found:
                fb_id_match = META_PIXEL_ID_REGEX.search(full_context)
                has_fb_script = "connect.facebook.net" in full_context or "fbevents.js" in full_context or "facebook.com/tr" in full_context

                if fb_id_match or has_fb_script:
                    pixel_id = fb_id_match.group(1) if fb_id_match else None
                    found["Meta Pixel"] = DetectedPixelItem(
                        category="pixel",
                        name="Meta Pixel",
                        status="Detected",
                        identifier=pixel_id,
                        confidence=1.0 if pixel_id else 0.9,
                        evidence=f"Meta Pixel initialized (ID: {pixel_id or 'Script observed'})",
                        source_url=url,
                        server_side_note="Server-side Meta CAPI cannot be confirmed from browser-side inspection."
                    )

            # 2. TikTok Pixel
            if "TikTok Pixel" not in found:
                tt_match = TIKTOK_PIXEL_ID_REGEX.search(full_context)
                if tt_match or "analytics.tiktok.com" in full_context:
                    tt_id = tt_match.group(1) if tt_match else None
                    found["TikTok Pixel"] = DetectedPixelItem(
                        category="pixel",
                        name="TikTok Pixel",
                        status="Detected",
                        identifier=tt_id,
                        confidence=1.0 if tt_id else 0.85,
                        evidence=f"TikTok Pixel events loader detected (ID: {tt_id or 'Observed'})",
                        source_url=url
                    )

            # 3. LinkedIn Insight Tag
            if "LinkedIn Insight Tag" not in found:
                li_match = LINKEDIN_PARTNER_REGEX.search(full_context)
                if li_match or "snap.licdn.com/li.lms-analytics" in full_context:
                    li_id = li_match.group(1) if li_match else None
                    found["LinkedIn Insight Tag"] = DetectedPixelItem(
                        category="pixel",
                        name="LinkedIn Insight Tag",
                        status="Detected",
                        identifier=li_id,
                        confidence=1.0 if li_id else 0.85,
                        evidence=f"LinkedIn partner tag detected (ID: {li_id or 'Observed'})",
                        source_url=url
                    )

            # 4. Pinterest Tag
            if "Pinterest Tag" not in found:
                pin_match = PINTEREST_TAG_REGEX.search(full_context)
                if pin_match or "ct.pinterest.com" in full_context:
                    pin_id = pin_match.group(1) if pin_match else None
                    found["Pinterest Tag"] = DetectedPixelItem(
                        category="pixel",
                        name="Pinterest Tag",
                        status="Detected",
                        identifier=pin_id,
                        confidence=1.0 if pin_id else 0.85,
                        evidence="Pinterest conversion tag script detected",
                        source_url=url
                    )

            # 5. Snapchat Pixel
            if "Snapchat Pixel" not in found:
                if "sc-static.net/scevent.min.js" in full_context or "snaptr(" in full_context:
                    found["Snapchat Pixel"] = DetectedPixelItem(
                        category="pixel",
                        name="Snapchat Pixel",
                        status="Detected",
                        identifier=None,
                        confidence=0.9,
                        evidence="Snapchat snaptr pixel script detected",
                        source_url=url
                    )

            # 6. Reddit Pixel
            if "Reddit Pixel" not in found:
                if "alb.reddit.com" in full_context or "rdt('init'" in full_context:
                    found["Reddit Pixel"] = DetectedPixelItem(
                        category="pixel",
                        name="Reddit Pixel",
                        status="Detected",
                        identifier=None,
                        confidence=0.9,
                        evidence="Reddit conversion pixel detected",
                        source_url=url
                    )

            # 7. Microsoft Advertising (Bing Ads UET)
            if "Microsoft Ads" not in found:
                if "bat.bing.com/bat.js" in full_context or "uetq" in full_context:
                    found["Microsoft Ads"] = DetectedPixelItem(
                        category="pixel",
                        name="Microsoft Ads",
                        status="Detected",
                        identifier=None,
                        confidence=0.9,
                        evidence="Microsoft Advertising (Bing) UET tracking tag detected",
                        source_url=url
                    )

            # 8. Twitter / X Ads
            if "Twitter / X Ads" not in found:
                if "static.ads-twitter.com/uwt.js" in full_context or "twq(" in full_context or "ads-twitter.com" in full_context:
                    found["Twitter / X Ads"] = DetectedPixelItem(
                        category="pixel",
                        name="Twitter / X Ads",
                        status="Detected",
                        identifier=None,
                        confidence=0.9,
                        evidence="Twitter / X conversion tracking pixel detected",
                        source_url=url
                    )

            # 9. Criteo Retargeting
            if "Criteo" not in found:
                if "static.criteo.net/js/ld/ld.js" in full_context or "criteo_q" in full_context:
                    found["Criteo"] = DetectedPixelItem(
                        category="pixel",
                        name="Criteo",
                        status="Detected",
                        identifier=None,
                        confidence=0.9,
                        evidence="Criteo dynamic retargeting tag detected",
                        source_url=url
                    )

            # 10. Taboola Pixel
            if "Taboola" not in found:
                if "cdn.taboola.com/libtrc" in full_context or "_tfa.push" in full_context:
                    found["Taboola"] = DetectedPixelItem(
                        category="pixel",
                        name="Taboola",
                        status="Detected",
                        identifier=None,
                        confidence=0.9,
                        evidence="Taboola native advertising pixel detected",
                        source_url=url
                    )

            # 11. Outbrain Amplify
            if "Outbrain" not in found:
                if "widgets.outbrain.com/outbrain.js" in full_context or "obApi(" in full_context:
                    found["Outbrain"] = DetectedPixelItem(
                        category="pixel",
                        name="Outbrain",
                        status="Detected",
                        identifier=None,
                        confidence=0.9,
                        evidence="Outbrain Amplify tracking script detected",
                        source_url=url
                    )

            # 12. AdRoll Retargeting
            if "AdRoll" not in found:
                if "s.adroll.com/j/roundtrip.js" in full_context or "__adroll" in full_context:
                    found["AdRoll"] = DetectedPixelItem(
                        category="pixel",
                        name="AdRoll",
                        status="Detected",
                        identifier=None,
                        confidence=0.9,
                        evidence="AdRoll retargeting pixel detected",
                        source_url=url
                    )

        return list(found.values())
