import React from 'react';

interface RadarChartProps {
  data: { [key: string]: number };
  className?: string;
}

const RadarChart: React.FC<RadarChartProps> = ({ data, className = '' }) => {
  const labels = Object.keys(data);
  const values = Object.values(data);
  const maxValue = 100;

  // 中文标签映射
  const labelMap: Record<string, string> = {
    // MBTI
    'E': '外向',
    'I': '内向',
    'S': '感觉',
    'N': '直觉',
    'T': '思考',
    'F': '情感',
    'J': '判断',
    'P': '知觉',
    // Gallup 优势
    'Achiever': '成就',
    'Analytical': '分析',
    'Strategic': '战略',
    'Learner': '学习者',
    'Relator': '关系',
    'Responsibility': '责任',
    'Positivity': '积极',
    'Harmony': '和谐',
    'Individualization': '个体化'
  };
  
  // Create polygon points for the data
  const createPoints = (values: number[], radius: number = 140) => {
    const angleStep = (2 * Math.PI) / values.length;
    return values.map((value, index) => {
      const angle = angleStep * index - Math.PI / 2; // Start from top
      const normalizedValue = (value / maxValue) * radius;
      const x = 150 + normalizedValue * Math.cos(angle);
      const y = 150 + normalizedValue * Math.sin(angle);
      return `${x},${y}`;
    }).join(' ');
  };

  // Create axis lines
  const createAxisLines = () => {
    const angleStep = (2 * Math.PI) / labels.length;
    return labels.map((_, index) => {
      const angle = angleStep * index - Math.PI / 2;
      const x2 = 150 + 140 * Math.cos(angle);
      const y2 = 150 + 140 * Math.sin(angle);
      return (
        <line
          key={index}
          x1="150"
          y1="150"
          x2={x2}
          y2={y2}
          stroke="#E5E7EB"
          strokeWidth="1"
        />
      );
    });
  };

  // Create concentric circles
  const createCircles = () => {
    const circles = [];
    for (let i = 1; i <= 5; i++) {
      const radius = (140 * i) / 5;
      circles.push(
        <circle
          key={i}
          cx="150"
          cy="150"
          r={radius}
          fill="none"
          stroke="#F3F4F6"
          strokeWidth="1"
        />
      );
    }
    return circles;
  };

  // Create labels
  const createLabels = () => {
    const angleStep = (2 * Math.PI) / labels.length;
    return labels.map((label, index) => {
      const angle = angleStep * index - Math.PI / 2;
      const radius = 160;
      const x = 150 + radius * Math.cos(angle);
      const y = 150 + radius * Math.sin(angle);
      const mapped = labelMap[label] || label;
      
      return (
        <text
          key={index}
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="12"
          fill="#FFFFFF"
          fontWeight="500"
        >
          {mapped}
        </text>
      );
    });
  };

  // Create value labels
  const createValueLabels = () => {
    const angleStep = (2 * Math.PI) / labels.length;
    return values.map((value, index) => {
      const angle = angleStep * index - Math.PI / 2;
      const normalizedValue = (value / maxValue) * 140;
      const x = 150 + normalizedValue * Math.cos(angle);
      const y = 150 + normalizedValue * Math.sin(angle);
      
      return (
        <g key={index}>
          <circle
            cx={x}
            cy={y}
            r="4"
            fill="#FFFFFF"
            stroke="#FFFFFF"
            strokeWidth="2"
          />
          <text
            x={x}
            y={y - 15}
            textAnchor="middle"
            fontSize="11"
            fill="#FFFFFF"
            fontWeight="600"
          >
            {value}
          </text>
        </g>
      );
    });
  };

  const dataPoints = createPoints(values);

  return (
    <div className={`flex justify-center ${className}`}>
      <svg width="300" height="300" className="overflow-visible">
        {/* Background circles */}
        {createCircles()}
        
        {/* Axis lines */}
        {createAxisLines()}
        
        {/* Data area */}
        <polygon
          points={dataPoints}
          fill="rgba(255, 255, 255, 0.15)"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        
        {/* Data points and values */}
        {createValueLabels()}
        
        {/* Labels */}
        {createLabels()}
      </svg>
    </div>
  );
};

export default RadarChart;