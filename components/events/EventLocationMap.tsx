/**
 * EventLocationMap Component
 * 이벤트 위치 표시 — 장소명·주소 + 임베드 지도 + 길찾기/큰 지도 링크
 *
 * 서버 컴포넌트(iframe 렌더링뿐이라 클라이언트 JS 불필요).
 * 지도 제공자는 lib/maps 추상화 뒤에 있어 교체해도 이 컴포넌트는 그대로다.
 * 좌표가 없으면 지도 없이 장소명·수동 링크만 표시(기존 동작 폴백).
 * 라벨은 ReactNode — 공개 페이지는 IntlObject(ko/en), 관리자 페이지는 한국어 문자열.
 */

import type { ReactNode } from 'react';
import { getMapsProvider } from '@/lib/maps';

interface EventLocationMapProps {
  location: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  /** 수동 지도/길찾기 링크 — 있으면 자동 생성 링크보다 우선 */
  locationUrl: string | null;
  directionsLabel: ReactNode;
  largerMapLabel: ReactNode;
}

export default function EventLocationMap({
  location,
  address,
  lat,
  lng,
  locationUrl,
  directionsLabel,
  largerMapLabel,
}: EventLocationMapProps) {
  const provider = getMapsProvider();
  const hasCoords = lat !== null && lng !== null;

  if (!hasCoords && !location && !address && !locationUrl) return null;

  const directionsHref = locationUrl || (hasCoords ? provider.directionsUrl(lat, lng, location) : null);

  return (
    <div className="event-location">
      {(location || address) && (
        <p className="event-location-place">
          {location && <strong className="event-location-name">{location}</strong>}
          {address && <span className="event-location-address">{address}</span>}
        </p>
      )}

      {hasCoords && (
        <div className="event-location-map-wrap">
          <iframe
            className="event-location-map"
            src={provider.embedUrl(lat, lng)}
            title={location || address || 'map'}
            loading="lazy"
          />
          <a
            className="event-location-attribution"
            href={provider.attribution.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {provider.attribution.text}
          </a>
        </div>
      )}

      <div className="event-location-actions">
        {directionsHref && (
          <a
            className="gallery-cal-btn gallery-cal-btn--primary"
            href={directionsHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span aria-hidden="true">📍</span>
            {directionsLabel}
          </a>
        )}
        {hasCoords && (
          <a
            className="gallery-cal-btn"
            href={provider.externalMapUrl(lat, lng)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {largerMapLabel}
          </a>
        )}
      </div>
    </div>
  );
}
