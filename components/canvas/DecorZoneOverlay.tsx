import React from 'react';

interface DecorZoneOverlayProps {
    /** Points of the polygon currently being drawn */
    drawingPoints: { x: number; y: number }[];
    /** Live cursor position for preview line */
    cursorPos: { x: number; y: number } | null;
    visualScale: number;
    nextColor: string;
    nextLabel: string;
}

/**
 * Renders ONLY the in-progress polygon drawing preview.
 * Completed polygons are layers — they don't go through here.
 */
const DecorZoneOverlay: React.FC<DecorZoneOverlayProps> = ({
    drawingPoints,
    cursorPos,
    visualScale,
    nextColor,
    nextLabel,
}) => {
    const hasDrawing = drawingPoints.length > 0;
    if (!hasDrawing) return null;

    const previewPointsStr = drawingPoints.map(p => `${p.x},${p.y}`).join(' ');

    return (
        <>
            {/* SVG layer for drawing preview */}
            <svg
                className="absolute inset-0 w-full h-full pointer-events-none z-20"
                style={{ overflow: 'visible' }}
            >
                {/* Filled preview (if >=3 points) */}
                {drawingPoints.length >= 3 && (
                    <polygon
                        points={previewPointsStr}
                        fill={nextColor + '22'}
                        stroke={nextColor}
                        strokeWidth={3 * visualScale}
                        strokeDasharray={`${8 * visualScale} ${4 * visualScale}`}
                    />
                )}

                {/* Lines between vertices */}
                {drawingPoints.length >= 2 && (
                    <polyline
                        points={previewPointsStr}
                        fill="none"
                        stroke={nextColor}
                        strokeWidth={3 * visualScale}
                        strokeDasharray={`${8 * visualScale} ${4 * visualScale}`}
                    />
                )}

                {/* Live preview line from last point to cursor */}
                {cursorPos && (
                    <line
                        x1={drawingPoints[drawingPoints.length - 1].x}
                        y1={drawingPoints[drawingPoints.length - 1].y}
                        x2={cursorPos.x}
                        y2={cursorPos.y}
                        stroke={nextColor}
                        strokeWidth={2 * visualScale}
                        strokeDasharray={`${6 * visualScale} ${3 * visualScale}`}
                        opacity={0.6}
                    />
                )}

                {/* Vertex dots */}
                {drawingPoints.map((pt, i) => (
                    <circle
                        key={i}
                        cx={pt.x}
                        cy={pt.y}
                        r={i === 0 && drawingPoints.length >= 3 ? 8 * visualScale : 5 * visualScale}
                        fill={i === 0 && drawingPoints.length >= 3 ? nextColor : '#fff'}
                        stroke={nextColor}
                        strokeWidth={2 * visualScale}
                    />
                ))}
            </svg>

            {/* Tooltip with label preview and instructions */}
            <div
                className="absolute z-30 pointer-events-none"
                style={{
                    left: drawingPoints[drawingPoints.length - 1].x + 20 * visualScale,
                    top: drawingPoints[drawingPoints.length - 1].y - 10 * visualScale,
                    transform: `scale(${visualScale})`,
                    transformOrigin: 'top left',
                }}
            >
                <div className="bg-black/80 text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap border border-white/20 font-medium flex flex-col gap-0.5">
                    <span className="font-bold" style={{ color: nextColor }}>🛋️ {nextLabel}</span>
                    <span className="text-gray-400">
                        {drawingPoints.length < 3
                            ? `${drawingPoints.length}/3 pontos (mín. 3)`
                            : 'Clique no 1º ponto ou Enter para fechar'}
                    </span>
                </div>
            </div>
        </>
    );
};

export default DecorZoneOverlay;
