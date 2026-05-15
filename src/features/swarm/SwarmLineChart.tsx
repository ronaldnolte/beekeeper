import React, { useState } from 'react';
import type { SwarmDataPoint } from './SwarmService';

interface SwarmLineChartProps {
  data: SwarmDataPoint[];
  lastYearData?: SwarmDataPoint[];
  averageData?: SwarmDataPoint[];
}

export const SwarmLineChart: React.FC<SwarmLineChartProps> = ({ data, lastYearData, averageData }) => {
  if (!data || data.length === 0) return null;

  const minScore = 0;
  const maxScore = 100;
  
  const width = 800;
  const height = 300;
  const paddingX = 40;
  const paddingY = 40;
  const graphWidth = width - paddingX * 2;
  const graphHeight = height - paddingY * 2;

  // Map primary data to SVG coordinates
  const getPoints = (dataset: SwarmDataPoint[]) => {
    return dataset.map((d, i) => {
      // We align all datasets to the current year's X-axis length
      // Because we mapped lastYearData and averageData to exactly match current year's dates
      const x = paddingX + (i / (data.length - 1)) * graphWidth;
      const y = height - paddingY - ((d.probability - minScore) / (maxScore - minScore)) * graphHeight;
      return { x, y, probability: d.probability, date: d.date, color: d.color };
    });
  };

  const points = getPoints(data);
  const pathD = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');

  let lastYearPathD = '';
  if (lastYearData && lastYearData.length > 0) {
      const lyPoints = getPoints(lastYearData);
      lastYearPathD = `M ${lyPoints[0].x} ${lyPoints[0].y} ` + lyPoints.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
  }

  let avgPathD = '';
  if (averageData && averageData.length > 0) {
      const avgPoints = getPoints(averageData);
      avgPathD = `M ${avgPoints[0].x} ${avgPoints[0].y} ` + avgPoints.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
  }

  // Highlight zones
  const y75 = height - paddingY - ((75 - minScore) / (maxScore - minScore)) * graphHeight;
  const y40 = height - paddingY - ((40 - minScore) / (maxScore - minScore)) * graphHeight;

  const latestPoint = points[points.length - 1];

  // Month marks for X-axis
  const monthMarks = points.filter(p => p.date.endsWith('-01'));

  // Hover state
  const [hoverX, setHoverX] = useState<number | null>(null);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const bounds = e.currentTarget.getBoundingClientRect();
    const scaleX = width / bounds.width;
    const svgX = (e.clientX - bounds.left) * scaleX;
    
    if (svgX >= paddingX && svgX <= width - paddingX) {
      setHoverX(svgX);
    } else {
      setHoverX(null);
    }
  };

  let hoverIndex = -1;
  if (hoverX !== null) {
    const ratio = (hoverX - paddingX) / graphWidth;
    hoverIndex = Math.round(ratio * (points.length - 1));
    hoverIndex = Math.max(0, Math.min(points.length - 1, hoverIndex));
  }

  const lyPoints = (lastYearData && lastYearData.length > 0) ? getPoints(lastYearData) : null;
  const avgPoints = (averageData && averageData.length > 0) ? getPoints(averageData) : null;

  return (
    <div className="w-full bg-[var(--color-input-bg)] rounded-2xl shadow-sm border border-[var(--color-card-border)] p-4">
      
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mb-4 text-xs font-bold text-[var(--color-text-muted)]">
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-[#2c3e50] rounded-full"></div>
          Current Year
        </div>
        {lastYearData && lastYearData.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 rounded-full" style={{ borderTop: '2px dashed #d97706' }}></div>
            Last Year
          </div>
        )}
        {averageData && averageData.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 rounded-full" style={{ borderTop: '2px dotted #0ea5e9' }}></div>
            5-Year Avg
          </div>
        )}
      </div>

      <div className="w-full overflow-x-auto">
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          className="w-full h-auto cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverX(null)}
          onTouchMove={(e) => {
             const touch = e.touches[0];
             const bounds = e.currentTarget.getBoundingClientRect();
             const scaleX = width / bounds.width;
             const svgX = (touch.clientX - bounds.left) * scaleX;
             if (svgX >= paddingX && svgX <= width - paddingX) setHoverX(svgX);
          }}
          onTouchEnd={() => setHoverX(null)}
        >
          {/* Background Threshold Zones */}
          <rect x={paddingX} y={paddingY} width={graphWidth} height={Math.max(0, y75 - paddingY)} fill="#F44336" fillOpacity="0.05" />
          <rect x={paddingX} y={y75} width={graphWidth} height={y40 - y75} fill="#FFC107" fillOpacity="0.05" />
          <rect x={paddingX} y={y40} width={graphWidth} height={(height - paddingY) - y40} fill="#4CAF50" fillOpacity="0.05" />

          {/* Threshold Lines */}
          <line x1={paddingX} y1={y75} x2={width - paddingX} y2={y75} stroke="#F44336" strokeWidth="1" strokeDasharray="4 4" />
          <text x={paddingX - 5} y={y75 + 4} fontSize="10" fill="#F44336" textAnchor="end" fontWeight="bold">75%</text>
          
          <line x1={paddingX} y1={y40} x2={width - paddingX} y2={y40} stroke="#FFC107" strokeWidth="1" strokeDasharray="4 4" />
          <text x={paddingX - 5} y={y40 + 4} fontSize="10" fill="#FFC107" textAnchor="end" fontWeight="bold">40%</text>

          {/* Axes */}
          <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="#cbd5e1" strokeWidth="2" />
          <line x1={paddingX} y1={paddingY} x2={paddingX} y2={height - paddingY} stroke="#cbd5e1" strokeWidth="2" />
          
          {/* 100% and 0% Marks */}
          <text x={paddingX - 5} y={paddingY + 4} fontSize="10" fill="#64748b" textAnchor="end" fontWeight="bold">100%</text>
          <text x={paddingX - 5} y={height - paddingY + 4} fontSize="10" fill="#64748b" textAnchor="end" fontWeight="bold">0%</text>

          {/* Historical Lines */}
          {avgPathD && <path d={avgPathD} fill="none" stroke="#0ea5e9" strokeWidth="2" strokeDasharray="2 4" />}
          {lastYearPathD && <path d={lastYearPathD} fill="none" stroke="#d97706" strokeWidth="2" strokeDasharray="6 4" />}

          {/* Current Year Line */}
          <path d={pathD} fill="none" stroke="#2c3e50" strokeWidth="3" />

          {/* Current Date Marker */}
          <circle cx={latestPoint.x} cy={latestPoint.y} r="6" fill={latestPoint.color} stroke="white" strokeWidth="2" />
          
          {/* Score Tooltip at end (only show if not hovering near it) */}
          {hoverIndex === -1 && (
            <g>
              <rect x={latestPoint.x - 20} y={latestPoint.y - 35} width="40" height="24" rx="4" fill="#1e293b" />
              <text x={latestPoint.x} y={latestPoint.y - 18} fontSize="12" fill="white" textAnchor="middle" fontWeight="bold">
                {latestPoint.probability}%
              </text>
            </g>
          )}

          {/* Month Ticks */}
          {monthMarks.map((m, i) => (
             <g key={i}>
                <line x1={m.x} y1={height - paddingY} x2={m.x} y2={height - paddingY + 5} stroke="#cbd5e1" strokeWidth="1" />
                <text x={m.x} y={height - paddingY + 16} fontSize="10" fill="#94a3b8" textAnchor="middle">
                   {new Date(m.date).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}
                </text>
             </g>
          ))}

          {/* Hover Tooltip */}
          {hoverIndex !== -1 && (
             <g>
                {/* Vertical Line */}
                <line 
                   x1={points[hoverIndex].x} 
                   y1={paddingY} 
                   x2={points[hoverIndex].x} 
                   y2={height - paddingY} 
                   stroke="#94a3b8" 
                   strokeWidth="1" 
                   strokeDasharray="4 4" 
                />
                
                {/* Data Points */}
                {avgPoints && avgPoints.length > hoverIndex && (
                   <circle cx={avgPoints[hoverIndex].x} cy={avgPoints[hoverIndex].y} r="4" fill="#0ea5e9" />
                )}
                {lyPoints && lyPoints.length > hoverIndex && (
                   <circle cx={lyPoints[hoverIndex].x} cy={lyPoints[hoverIndex].y} r="4" fill="#d97706" />
                )}
                <circle cx={points[hoverIndex].x} cy={points[hoverIndex].y} r="5" fill={points[hoverIndex].color} stroke="white" strokeWidth="1.5" />
                
                {/* Tooltip Box */}
                <g transform={`translate(${Math.min(points[hoverIndex].x + 10, width - 120)}, ${Math.max(paddingY, points[hoverIndex].y - 60)})`}>
                    <rect width="110" height={averageData && averageData.length > 0 ? "70" : "50"} rx="6" fill="white" stroke="#e2e8f0" strokeWidth="1" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.1))" />
                    <text x="10" y="18" fontSize="10" fontWeight="bold" fill="#64748b">
                       {new Date(points[hoverIndex].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                    </text>
                    
                    <text x="10" y="34" fontSize="11" fill="#2c3e50" fontWeight="black">
                       Current: {Math.round(points[hoverIndex].probability)}%
                    </text>
                    
                    {lastYearData && lastYearData.length > hoverIndex && (
                       <text x="10" y="48" fontSize="10" fill="#d97706" fontWeight="bold">
                          Last Year: {Math.round(lastYearData[hoverIndex].probability)}%
                       </text>
                    )}
                    
                    {averageData && averageData.length > hoverIndex && (
                       <text x="10" y="62" fontSize="10" fill="#0ea5e9" fontWeight="bold">
                          5-Yr Avg: {Math.round(averageData[hoverIndex].probability)}%
                       </text>
                    )}
                </g>
             </g>
          )}

        </svg>
      </div>
    </div>
  );
};
