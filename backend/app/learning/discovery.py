"""Bounded discovery from administrator-approved public HTTPS sources."""

from dataclasses import dataclass
from datetime import date, datetime, timezone
from hashlib import sha256
from html.parser import HTMLParser
import ipaddress
import socket
from urllib.parse import urljoin, urlsplit
from urllib.robotparser import RobotFileParser
from xml.etree import ElementTree

import requests
from sqlalchemy import select

from .models import LearningCourse, LearningDiscoverySource

USER_AGENT = "PulseEPIS-CourseDiscovery/1.0 (+institutional-catalog)"
MAX_BYTES = 1_000_000


@dataclass(frozen=True)
class FoundCourse:
    title: str
    url: str


def public_https(url: str) -> str:
    parsed = urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.port not in (None, 443):
        raise ValueError("Se requiere una URL HTTPS pública sin credenciales")
    for result in socket.getaddrinfo(parsed.hostname, 443, type=socket.SOCK_STREAM):
        address = ipaddress.ip_address(result[4][0])
        if not address.is_global:
            raise ValueError("La fuente no puede apuntar a una dirección privada")
    return url


def fetch(url: str, allowed_host: str | None = None, redirects: int = 0) -> tuple[int, bytes]:
    if redirects > 3:
        raise ValueError("La fuente redirige demasiadas veces")
    public_https(url)
    host = urlsplit(url).hostname
    if allowed_host and host != allowed_host:
        raise ValueError("La redirección salió del dominio autorizado")
    with requests.get(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/rss+xml,application/atom+xml,application/xml"}, timeout=(5, 12), allow_redirects=False, stream=True) as response:
        if response.is_redirect:
            destination = urljoin(url, response.headers.get("Location", ""))
            public_https(destination)
            if urlsplit(destination).hostname != host:
                raise ValueError("La fuente redirige fuera de su dominio")
            return fetch(destination, allowed_host=host, redirects=redirects + 1)
        payload = response.raw.read(MAX_BYTES + 1)
        if len(payload) > MAX_BYTES:
            raise ValueError("La fuente supera el límite de tamaño")
        return response.status_code, payload


class LinkParser(HTMLParser):
    def __init__(self, base_url: str):
        super().__init__()
        self.base_url = base_url
        self.items: list[FoundCourse] = []
        self.href: str | None = None
        self.title_parts: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.href = dict(attrs).get("href")
            self.title_parts = []

    def handle_data(self, data):
        if self.href:
            self.title_parts.append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self.href:
            url = urljoin(self.base_url, self.href)
            title = " ".join(" ".join(self.title_parts).split())
            if title and urlsplit(url).hostname == urlsplit(self.base_url).hostname and urlsplit(url).scheme == "https":
                self.items.append(FoundCourse(title[:200], url.split("#", 1)[0]))
            self.href = None


def extract(content: bytes, kind: str, base_url: str) -> list[FoundCourse]:
    if kind == "HTML_LINKS":
        parser = LinkParser(base_url)
        parser.feed(content.decode("utf-8", errors="replace"))
        items = parser.items
    elif kind == "RSS":
        root = ElementTree.fromstring(content)
        items = []
        for entry in root.findall(".//item") + root.findall(".//{*}entry"):
            title = (entry.findtext("title") or entry.findtext("{*}title") or "").strip()
            link = entry.findtext("link") or entry.findtext("{*}link") or ""
            if not link:
                link_element = entry.find("{*}link")
                link = link_element.attrib.get("href", "") if link_element is not None else ""
            url = urljoin(base_url, link)
            if title and urlsplit(url).scheme == "https" and urlsplit(url).hostname == urlsplit(base_url).hostname:
                items.append(FoundCourse(title[:200], url.split("#", 1)[0]))
    else:
        raise ValueError("Tipo de fuente no disponible")
    return list({item.url: item for item in items}.values())


def scan(session, source: LearningDiscoverySource) -> dict:
    host = urlsplit(public_https(source.url)).hostname
    robots_url = f"https://{host}/robots.txt"
    robots_status, robots_content = fetch(robots_url, host)
    if robots_status == 200:
        parser = RobotFileParser(robots_url)
        parser.parse(robots_content.decode("utf-8", errors="replace").splitlines())
        if not parser.can_fetch(USER_AGENT, source.url):
            raise ValueError("robots.txt no permite consultar esta fuente")
    elif robots_status not in (404, 410):
        raise ValueError("No se pudo comprobar robots.txt")
    status, content = fetch(source.url, host)
    if status != 200:
        raise ValueError(f"La fuente respondió HTTP {status}")
    found = extract(content, source.kind, source.url)
    now = datetime.now(timezone.utc)
    created = 0
    updated = 0
    for item in found:
        fingerprint = sha256(f"{item.title}\n{item.url}".encode()).hexdigest()
        existing = session.scalar(select(LearningCourse).where(LearningCourse.source_url == item.url))
        if existing is None:
            session.add(LearningCourse(title=item.title, provider=source.name, source_url=item.url, discovery_source_id=source.id, content_hash=fingerprint, first_seen_at=now, last_seen_at=now, checked_on=date.today(), requirements=[], skills=["Por revisar"], status="DETECTED"))
            created += 1
        else:
            existing.last_seen_at = now
            if existing.content_hash != fingerprint:
                existing.content_hash = fingerprint
                if existing.status in {"DETECTED", "IN_REVIEW"}:
                    existing.title = item.title
                updated += 1
    source.last_checked_at = now
    source.last_error = None
    return {"detected": created, "updated": updated, "scanned": len(found)}
