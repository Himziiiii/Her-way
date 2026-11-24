// src/components/map/ReportMarkersLayer.jsx
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

function createReportIcon(sentiment) {
  const palette = {
    positive: { bg: '#059669', glyph: '+' },
    caution: { bg: '#d97706', glyph: '!' },
    danger: { bg: '#e11d48', glyph: '!!' },
  };
  const style = palette[sentiment] || palette.caution;

  return L.divIcon({
    className: 'herway-report-pin',
    html: `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 9999px;
        background: ${style.bg};
        color: #ffffff;
        font-weight: 800;
        font-size: 10px;
        border: 2px solid #ffffff;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.24);
        transform: translate(-50%, -50%);
      ">${style.glyph}</div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

export default function ReportMarkersLayer({ reports = [] }) {
  if (!Array.isArray(reports) || reports.length === 0) {
    return null;
  }

  return (
    <>
      {reports.map((rep) => {
        if (typeof rep?.lat !== 'number' || typeof rep?.lng !== 'number') {
          return null;
        }
        const categoryLabel = (rep.category || 'update').replace(/_/g, ' ');

        return (
          <Marker
            key={rep.id}
            position={[rep.lat, rep.lng]}
            icon={createReportIcon(rep.sentiment)}
          >
            <Popup>
              <div className="max-w-[220px] space-y-1 text-xs">
                <p className="font-semibold capitalize text-slate-900">{categoryLabel}</p>
                {rep.area_name && <p className="text-slate-500">{rep.area_name}</p>}
                {rep.note && <p className="text-slate-700">{rep.note}</p>}
                <p className="text-[11px] text-slate-400">
                  {rep.upvotes || 0} helpful
                </p>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}