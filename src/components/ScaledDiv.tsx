import React, { useEffect, useRef, useState } from "react";

const ScaledDiv = ({ children }: { children: React.ReactNode }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    useEffect(() => {
        const resize = () => {
            if (!containerRef.current || !contentRef.current) return;
            const container = containerRef.current.getBoundingClientRect();
            const content = contentRef.current.getBoundingClientRect();
            const scaleX = container.width / content.width;
            const scaleY = container.height / content.height;
            const newScale = Math.min(scaleX, scaleY);
            setScale(newScale);
        };

        const observer = new ResizeObserver(resize);
        if (containerRef.current) observer.observe(containerRef.current);

        resize();

        return () => observer.disconnect();
    }, []);

    return (
        <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-gray-100">
            <div
                ref={contentRef}
                style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
                className="w-[800px] h-[600px] bg-blue-300"
            >
                {children}
            </div>
        </div>
    );
};

export default ScaledDiv;