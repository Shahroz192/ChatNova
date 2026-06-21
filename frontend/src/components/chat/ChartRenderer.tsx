import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';
import { useTheme } from '../../hooks/useTheme';
import '../../styles/GenerativeUI.css';

// Register chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

// Distinct, colorblind-friendly palette for pie/donut charts
const PIE_COLORS = [
  { bg: '#6366F1', border: '#4338CA' }, // Indigo
  { bg: '#14B8A6', border: '#0D9488' }, // Teal
  { bg: '#F59E0B', border: '#D97706' }, // Amber
  { bg: '#EF4444', border: '#DC2626' }, // Red
  { bg: '#8B5CF6', border: '#7C3AED' }, // Purple
  { bg: '#78716c', border: '#57534e' }, // Gray
  { bg: '#EC4899', border: '#DB2777' }, // Pink
  { bg: '#06B6D4', border: '#0891B2' }, // Cyan
  { bg: '#F97316', border: '#EA580C' }, // Orange
  { bg: '#84CC16', border: '#65A30D' }, // Lime
  { bg: '#A855F7', border: '#9333EA' }, // Violet
  { bg: '#14B8A6', border: '#0F766E' }, // Cyan-2
];

// Subtle, distinct fills for bar charts
const BAR_COLORS = [
  '#6366F1', '#14B8A6', '#F59E0B', '#EF4444',
  '#8B5CF6', '#10B981', '#EC4899', '#06B6D4',
  '#F97316', '#84CC16', '#A855F7', '#0EA5E9',
];

interface ChartProps {
  type: 'bar' | 'line' | 'pie';
  data: { name?: string; label?: string; value: number; color?: string }[];
  label: string;
}

const ChartRenderer: React.FC<ChartProps> = ({ type, data, label }) => {
  const { isDark } = useTheme();

  // Line charts must preserve input order (e.g. chronological series).
  // Bar/pie charts benefit from descending value sort.
  const displayData = useMemo(() => {
    if (type === 'line') return data;
    return [...data].sort((a, b) => b.value - a.value);
  }, [data, type]);

  const isPie = type === 'pie';

  // Use theme-aware colors
  const textColor = isDark ? '#94a3b8' : '#64748b'; // slate-400 : slate-500
  const gridColor = isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(100, 116, 139, 0.1)';

  const chartData = useMemo(() => {
    const labels = displayData.map(item => item.name || item.label || '');
    const values = displayData.map(item => item.value);

    if (isPie) {
      return {
        labels,
        datasets: [{
          label,
          data: values,
          backgroundColor: displayData.map((item, i) => item.color ?? PIE_COLORS[i % PIE_COLORS.length].bg),
          borderColor: displayData.map((item, i) => item.color ?? PIE_COLORS[i % PIE_COLORS.length].border),
          borderWidth: 2,
          hoverOffset: 12,
        }],
      };
    }

    // Bar
    if (type === 'bar') {
      const barColors = displayData.map(
        (item, i) => item.color ?? BAR_COLORS[i % BAR_COLORS.length]
      );

      return {
        labels,
        datasets: [{
          label,
          data: values,
          backgroundColor: barColors.map(c => c + '99'), // ~60% opacity
          borderColor: barColors,
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false,
        }],
      };
    }

    // Line
    const lineColor = displayData[0]?.color ?? '#6366F1';
    return {
      labels,
      datasets: [{
        label,
        data: values,
        borderColor: lineColor,
        backgroundColor: lineColor + '18',
        borderWidth: 2.5,
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointHoverRadius: 7,
        pointBackgroundColor: lineColor,
        pointBorderColor: isDark ? '#1e293b' : '#ffffff',
        pointBorderWidth: 2,
      }],
    };
  }, [displayData, label, isPie, type, isDark]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 600,
      easing: 'easeOutQuart' as const,
    },
    plugins: {
      legend: {
        position: isPie ? ('right' as const) : ('top' as const),
        labels: {
          color: textColor,
          padding: 16,
          usePointStyle: true,
          pointStyle: isPie ? 'circle' : 'rectRounded',
          font: { size: 12 },
        }
      },
      title: {
        display: true,
        text: label,
        color: textColor,
        font: { size: 14, weight: 'bold' as const },
        padding: { bottom: 16 },
      },
      tooltip: {
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        titleColor: isDark ? '#f1f5f9' : '#0f172a',
        bodyColor: isDark ? '#cbd5e1' : '#475569',
        borderColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(100, 116, 139, 0.2)',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        displayColors: !isPie,
      },
    },
    scales: isPie
      ? {}
      : {
        x: {
          grid: { display: false },
          ticks: { color: textColor, font: { size: 11 } },
          border: { color: gridColor },
        },
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: { color: textColor, font: { size: 11 } },
          border: { color: gridColor },
        },
      },
  }), [isPie, textColor, label, gridColor, isDark]);

  const renderChart = () => {
    switch (type) {
      case 'bar':
        return <Bar data={chartData} options={options} />;
      case 'line':
        return <Line data={chartData} options={options} />;
      case 'pie':
        return <Pie data={chartData} options={options} />;
      default:
        return (
          <div className="flex items-center justify-center h-full text-slate-400">
            Unsupported chart type
          </div>
        );
    }
  };

  return (
    <div className="gen-ui-chart-container">
      {renderChart()}
    </div>
  );
};

export default React.memo(ChartRenderer);
